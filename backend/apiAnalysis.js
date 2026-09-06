const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const dns = require('dns');
const net = require('net');
const crypto = require('crypto');
const db = require('./db');

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Limits / configuration                                              */
/* ------------------------------------------------------------------ */

const REQUEST_TIMEOUT_MS = 15000;   // hard cap so a request can never hang
const MAX_BODY_BYTES = 512 * 1024;  // never buffer more than 512 KB of a response
const MAX_PREVIEW_CHARS = 4000;     // body preview sent to the UI

const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

/**
 * Authentication middleware.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

/* ------------------------------------------------------------------ */
/* SSRF / internal network guard                                       */
/* ------------------------------------------------------------------ */

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 0) return true;            // "this" network
  if (a === 10) return true;           // 10.0.0.0/8
  if (a === 127) return true;          // loopback
  if (a === 169 && b === 254) return true; // link-local (metadata endpoints)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;          // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true;           // multicast / reserved
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;    // loopback / unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (lower.startsWith('fe8') || lower.startsWith('fe9') ||
      lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
  return false;
}

function resolveHost(host, isIpLiteral) {
  return new Promise((resolve) => {
    if (isIpLiteral) {
      resolve([host]);
      return;
    }
    if (host.toLowerCase() === 'localhost') {
      resolve(['127.0.0.1']);
      return;
    }
    dns.lookup(host, { all: true }, (err, addresses) => {
      if (err || !addresses) {
        resolve([]);
        return;
      }
      resolve(addresses.map((a) => a.address).filter(Boolean));
    });
  });
}

/* ------------------------------------------------------------------ */
/* Safe HTTP request                                                   */
/* ------------------------------------------------------------------ */

function makeRequest(parsedUrl, method, timeoutMs, maxBytes) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { 'User-Agent': 'AccessCheck-APIAnalysis/1.0', Accept: '*/*' },
      timeout: timeoutMs
    };

    const done = (payload) => {
      if (!payload.responseTimeMs) payload.responseTimeMs = Date.now() - startedAt;
      resolve(payload);
    };

    const req = transport.request(options, (res) => {
      const responseTimeMs = Date.now() - startedAt;
      const headers = res.headers || {};

      if (method === 'HEAD') {
        res.resume();
        req.destroy();
        return done({
          ok: true,
          status: res.statusCode,
          headers,
          body: '',
          bodyTruncated: false,
          responseTimeMs,
          error: null
        });
      }

      const chunks = [];
      let size = 0;
      let truncated = false;

      res.on('data', (c) => {
        if (size + c.length > maxBytes) {
          truncated = true;
          const remaining = maxBytes - size;
          if (remaining > 0) chunks.push(c.slice(0, remaining));
          size = maxBytes;
          res.destroy();
          return;
        }
        chunks.push(c);
        size += c.length;
      });

      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        done({
          ok: true,
          status: res.statusCode,
          headers,
          body,
          bodyTruncated: truncated,
          responseTimeMs: Date.now() - startedAt,
          error: null
        });
      });

      res.on('error', (e) => {
        done({ ok: false, status: null, headers: null, body: '', bodyTruncated: false, responseTimeMs, error: e.message });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('request-timed-out'));
    });

    req.on('error', (e) => {
      done({ ok: false, status: null, headers: null, body: '', bodyTruncated: false, responseTimeMs: Date.now() - startedAt, error: e.message });
    });

    req.end();
  });
}

/* ------------------------------------------------------------------ */
/* Result shaping                                                      */
/* ------------------------------------------------------------------ */

function statusCategory(status) {
  if (status == null) return 'unreachable';
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  if (status >= 500 && status < 600) return 'server-error';
  return 'other';
}

function statusLabel(category, status) {
  switch (category) {
    case 'ok': return `API responding (HTTP ${status})`;
    case 'redirect': return `API responded with a redirect (HTTP ${status})`;
    case 'client-error': return `API returned a client error (HTTP ${status})`;
    case 'server-error': return `API returned a server error (HTTP ${status})`;
    case 'other': return `API responded (HTTP ${status})`;
    default: return 'API unreachable';
  }
}

function statusEmoji(category) {
  switch (category) {
    case 'ok': return '✓';
    case 'redirect': return '➜';
    case 'client-error':
    case 'server-error': return '⚠';
    default: return '✗';
  }
}

function corsStatus(headers, ok) {
  if (!ok || !headers) return 'could-not-determine';
  const h = headers;
  const acao = h['access-control-allow-origin'];
  if (typeof acao === 'string' && acao.trim().length > 0) return 'configured';
  return 'not-detected';
}

function tryParseJson(body) {
  if (!body) return { valid: false, data: null, error: 'No body to parse' };
  try {
    const data = JSON.parse(body);
    return { valid: true, data, error: null };
  } catch (e) {
    return { valid: false, data: null, error: e.message };
  }
}

function structureSummary(data, depth) {
  if (data == null) return 'null';
  const t = Array.isArray(data) ? 'array' : typeof data;
  if (t === 'array') {
    const n = data.length;
    const sample = n > 0 ? structureSummary(data[0], depth + 1) : 'empty';
    return `array(${n}) of ${sample}`;
  }
  if (t === 'object') {
    if (depth > 3) return 'object (too deep)';
    const keys = Object.keys(data).slice(0, 12);
    const rest = Object.keys(data).length > 12 ? ', …' : '';
    return `object with keys: ${keys.join(', ')}${rest}`;
  }
  return t;
}

function buildObservations({ status, category, isJson, contentType, responseTimeMs, truncated, ok, headers }) {
  const obs = [];
  if (!ok && category === 'unreachable') {
    obs.push('The endpoint could not be reached. Check the address, network connectivity, and whether the service is running.');
  } else if (category === 'client-error') {
    obs.push('The endpoint responded with a client error (HTTP 4xx). The requested resource may not exist or the request may be malformed.');
  } else if (category === 'server-error') {
    obs.push('The endpoint responded with a server error (HTTP 5xx). The API may be experiencing an outage or an internal error.');
  } else if (category === 'redirect') {
    obs.push('The endpoint returned a redirect. Follow the Location header to confirm the final target, or use a direct URL to avoid redirects.');
  }

  if (ok) {
    if (!contentType) {
      obs.push('The response did not include a Content-Type header, which can make it harder for clients to interpret the data.');
    } else if (contentType.includes('json')) {
      if (!isJson) obs.push('The response advertises JSON but the body could not be parsed as valid JSON.');
    } else if (contentType.includes('text/html')) {
      obs.push('The endpoint returned HTML rather than a structured format. HTML responses are shown as plain text only.');
    }
    if (truncated) {
      obs.push(`The response was larger than ${Math.round(MAX_BODY_BYTES / 1024)} KB and was truncated for display.`);
    }
    if (responseTimeMs > 2000) {
      obs.push(`The endpoint took ${responseTimeMs} ms to respond, which is slow. Consider reviewing server or network performance.`);
    }
    if (headers && !headers['access-control-allow-origin']) {
      obs.push('No CORS header was detected. Note that browser cross-origin behavior can differ from this server-to-server request.');
    }
  }

  return obs;
}

function contentTypeOf(headers) {
  if (!headers) return null;
  const ct = headers['content-type'];
  return Array.isArray(ct) ? ct[0] : ct || null;
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

/**
 * POST /api/api-analysis
 * Content-Type: application/json. Authenticated only.
 * Body: { url: string, method: 'GET' | 'HEAD' }
 *
 * Performs a single, safe, read-only HTTP request to the given endpoint and
 * reports basic functionality / accessibility & reliability observations.
 * Only GET and HEAD are allowed (read-only) to avoid mutating user data.
 */
router.post('/', requireAuth, async (req, res) => {
  let urlInput = req.body && typeof req.body.url === 'string' ? req.body.url.trim() : '';
  const method = req.body && typeof req.body.method === 'string' ? req.body.method.toUpperCase() : 'GET';

  if (!urlInput) {
    return res.status(400).json({ error: 'An API endpoint URL is required.' });
  }
  if (!ALLOWED_METHODS.has(method)) {
    return res.status(400).json({ error: `Method "${method}" is not supported. Safe API checks support GET and HEAD only.` });
  }

  let parsed;
  try {
    parsed = new URL(urlInput);
  } catch {
    return res.status(400).json({ error: 'That is not a valid URL. Provide a full address such as https://example.com/api/users.' });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Unsupported protocol. Only http:// and https:// endpoints are supported.' });
  }
  if (parsed.username || parsed.password) {
    return res.status(400).json({ error: 'URLs containing embedded credentials are not allowed.' });
  }

  // Block private / internal / link-local targets to prevent the endpoint from
  // being used to reach internal infrastructure.
  try {
    const isIpLiteral = net.isIP(parsed.hostname) !== 0;
    const addrs = await resolveHost(parsed.hostname, isIpLiteral);
    if (addrs.length === 0) {
      return res.status(400).json({ error: 'The host could not be resolved. The endpoint may be unreachable.' });
    }
    const blocked = addrs.some((a) =>
      (net.isIP(a) === 4 ? isPrivateIPv4(a) : isPrivateIPv6(a))
    );
    if (blocked) {
      return res.status(400).json({ error: 'This endpoint resolves to a private or internal network address and was blocked for safety.' });
    }
  } catch (resolveError) {
    return res.status(400).json({ error: 'The host could not be validated. The endpoint may be unreachable.' });
  }

  const result = await makeRequest(parsed, method, REQUEST_TIMEOUT_MS, MAX_BODY_BYTES);

  if (result.error === 'request-timed-out' || (result.error && /timed.?out/i.test(result.error))) {
    return res.json({
      url: urlInput,
      method,
      ok: false,
      reached: false,
      status: null,
      responseTimeMs: result.responseTimeMs,
      contentType: null,
      responseSizeBytes: 0,
      isJson: false,
      structure: null,
      bodyPreview: '',
      category: 'timeout',
      apiStatus: 'API did not respond within the allowed time (15s timeout)',
      apiStatusEmoji: '✗',
      cors: 'could-not-determine',
      observations: ['The endpoint did not respond within the allowed time. Confirm the service is alive and reachable.']
    });
  }

  if (!result.ok || result.error) {
    let message = 'API unreachable';
    if (result.error && /ENOTFOUND|getaddrinfo/i.test(result.error)) message = 'DNS resolution failed. The hostname could not be found.';
    else if (result.error && /ECONNREFUSED/i.test(result.error)) message = 'Connection refused. Nothing is accepting connections at this endpoint.';
    else if (result.error && /ECONNRESET/i.test(result.error)) message = 'The connection was reset before a complete response.';
    else if (result.error) message = `The request failed (${result.error}).`;
    return res.json({
      url: urlInput,
      method,
      ok: false,
      reached: false,
      status: null,
      responseTimeMs: result.responseTimeMs,
      contentType: null,
      responseSizeBytes: 0,
      isJson: false,
      structure: null,
      bodyPreview: '',
      category: 'unreachable',
      apiStatus: message,
      apiStatusEmoji: '✗',
      cors: 'could-not-determine',
      observations: [message]
    });
  }

  const contentType = contentTypeOf(result.headers);
  const isJson = contentType && contentType.includes('json');
  const parsedBody = isJson ? tryParseJson(result.body) : null;

  let preview = result.body.slice(0, MAX_PREVIEW_CHARS);
  let structure = null;
  if (parsedBody && parsedBody.valid) {
    structure = structureSummary(parsedBody.data, 0);
    try {
      preview = JSON.stringify(parsedBody.data, null, 2).slice(0, MAX_PREVIEW_CHARS);
    } catch { /* keep raw preview */ }
  }

  const category = statusCategory(result.status);
  const observations = buildObservations({
    status: result.status,
    category,
    isJson: !!(parsedBody && parsedBody.valid),
    contentType,
    responseTimeMs: result.responseTimeMs,
    truncated: result.bodyTruncated,
    ok: true,
    headers: result.headers
  });

  const analysis = {
    url: urlInput,
    method,
    ok: true,
    reached: true,
    status: result.status,
    responseTimeMs: result.responseTimeMs,
    contentType,
    responseSizeBytes: result.body.length,
    isJson: !!(parsedBody && parsedBody.valid),
    structure,
    bodyPreview: preview,
    bodyTruncated: result.bodyTruncated,
    category,
    apiStatus: statusLabel(category, result.status),
    apiStatusEmoji: statusEmoji(category),
    cors: corsStatus(result.headers, true),
    observations
  };

  // Persist to the authenticated user's audit history, clearly distinguished
  // from webpage / source-code audits by audit_type = 'api-analysis'.
  try {
    const auditId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO audits (id, user_id, scanned_url, score, violation_count, violations, screenshot_url, indic_text, audit_type, source_files)
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'api-analysis', NULL)
    `).run(
      auditId,
      req.session.userId,
      urlInput,
      100,
      0,
      JSON.stringify(analysis)
    );
    analysis.auditId = auditId;
    analysis.saved = true;
  } catch (saveError) {
    console.error('Failed to save API analysis to history:', saveError.message);
    analysis.saved = false;
  }

  return res.json(analysis);
});

module.exports = router;
