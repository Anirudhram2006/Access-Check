/**
 * codeFixer.js
 *
 * Generates corrected source code from real accessibility findings produced by
 * sourceAnalyzer. The engine is deliberately conservative and deterministic:
 *
 *  - Only findings that are auto-fixable get edited. A finding is auto-fixable
 *    only when a fix can be derived verbatim from the file itself (an author
 *    supplied placeholder/name becomes an aria-label, a missing alt becomes
 *    alt="", etc.). No alt/button/label/aria text is ever invented.
 *  - Original source is never modified. Fixed content is produced as new text
 *    and the caller decides whether/how to write it.
 *  - Edits are computed against original character offsets and applied in
 *    reverse order so earlier offsets stay valid.
 *  - Fixed output is verified for tag/brace balance and scanned for sensitive
 *    content (passwords, tokens, keys, private materials).
 */

const { analyzeSourceFile, iterElements, KNOWN_ROLES } = require('./sourceAnalyzer');

const DIFF_CAP_LINES = 600;

/* HTML void tags (mirror sourceAnalyzer) — these never need closing tags. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr'
]);

/* ------------------------------------------------------------------ */
/* Fix classification                                                  */
/* ------------------------------------------------------------------ */

/**
 * Classifies a finding as 'fixable' (the engine can auto-edit it safely) or
 * 'manual' (it needs a human to supply content or judgment). Must stay in
 * sync with buildFixedFile so the label shown at analysis time matches the
 * actual engine behaviour.
 */
function classifyFix(finding) {
  if (!finding || !finding.id) return 'manual';
  const code = String(finding.code || '');
  switch (finding.id) {
    case 'html-lang':
      return 'fixable';
    case 'aria-valid-attr':
      return 'fixable';
    case 'tabindex-positive':
      return 'fixable';
    case 'image-alt':
      // role="img" + empty alt needs author-provided accessible text.
      if (/role\s*=\s*["']img["']/i.test(code)) return 'manual';
      return 'fixable';
    case 'label':
      // Fixable only when the element carries author-supplied text we can
      // reuse verbatim as an aria-label.
      if (/(placeholder|name)\s*=\s*["'][^"']+["']/.test(code)) return 'fixable';
      return 'manual';
    default:
      return 'manual';
  }
}

function escapeAttrValue(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');
}

function fixedFileName(name) {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? `${name.slice(0, idx)}-fixed${name.slice(idx)}` : `${name}-fixed`;
}

/* ------------------------------------------------------------------ */
/* Attribute helpers (operate in original source coordinates)          */
/* ------------------------------------------------------------------ */

function attrVal(raw) {
  if (raw == null) return null;
  let v = String(raw).trim();
  if (v.startsWith('{') && v.endsWith('}')) return v.slice(1, -1).trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

/**
 * Finds an attribute (name, eventual value) inside an element's raw text.
 * Returns {start, end, name, value} relative to the raw text, or null.
 */
function findAttrRaw(raw, attrName) {
  const re = new RegExp(
    `\\b(${attrName}[A-Za-z0-9:_-]*)\\s*=\\s*("[^"]*"|'[^']*'|\\{[^}]*\\}|[^\\s>]+)`,
    'i'
  );
  const m = re.exec(raw);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length, name: m[1], value: m[2] };
}

/** Adds ` attr="value"` just before the element's final `>` (or `/>`). */
function addAttributeEdit(el, attrName, attrValue) {
  // el.selfClosing from the tokenizer is unreliable (it inspects the attrs
  // slice without the trailing `>`), so detect it from the raw text instead.
  const isSelfClosing = el.selfClosing || /\/\s*>$/.test(el.raw);
  const insertAt = el.end - (isSelfClosing ? 2 : 1);
  const prev = el.raw[insertAt - el.start - 1];
  const space = prev !== undefined && !/\s/.test(prev) ? ' ' : '';
  const insertion = `${space}${attrName}="${escapeAttrValue(attrValue)}"`;
  return { start: insertAt, end: insertAt, replacement: insertion };
}

/** Replaces an attribute's value, preserving the original quote style. */
function replaceAttrEdit(el, attrRaw, newValue) {
  const valueRaw = attrRaw.value;
  if (valueRaw.startsWith('{')) {
    return { start: el.start + attrRaw.start, end: el.start + attrRaw.end, replacement: `${attrRaw.name}={${newValue}}` };
  }
  const open = valueRaw[0] === "'" ? "'" : '"';
  return {
    start: el.start + attrRaw.start,
    end: el.start + attrRaw.end,
    replacement: `${attrRaw.name}=${open}${newValue}${open}`
  };
}

/**
 * Computes a single edit (original coordinates) for one fixable finding.
 * Returns null when the rule cannot be turned into a safe, verbatim edit.
 */
function buildEditFor(rule, el) {
  switch (rule) {
    case 'image-alt':
      return addAttributeEdit(el, 'alt', '');
    case 'html-lang':
      return addAttributeEdit(el, 'lang', 'en');
    case 'tabindex-positive': {
      const attrRaw = findAttrRaw(el.raw, 'tabindex') || findAttrRaw(el.raw, 'tabIndex');
      if (!attrRaw) return null;
      return replaceAttrEdit(el, attrRaw, '0');
    }
    case 'aria-valid-attr': {
      const attrRaw = findAttrRaw(el.raw, 'role');
      if (!attrRaw) return null;
      const val = attrVal(attrRaw.value);
      const tokens = val ? val.split(/\s+/).filter(Boolean) : [];
      const good = tokens.filter(t => KNOWN_ROLES.has(t.toLowerCase()));
      if (good.length > 0) {
        return replaceAttrEdit(el, attrRaw, good.join(' '));
      }
      // No valid tokens remain — remove the whole role attribute (including its
      // leading whitespace so no double space is left behind).
      let rawStart = attrRaw.start;
      while (rawStart > 0 && /\s/.test(el.raw[rawStart - 1])) rawStart--;
      return { start: el.start + rawStart, end: el.start + attrRaw.end, replacement: '' };
    }
    case 'label': {
      const ph = findAttrRaw(el.raw, 'placeholder');
      const nm = findAttrRaw(el.raw, 'name');
      const source = ph ? attrVal(ph.value) : (nm ? attrVal(nm.value) : null);
      if (!source || !source.trim()) return null;
      return addAttributeEdit(el, 'aria-label', source.trim());
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Element matching                                                    */
/* ------------------------------------------------------------------ */

const RULE_ELEMENT_PREDICATES = {
  'image-alt': (el) => el.tag === 'img' && el.attrs['alt'] === undefined,
  'html-lang': (el) => el.tag === 'html',
  'tabindex-positive': (el) => {
    const raw = el.attrs['tabindex'] !== undefined ? el.attrs['tabindex'] : (findAttrRaw(el.raw, 'tabIndex') || {}).value;
    if (!raw) return false;
    const v = attrVal(raw);
    const n = v != null ? parseInt(v.replace(/^'+|'+$/g, '').trim(), 10) : NaN;
    return !Number.isNaN(n) && n > 0;
  },
  'aria-valid-attr': (el) => {
    if (el.attrs['role'] === undefined) return false;
    const val = attrVal(el.attrs['role']);
    const tokens = val ? val.split(/\s+/).filter(Boolean) : [];
    return tokens.some(t => !KNOWN_ROLES.has(t.toLowerCase()));
  },
  'label': (el) => ['input', 'textarea', 'select'].includes(el.tag)
};

/**
 * Finds the source element a finding refers to (same line, expected tag,
 * identical raw text). Only one finding may consume an element.
 */
function matchElement(finding, elements, used) {
  if (typeof finding.line !== 'number') return -1;
  const predicate = RULE_ELEMENT_PREDICATES[finding.id];
  if (!predicate) return -1;
  for (let i = 0; i < elements.length; i++) {
    if (used.has(i)) continue;
    const el = elements[i];
    if (el.line !== finding.line) continue;
    if (el.raw !== finding.code) continue;
    if (!predicate(el)) continue;
    return i;
  }
  // A duplicate finding of an already-consumed element (same line + code) is
  // considered covered by the same edit.
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.line !== finding.line) continue;
    if (el.raw !== finding.code) continue;
    if (predicate(el)) return i;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* Verification helpers                                                */
/* ------------------------------------------------------------------ */

/** Returns a canonical tag-balance signature of a source string. */
function tagBalanceSignature(source) {
  const re = /<(\/?)\s*([A-Za-z][A-Za-z0-9]*)\b([^>]*)>/g;
  const net = new Map();
  let m;
  while ((m = re.exec(source)) !== null) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (VOID_TAGS.has(tag)) continue;
    if (!closing && /\/\s*>$/.test(m[3])) continue; // self-closing
    net.set(tag, (net.get(tag) || 0) + (closing ? -1 : 1));
  }
  const out = [];
  for (const [tag, count] of net.entries()) {
    if (count !== 0) out.push(`${tag}:${count}`);
  }
  return out.sort().join(',');
}

function braceBalanceSignature(source) {
  return {
    curlyOpen: (source.match(/{/g) || []).length,
    curlyClose: (source.match(/}/g) || []).length,
    parenOpen: (source.match(/\(/g) || []).length,
    parenClose: (source.match(/\)/g) || []).length,
    bracketOpen: (source.match(/\[/g) || []).length,
    bracketClose: (source.match(/\]/g) || []).length
  };
}

function signaturesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Scans for obviously sensitive content (credentials/secrets) in fixed output. */
function scanSensitive(source) {
  const patterns = [
    { key: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
    { key: 'api-key', re: /\bapi[_-]?key\s*[=:]\s*["'][^"'\n]{6,}["']/i },
    { key: 'token', re: /\b(?:access[_-]?token|refresh[_-]?token|auth[_-]?token|bearer[_-]?token|session[_-]?(?:id|secret)|client[_-]?secret)\s*[=:]\s*["'][^"'\n]{6,}["']/i },
    { key: 'password', re: /\b(?:password|passwd|pwd)\s*[=:]\s*["'][^"'\n]{6,}["']/i },
    { key: 'secret', re: /\bsecret[_-]?key\s*[=:]\s*["'][^"'\n]{6,}["']/i },
    { key: 'aws', re: /\bAKIA[0-9A-Z]{16}\b/i },
    { key: 'auth-header', re: /(?:^|[;\s{])authorization\s*:\s*[\w.-]+\s+[\w\/+=]+/i },
    { key: 'env-value', re: /\b(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\s*=\s*[^\s"']{6,}/i },
    { key: 'connection-string', re: /(?:postgres(?:ql)?|mysql|mongo(?:db)?)(?:\+[a-z0-9]+)?:\/\/[^\s"']+/i }
  ];
  const found = [];
  for (const p of patterns) {
    if (p.re.test(source)) found.push(p.key);
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Line diff (for the Original vs Fixed comparison)                    */
/* ------------------------------------------------------------------ */

function computeChangedLines(before, after) {
  const a = String(before).split(/\r\n|\r|\n/);
  const b = String(after).split(/\r\n|\r|\n/);
  const empty = { originalChanged: [], fixedChanged: [] };
  if (a.length > DIFF_CAP_LINES || b.length > DIFF_CAP_LINES) return empty;

  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const steps = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { steps.push('same'); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { steps.push('removed'); i++; }
    else { steps.push('added'); j++; }
  }
  while (i < n) { steps.push('removed'); i++; }
  while (j < m) { steps.push('added'); j++; }

  const originalChanged = [];
  const fixedChanged = [];
  let oi = 1;
  let fj = 1;
  for (const step of steps) {
    if (step === 'same') { oi++; fj++; }
    else if (step === 'removed') { originalChanged.push(oi); oi++; }
    else { fixedChanged.push(fj); fj++; }
  }
  return { originalChanged, fixedChanged };
}

/* ------------------------------------------------------------------ */
/* Fixed file builder                                                  */
/* ------------------------------------------------------------------ */

function severitySummary(findings) {
  const summary = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  findings.forEach(f => {
    const sev = f.impact ? f.impact.toLowerCase() : 'minor';
    if (summary.hasOwnProperty(sev)) summary[sev]++;
    else summary.minor++;
  });
  return summary;
}

function buildFixedFile(name, content, target) {
  const ext = name.split('.').pop().toLowerCase() || '';
  const findings = analyzeSourceFile(name, content, ext);
  const elements = Array.from(iterElements(content));

  const edits = [];        // each edit carries its disposition ref
  const changes = [];      // applied fixes detail
  const manualFixes = [];  // findings that stay manual (or could not be auto-edited)
  const used = new Set();

  for (const f of findings) {
    if (classifyFix(f) !== 'fixable') {
      manualFixes.push(f);
      continue;
    }
    if (target && (target.file !== f.file || target.line !== f.line || target.id !== f.id)) {
      // Out of scope for a targeted fix — leave untouched.
      continue;
    }
    const idx = matchElement(f, elements, used);
    if (idx === -1) {
      manualFixes.push(f);
      continue;
    }
    used.add(idx);
    const el = elements[idx];
    const edit = buildEditFor(f.id, el);
    if (!edit) {
      manualFixes.push(f);
      continue;
    }
    edits.push({ ...edit, key: `${f.id}:${f.line}` });
    changes.push({
      id: f.id,
      line: f.line,
      impact: f.impact,
      description: f.description
    });
  }

  // Drop overlapping edits (keep the first by descending offset order).
  const kept = [];
  const seen = new Set();
  edits.sort((a, b) => b.start - a.start || a.end - b.end);
  for (const e of edits) {
    let overlap = false;
    for (const k of kept) {
      if (e.start < k.end && k.start < e.end) { overlap = true; break; }
    }
    if (overlap) continue;
    kept.push(e);
    seen.add(e.key);
  }
  const droppedKeys = new Set(edits.filter(e => !seen.has(e.key)).map(e => e.key));
  changes.forEach(c => {
    const key = `${c.id}:${c.line}`;
    c.applied = !droppedKeys.has(key);
  });
  const appliedChanges = changes.filter(c => c.applied);
  changes.forEach(c => { delete c.applied; });

  // Apply kept edits in reverse offset order.
  let fixedContent = content;
  for (const e of kept) {
    fixedContent = fixedContent.slice(0, e.start) + e.replacement + fixedContent.slice(e.end);
  }

  const afterFindings = analyzeSourceFile(name, fixedContent, ext);
  const diff = computeChangedLines(content, fixedContent);

  const balanced =
    signaturesEqual(tagBalanceSignature(content), tagBalanceSignature(fixedContent)) &&
    signaturesEqual(braceBalanceSignature(content), braceBalanceSignature(fixedContent));
  const sensitive = scanSensitive(fixedContent);

  return {
    name,
    ext,
    fixedFileName: fixedFileName(name),
    beforeCount: findings.length,
    afterCount: afterFindings.length,
    resolvedCount: Math.max(0, findings.length - afterFindings.length),
    fixesApplied: appliedChanges.length,
    manualCount: manualFixes.length,
    changes: appliedChanges,
    manualFixes,
    fixedContent,
    diff,
    verification: {
      balanced,
      blocked: sensitive.length > 0,
      sensitive,
      detail: !balanced ? 'The fix could not be verified as balanced and was blocked.' : 'ok'
    },
    beforeSummary: severitySummary(findings),
    afterSummary: severitySummary(afterFindings)
  };
}

/**
 * Generates fixed files (all files, or only the file matching `target`).
 */
function buildFixedResults(files, target) {
  const results = [];
  const totals = {
    files: 0,
    beforeCount: 0,
    afterCount: 0,
    resolvedCount: 0,
    manualCount: 0,
    fixesApplied: 0,
    blocked: 0
  };
  for (const file of files) {
    const res = buildFixedFile(file.name, file.content, target);
    if (target && (target.file !== res.name)) continue;
    results.push(res);
    totals.files += 1;
    totals.beforeCount += res.beforeCount;
    totals.afterCount += res.afterCount;
    totals.resolvedCount += res.resolvedCount;
    totals.manualCount += res.manualCount;
    totals.fixesApplied += res.fixesApplied;
    if (res.verification.blocked) totals.blocked += 1;
  }
  return { results, totals };
}

/**
 * Re-runs static analysis only (no edits) over already-fixed content.
 */
function reanalyzeFixedResults(files) {
  const results = [];
  let total = 0;
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase() || '';
    const findings = analyzeSourceFile(file.name, file.content, ext);
    total += findings.length;
    results.push({
      name: file.name,
      ext,
      total: findings.length,
      summary: severitySummary(findings),
      findings
    });
  }
  return { results, totals: { files: results.length, total } };
}

module.exports = {
  classifyFix,
  buildFixedResults,
  reanalyzeFixedResults,
  fixedFileName
};