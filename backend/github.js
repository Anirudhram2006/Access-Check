const express = require('express');
const crypto = require('crypto');
const db = require('./db');

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Configuration (environment variables)                               */
/* ------------------------------------------------------------------ */
//
// To enable GitHub OAuth, set these environment variables (loaded automatically
// from backend/.env by server.js via process.loadEnvFile()):
//
//   GITHUB_CLIENT_ID          GitHub OAuth App client ID
//   GITHUB_CLIENT_SECRET      GitHub OAuth App client secret (never sent to the browser)
//   GITHUB_CALLBACK_URL       (optional) exact OAuth redirect_uri. Defaults to
//                             http://localhost:5000/api/github/callback
//   GITHUB_TOKEN_ENCRYPTION_KEY  (optional) secret used to encrypt stored tokens;
//                                falls back to SESSION_SECRET, else an ephemeral key.
//   BACKEND_BASE_URL          (optional) base URL of this backend for the OAuth
//                                callback. Defaults to http://localhost:5000
//   FRONTEND_BASE_URL         (optional) where to redirect after OAuth.
//                                Defaults to http://localhost:5173
//
// No credentials are hardcoded and none are ever logged.

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || '';
const GITHUB_TOKEN_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET || '';
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:5000';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

// The exact redirect_uri sent to GitHub must match in both the authorize request
// and the token exchange. It is taken from GITHUB_CALLBACK_URL when configured,
// otherwise derived from BACKEND_BASE_URL.
function getCallbackUrl() {
  if (GITHUB_CALLBACK_URL) return GITHUB_CALLBACK_URL;
  return `${BACKEND_BASE_URL}/api/github/callback`;
}

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API = 'https://api.github.com';

// Minimal scopes that allow reading the connected user's identity and
// browsing/reading the files of the repositories they select. `repo` is
// required to list and read private repositories the user explicitly connects.
const OAUTH_SCOPES = 'read:user repo';

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

const MAX_REPO_RESULTS = 100;       // max repos returned from a single listing
const MAX_LISTING_ENTRIES = 500;    // cap directory children returned per path
const MAX_FILE_SIZE = 1024 * 1024;  // reject GitHub files larger than 1 MB
const MAX_CONTENT_CHARS = 500000;   // cap characters fetched for analysis
const REQUEST_TIMEOUT_MS = 20000;   // GitHub API call timeout

const USER_AGENT = 'AccessCheck-GitHubIntegration/1.0';
const GITHUB_API_ACCEPT = 'application/vnd.github+json';

/* ------------------------------------------------------------------ */
/* Token encryption                                                    */
/* ------------------------------------------------------------------ */

let encryptionKey = null;

function getEncryptionKey() {
  if (encryptionKey) return encryptionKey;
  const source = GITHUB_TOKEN_KEY;
  if (!source) {
    // No stable secret configured. Generate an ephemeral key so the module is
    // safe to operate, but note stored tokens will not survive a restart.
    encryptionKey = crypto.randomBytes(32);
    return encryptionKey;
  }
  // Derive a deterministic 32-byte key from the configured secret using scrypt.
  encryptionKey = crypto.scryptSync(String(source), 'access-check-github-tokens', 32);
  return encryptionKey;
}

function encryptToken(plainToken) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), nonce);
  const enc = Buffer.concat([cipher.update(String(plainToken), 'utf8'), cipher.final()]);
  return {
    nonce: nonce.toString('base64'),
    data: enc.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  };
}

function decryptToken(enc, nonce, tag) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(nonce, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

function githubConfigMissing() {
  return !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET;
}

/**
 * Perform an authenticated GitHub API request using the connected user's token.
 * Returns { ok, status, body } where body is parsed JSON (or null). Network
 * failures are surfaced in a normalized way so we never leak internal details.
 */
function githubRequest(token, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || REQUEST_TIMEOUT_MS);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: options.raw ? 'application/vnd.github.raw+json' : GITHUB_API_ACCEPT,
    'User-Agent': USER_AGENT
  };

  return fetch(`${GITHUB_API}${path}`, {
    method: 'GET',
    headers,
    redirect: 'follow',
    signal: controller.signal
  }).then(async (res) => {
    const status = res.status;
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    return { ok: status >= 200 && status < 300, status, body, rawText: text };
  }).catch((err) => {
    if (err && err.name === 'AbortError') {
      return { ok: false, status: 0, body: null, rawText: '', timedOut: true };
    }
    return { ok: false, status: 0, body: null, rawText: '', networkError: true };
  }).finally(() => clearTimeout(timer));
}

/**
 * Retrieve the connected GitHub token for the current authenticated user,
 * decrypting it. Returns null if there is no connection or it cannot be
 * decrypted. Ownership is always derived from req.session.userId.
 */
function getTokenForUser(userId) {
  const row = db.prepare(
    'SELECT access_token_encrypted, github_username, github_user_id FROM github_connections WHERE user_id = ?'
  ).get(userId);
  if (!row) return null;
  let decrypted = null;
  try {
    const parsed = JSON.parse(row.access_token_encrypted);
    decrypted = decryptToken(parsed.data, parsed.nonce, parsed.tag);
  } catch {
    decrypted = null;
  }
  if (!decrypted) return null;
  return {
    token: decrypted,
    github_username: row.github_username,
    github_user_id: row.github_user_id
  };
}

function safeRepoName(value, label) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_.-]+$/.test(value)) {
    return null;
  }
  if (value.length > 100) return null;
  const msg = `${label} is invalid.`;
  return { value, msg };
}

function safePath(value) {
  if (typeof value !== 'string') return '';
  if (value.length > 400) return null;
  // Reject absolute paths and path traversal.
  if (value.startsWith('/') || value.split('/').includes('..') || value.includes('\0')) return null;
  return value;
}

function safeRef(value) {
  if (typeof value !== 'string' || !value) return '';
  if (value.length > 250) return null;
  // git refs (branch/tag names) may contain nested components like `feature/x`,
  // dashes, dots and underscores — but never traversal or control characters.
  if (!/^[A-Za-z0-9._\-\/]+$/.test(value)) return null;
  if (value.startsWith('/') || value.includes('\0') || value.split('/').includes('..')) return null;
  return value;
}

function classifyGithubError(apiStatus, body) {
  // Maps GitHub API statuses to safe, user-facing messages.
  if (apiStatus === 0) return { kind: 'network', message: 'GitHub could not be reached. Check your internet connection and try again.' };
  if (apiStatus === 401) return { kind: 'unauthorized', message: 'Your GitHub connection is no longer valid. Disconnect and reconnect GitHub.' };
  if (apiStatus === 403) {
    const msg = body && body.message ? String(body.message) : '';
    if (/rate limit/i.test(msg)) {
      return { kind: 'rate-limit', message: 'GitHub API rate limit reached. Please wait a bit and try again.' };
    }
    if (/forbidden|not granted/i.test(msg)) {
      return { kind: 'forbidden', message: 'Permission denied by GitHub for this repository. It may be private or not accessible with the connected account.' };
    }
    return { kind: 'forbidden', message: 'GitHub denied access to this resource.' };
  }
  if (apiStatus === 404) return { kind: 'not-found', message: 'Not found on GitHub. The repository or path may not exist.' };
  if (apiStatus === 422) return { kind: 'invalid', message: 'GitHub rejected the request (422).' };
  if (apiStatus >= 500) return { kind: 'server', message: 'GitHub is experiencing an issue. Please try again later.' };
  return { kind: 'unknown', message: 'GitHub returned an unexpected response. Please try again.' };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Handles starting the GitHub OAuth flow. Stores a CSRF `state` value in the
 * user's session and returns the GitHub authorization URL. Shared by both
 * GET /api/github/auth and GET /api/github/connect.
 */
function beginGithubAuth(req, res) {
  if (githubConfigMissing()) {
    return res.status(503).json({
      error: 'GitHub OAuth is not configured.',
      detail: 'Set the GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables, then restart the backend.'
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  req.session.githubState = state;
  req.session.githubStartUserId = req.session.userId;
  const redirectUri = getCallbackUrl();
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('client_id', GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', OAUTH_SCOPES);
  url.searchParams.set('state', state);
  return res.json({ authorizeUrl: url.toString() });
}

/**
 * GET /api/github/auth
 * Authenticated. Returns the GitHub authorization URL to begin OAuth, after
 * storing a CSRF `state` value in the user's session.
 */
router.get('/auth', requireAuth, (req, res) => beginGithubAuth(req, res));

/**
 * GET /api/github/connect
 * Alias of /auth. Authenticated. Returns the GitHub authorization URL to begin
 * OAuth after storing a CSRF `state` value in the user's session.
 */
router.get('/connect', requireAuth, (req, res) => beginGithubAuth(req, res));

/**
 * GET /api/github/callback
 * Hit by GitHub after the user authorizes (or denies). Validates the CSRF
 * state, exchanges the code for a token, stores an encrypted connection, and
 * redirects back to the frontend.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error: denyError, error_description } = req.query;

  const redirect = (params) => {
    const u = new URL(FRONTEND_BASE_URL);
    Object.keys(params).forEach((k) => u.searchParams.set(k, String(params[k])));
    return res.redirect(u.toString());
  };

  if (denyError) {
    // User denied authorization on GitHub's page.
    return redirect({ github: 'error', error: 'denied' });
  }

  // Validate CSRF state against the value stored for this session.
  if (!state || !req.session || !req.session.githubState || state !== req.session.githubState) {
    return redirect({ github: 'error', error: 'invalid-state' });
  }
  delete req.session.githubState;

  if (!code) {
    return redirect({ github: 'error', error: 'no-code' });
  }
  if (githubConfigMissing()) {
    return redirect({ github: 'error', error: 'not-configured' });
  }

  // Exchange the authorization code for an access token (server-side only).
  let tokenResult;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const body = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: getCallbackUrl()
    });
    const resp = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
      signal: controller.signal
    });
    clearTimeout(timer);
    tokenResult = await resp.json().catch(() => ({}));
  } catch {
    return redirect({ github: 'error', error: 'token-exchange-failed' });
  }

  const accessToken = tokenResult && tokenResult.access_token ? tokenResult.access_token : null;
  if (!accessToken) {
    return redirect({ github: 'error', error: 'invalid-code' });
  }

  // Fetch the GitHub identity for the token so we can store who is connected.
  const userResp = await githubRequestInternal(accessToken, '/user');
  if (!userResp.ok || !userResp.parsed || !userResp.parsed.login) {
    return redirect({ github: 'error', error: 'profile-failed' });
  }
  const ghUser = userResp.parsed;

  const userId = req.session.githubStartUserId || req.session.userId;
  if (!userId) {
    return redirect({ github: 'error', error: 'session-lost' });
  }
  delete req.session.githubStartUserId;

  const connectionId = crypto.randomUUID();
  const encrypted = encryptToken(accessToken);
  const storedPayload = JSON.stringify({ data: encrypted.data, nonce: encrypted.nonce, tag: encrypted.tag });

  const nowHex = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO github_connections (id, user_id, github_user_id, github_username, access_token_encrypted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        github_user_id = excluded.github_user_id,
        github_username = excluded.github_username,
        access_token_encrypted = excluded.access_token_encrypted,
        updated_at = excluded.updated_at
    `).run(
      connectionId,
      userId,
      String(ghUser.id),
      String(ghUser.login),
      storedPayload,
      nowHex,
      nowHex
    );
  } catch (saveErr) {
    console.error('Failed to save GitHub connection:', saveErr.message);
    return redirect({ github: 'error', error: 'save-failed' });
  }

  return redirect({ github: 'connected', username: String(ghUser.login) });
});

// Minimal token-agnostic GitHub API helper used only inside the callback to
// fetch the connecting user's own profile.
async function githubRequestInternal(token, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: GITHUB_API_ACCEPT,
        'User-Agent': USER_AGENT
      },
      signal: controller.signal
    });
    const text = await resp.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    return { ok: resp.status >= 200 && resp.status < 300, status: resp.status, parsed };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/github/status
 * Authenticated. Returns whether the current user has an active GitHub
 * connection and, if so, the (non-sensitive) GitHub identity.
 */
router.get('/status', requireAuth, (req, res) => {
  if (githubConfigMissing()) {
    return res.json({ connected: false, configured: false });
  }
  const gh = getTokenForUser(req.session.userId);
  if (!gh) {
    return res.json({ connected: false, configured: true });
  }
  return res.json({
    connected: true,
    configured: true,
    githubUsername: gh.github_username,
    githubUserId: gh.github_user_id
  });
});

/**
 * GET /api/github/repos
 * Authenticated. Lists repositories belonging to the connected GitHub account.
 */
router.get('/repos', requireAuth, async (req, res) => {
  const gh = getTokenForUser(req.session.userId);
  if (!gh) {
    return res.status(400).json({ error: 'GitHub is not connected. Connect your GitHub account first.' });
  }

  const result = await githubRequest(gh.token, `/user/repos?per_page=${MAX_REPO_RESULTS}&sort=updated`);
  if (!result.ok) {
    return res.status(result.status || 502).json(JSON.parse(JSON.stringify(classifyGithubError(result.status, result.body))));
  }

  const repos = (Array.isArray(result.body) ? result.body : [])
    .slice(0, MAX_REPO_RESULTS)
    .map((r) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      owner: r.owner ? r.owner.login : null,
      description: r.description || '',
      private: !!r.private,
      default_branch: r.default_branch || 'main',
      html_url: r.html_url || ''
    }));

  return res.json({ repos });
});

/**
 * GET /api/github/repos/:owner/:repo/branches
 * Authenticated. Lists the branches of a repository the connected GitHub
 * account can read. Repository access is validated by GitHub itself through
 * the authenticated user's token.
 */
router.get('/repos/:owner/:repo/branches', requireAuth, async (req, res) => {
  const gh = getTokenForUser(req.session.userId);
  if (!gh) {
    return res.status(400).json({ error: 'GitHub is not connected. Connect your GitHub account first.' });
  }

  const owner = safeRepoName(req.params.owner, 'Owner');
  const repo = safeRepoName(req.params.repo, 'Repository');
  if (!owner || !repo) {
    return res.status(400).json({ error: owner ? repo.msg : owner.msg });
  }

  const result = await githubRequest(gh.token, `/repos/${owner.value}/${repo.value}/branches?per_page=100`);
  if (!result.ok) {
    return res.status(result.status || 502).json(JSON.parse(JSON.stringify(classifyGithubError(result.status, result.body))));
  }

  const branches = (Array.isArray(result.body) ? result.body : [])
    .map((b) => ({
      name: b.name,
      protected: !!b.protected,
      sha: b.commit && b.commit.sha ? b.commit.sha : null
    }))
    .filter((b) => b.name);

  return res.json({ branches });
});

/**
 * GET /api/github/repos/:owner/:repo/contents?path=...&ref=...
 * Authenticated. Lists the contents of a directory in a repository belonging to
 * the connected account. `path` is optional (defaults to repo root); `ref`
 * optionally selects a branch/tag/commit (defaults to the repo default branch).
 */
router.get('/repos/:owner/:repo/contents', requireAuth, async (req, res) => {
  const gh = getTokenForUser(req.session.userId);
  if (!gh) {
    return res.status(400).json({ error: 'GitHub is not connected. Connect your GitHub account first.' });
  }

  const owner = safeRepoName(req.params.owner, 'Owner');
  const repo = safeRepoName(req.params.repo, 'Repository');
  if (!owner || !repo) {
    return res.status(400).json({ error: owner ? repo.msg : owner.msg });
  }
  const path = safePath(req.query.path);
  if (path === null) {
    return res.status(400).json({ error: 'The requested path is invalid.' });
  }
  const ref = safeRef(req.query.ref);
  if (ref === null) {
    return res.status(400).json({ error: 'The requested branch or reference is invalid.' });
  }

  const encodedPath = path ? `/${encodePath(path)}` : '';
  const query = new URLSearchParams();
  if (ref) query.set('ref', ref);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const result = await githubRequest(gh.token, `/repos/${owner.value}/${repo.value}/contents${encodedPath}${qs}`);

  if (!result.ok) {
    return res.status(result.status || 502).json(JSON.parse(JSON.stringify(classifyGithubError(result.status, result.body))));
  }

  const raw = Array.isArray(result.body) ? result.body : (result.body ? [result.body] : []);
  const entries = raw.slice(0, MAX_LISTING_ENTRIES).map((e) => ({
    name: e.name,
    path: e.path,
    type: e.type === 'dir' ? 'dir' : 'file',
    size: typeof e.size === 'number' ? e.size : 0,
    download_url: e.download_url || null
  }));

  return res.json({ currentPath: path, ref, entries });
});

/**
 * GET /api/github/repos/:owner/:repo/file?path=...&ref=...
 * Authenticated. Returns the decrypted text content of a single source file.
 * Enforces a 1 MB size cap and character cap. `ref` optionally selects a
 * branch/tag/commit (defaults to the repo default branch).
 */
router.get('/repos/:owner/:repo/file', requireAuth, async (req, res) => {
  const gh = getTokenForUser(req.session.userId);
  if (!gh) {
    return res.status(400).json({ error: 'GitHub is not connected. Connect your GitHub account first.' });
  }

  const owner = safeRepoName(req.params.owner, 'Owner');
  const repo = safeRepoName(req.params.repo, 'Repository');
  if (!owner || !repo) {
    return res.status(400).json({ error: owner ? repo.msg : owner.msg });
  }
  const path = safePath(req.query.path);
  if (path === null || !path) {
    return res.status(400).json({ error: 'A file path is required.' });
  }
  const ref = safeRef(req.query.ref);
  if (ref === null) {
    return res.status(400).json({ error: 'The requested branch or reference is invalid.' });
  }

  const encodedPath = encodePath(path);
  const query = new URLSearchParams();
  if (ref) query.set('ref', ref);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const result = await githubRequest(gh.token, `/repos/${owner.value}/${repo.value}/contents/${encodedPath}${qs}`, { raw: true });

  if (!result.ok) {
    return res.status(result.status || 502).json(JSON.parse(JSON.stringify(classifyGithubError(result.status, result.body))));
  }

  const rawText = result.rawText;
  if (rawText.length > MAX_FILE_SIZE) {
    return res.status(413).json({ error: 'This file is larger than the 1 MB limit and was not loaded.' });
  }
  if (rawText.length > MAX_CONTENT_CHARS) {
    return res.status(413).json({ error: 'This file is too large to analyze (exceeds the 500,000 character cap).' });
  }

  return res.json({ name: path.split('/').pop(), path, size: rawText.length, content: rawText });
});

/**
 * POST /api/github/disconnect
 * Authenticated. Removes the current user's GitHub connection only.
 */
router.post('/disconnect', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM github_connections WHERE user_id = ?').run(req.session.userId);
  return res.json({ disconnected: info.changes > 0 });
});

function encodePath(path) {
  return String(path).split('/').map((seg) => encodeURIComponent(seg)).join('/');
}

module.exports = router;
