const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const db = require('./db');
const { analyzeSourceFile, CATEGORY_HTML, CATEGORY_CSS } = require('./sourceAnalyzer');
const { classifyFix, buildFixedResults, reanalyzeFixedResults } = require('./codeFixer');

const router = express.Router();

/**
 * Calculates an accessibility score from source findings.
 * Mirrors the penalty weights used for website audits (server.js / score.js).
 */
function calculateScore(findings) {
  if (!findings || !Array.isArray(findings)) return 100;
  let penalties = 0;
  findings.forEach(f => {
    const impact = f && f.impact ? f.impact.toLowerCase() : 'minor';
    switch (impact) {
      case 'critical': penalties += 15; break;
      case 'serious': penalties += 8; break;
      case 'moderate': penalties += 4; break;
      default: penalties += 1; break;
    }
  });
  return Math.max(0, Math.min(100, 100 - penalties));
}

/**
 * Extracts contiguous Tamil and Devanagari (Hindi) lines from uploaded source
 * code so they can be stored and rendered correctly in the exported PDF.
 * Mirrors the semantic of the website scanner's Indic-text extraction, but is
 * purely static (no rendering or browser execution).
 */
function extractIndicFromSource(content) {
  const tamilSet = new Set();
  const hindiSet = new Set();
  const tamilRe = /[\u0B80-\u0BFF]/;
  const hindiRe = /[\u0900-\u097F]/;
  const lines = String(content).split(/\r\n|\r|\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (tamilRe.test(line)) tamilSet.add(line);
    if (hindiRe.test(line)) hindiSet.add(line);
  }
  return {
    tamil: Array.from(tamilSet).slice(0, 200),
    hindi: Array.from(hindiSet).slice(0, 200)
  };
}

/* ------------------------------------------------------------------ */
/* Config & limits                                                     */
/* ------------------------------------------------------------------ */

const MAX_FILES = 20;                  // max number of files per upload
const MAX_FILE_SIZE = 1024 * 1024;     // 1 MB per file
const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // 5 MB across all files
const MAX_CONTENT_CHARS = 500000;      // analysis cap per file (chars)

const SUPPORTED_EXT = new Set(['html', 'htm', 'jsx', 'js', 'ts', 'tsx', 'css']);
const CATEGORY_MAP = {
  html: CATEGORY_HTML,
  htm: CATEGORY_HTML,
  jsx: CATEGORY_HTML,
  js: CATEGORY_HTML,
  ts: CATEGORY_HTML,
  tsx: CATEGORY_HTML,
  css: CATEGORY_CSS
};

/**
 * Authentication middleware for the route.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

/**
 * Sanitize an uploaded file name before analysis/display:
 *  - strip directory components (both / and \)
 *  - reject path traversal, absolute paths, and hidden/system names
 *  - whitelist supported extensions
 * Returns a safe base file name, or null if the file is rejected.
 */
function sanitizeFilename(originalName) {
  if (typeof originalName !== 'string' || originalName.length === 0) return null;
  // Reject any path traversal attempt outright.
  if (originalName.includes('..') || originalName.includes('\0') || originalName.includes(':')) return null;
  const normalized = originalName.replace(/\\/g, '/').split('/').pop() || originalName;
  if (!normalized || normalized === '.' || normalized === '..') return null;
  if (normalized.startsWith('.')) return null; // hidden files
  const parts = normalized.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  if (!SUPPORTED_EXT.has(ext)) return null;
  const stem = parts.join('.').replace(/[^A-Za-z0-9_.-]/g, '_') || 'file';
  return `${stem}.${ext}`;
}

/**
 * Multer configured with in-memory storage so uploaded source code is never
 * written to disk. Strict per-file size limit, file count limit, and a
 * whitelist of supported extensions.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
    fields: 10
  },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname || '').split('.').pop().toLowerCase();
    if (!SUPPORTED_EXT.has(ext)) {
      const e = new Error(
        `Unsupported file type: ${ext || '(none)'}. Supported: HTML, JSX, JS, TS, TSX, CSS.`
      );
      e.status = 400;
      return cb(e);
    }
    cb(null, true);
  }
});

function handleUploadError(err, res) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'One or more files exceed the 1 MB per-file limit.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({ error: `Too many files. Maximum is ${MAX_FILES} files per upload.` });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FIELD_KEY') {
    return res.status(400).json({ error: 'Unexpected form field. Use the "files" field for uploads.' });
  }
  const status = err.status || 400;
  return res.status(status).json({ error: err.message || 'The upload could not be processed.' });
}

/**
 * POST /api/source-analysis
 * Content-Type: multipart/form-data, one or more files under the "files" field.
 * Authenticated only. Runs static accessibility analysis on the uploaded
 * source code and returns the findings. Uploaded content is processed in
 * memory and is never persisted to disk or the database.
 */
router.post('/', requireAuth, (req, res) => {
  upload.array('files', MAX_FILES)(req, res, (err) => {
    if (err) {
      return handleUploadError(err, res);
    }

    const files = (req.files || []).filter(f => f && f.buffer && f.size > 0);
    if (files.length === 0) {
      return res.status(400).json({
        error: 'No source files were uploaded. Select one or more HTML, JSX, JS, TS, TSX, or CSS files.'
      });
    }

    // Total size cap across all files.
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_SIZE) {
      return res.status(413).json({ error: 'Uploaded files exceed the total limit of 5 MB. Upload fewer or smaller files.' });
    }

    const analyzedFiles = [];
    const findings = [];
    const warnings = [];
    const skipped = [];

    for (const file of files) {
      const safeName = sanitizeFilename(file.originalname);
      if (!safeName) {
        skipped.push({
          name: file.originalname || 'unknown',
          reason: 'Unsafe or unsupported file name was rejected.'
        });
        continue;
      }

      const ext = safeName.split('.').pop().toLowerCase();
      const content = file.buffer.toString('utf8');

      if (content.trim().length === 0) {
        warnings.push({ file: safeName, message: 'File is empty and was skipped.' });
        continue;
      }

      // Cap the amount of source that is analyzed per file.
      let analyzedContent = content;
      if (content.length > MAX_CONTENT_CHARS) {
        analyzedContent = content.slice(0, MAX_CONTENT_CHARS);
      }

      let fileFindings = [];
      try {
        fileFindings = analyzeSourceFile(safeName, analyzedContent, ext);
      } catch (analysisError) {
        console.error(`[sourceAnalysis] analysis failed for ${safeName}:`, analysisError.message);
        warnings.push({ file: safeName, message: 'Analysis failed and this file was skipped.' });
        continue;
      }

      findings.push(...fileFindings);
      analyzedFiles.push({
        name: safeName,
        type: ext,
        size: file.size,
        issues: fileFindings.length,
        // Original uploaded source, exactly as provided (plain utf-8 text).
        // Returned so the UI can render the unmodified ORIGINAL CODE. It is
        // never persisted to the database — only the findings/summary are saved.
        content
      });
    }

    // Prefer determinism: sort by (file, line).
    findings.sort((a, b) => {
      const fa = String(a.file).toLowerCase();
      const fb = String(b.file).toLowerCase();
      if (fa !== fb) return fa < fb ? -1 : 1;
      const la = (typeof a.line === 'number' ? a.line : Number.MAX_SAFE_INTEGER);
      const lb = (typeof b.line === 'number' ? b.line : Number.MAX_SAFE_INTEGER);
      return la - lb;
    });

    // Annotate each finding with whether the code fixer can auto-edit it, so
    // the UI can offer "Change Code" for safe fixes and flag manual work.
    findings.forEach(f => {
      f.fixStatus = classifyFix(f);
    });
    const fixSummary = { fixable: 0, manual: 0 };
    findings.forEach(f => {
      if (f.fixStatus === 'fixable') fixSummary.fixable++;
      else fixSummary.manual++;
    });

    // Severity summary.
    const summary = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    findings.forEach(f => {
      const sev = f.impact ? f.impact.toLowerCase() : 'minor';
      if (summary.hasOwnProperty(sev)) summary[sev]++;
      else summary.minor++;
    });

    // Persist the analysis to the authenticated user's audit history so it
    // appears alongside website audits. Stored data is the analysis result
    // (findings, score, file list, extracted Indic text) — not the raw source.
    let saved = false;
    let auditId = null;
    if (analyzedFiles.length > 0) {
      try {
        auditId = crypto.randomUUID();
        const indicText = extractIndicFromSource(
          files.map(f => f.buffer.toString('utf8')).join('\n')
        );
        db.prepare(`
          INSERT INTO audits
            (id, user_id, scanned_url, score, violation_count, violations,
             screenshot_url, indic_text, audit_type, source_files)
          VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
        `).run(
          auditId,
          req.session.userId,
          analyzedFiles[0].name,
          calculateScore(findings),
          findings.length,
          JSON.stringify(findings),
          JSON.stringify(indicText),
          'source-code',
          JSON.stringify(analyzedFiles)
        );
        saved = true;
        console.log(`Source analysis saved for user ${req.session.userId}: ${auditId} (${analyzedFiles.length} file(s), ${findings.length} issue(s))`);
      } catch (saveError) {
        // Log but do not fail the analysis response if history saving fails.
        console.error('Failed to save source analysis to history:', saveError.message);
      }
    }

    return res.json({
      files: analyzedFiles,
      findings,
      summary,
      total: findings.length,
      fixSummary,
      warnings,
      skipped,
      analyzedAt: new Date().toISOString(),
      saved,
      auditId
    });
  });
});

/* ------------------------------------------------------------------ */
/* Automatic Code Fix (Change Code) endpoints                          */
/* ------------------------------------------------------------------ */

/**
 * POST /api/source-analysis/fix
 * Content-Type: application/json. Authenticated only.
 * Body: { files: [{ name, content }], target?: { file, line, id } }
 *
 * Generates corrected code from the actual findings, applies only safe,
 * verbatim-derivable edits, verifies tag/brace balance, and scans the fixed
 * output for sensitive content. Original source is never modified or stored —
 * the caller receives the fixed text and decides whether to download it.
 */
router.post('/fix', requireAuth, (req, res) => {
  const { files, target } = req.body || {};

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files were provided to fix.' });
  }
  if (files.length > MAX_FILES) {
    return res.status(400).json({ error: `Too many files. Maximum is ${MAX_FILES} files per request.` });
  }
  if (target && (typeof target !== 'object' || typeof target.file !== 'string' || typeof target.id !== 'string' || target.line == null)) {
    return res.status(400).json({ error: 'Invalid fix target. Expected { file, line, id }.' });
  }

  const inputs = [];
  for (const f of files) {
    if (!f || typeof f.content !== 'string') {
      return res.status(400).json({ error: 'Each file must include its text content.' });
    }
    const safeName = sanitizeFilename(String(f.name));
    if (!safeName) {
      return res.status(400).json({ error: `Unsupported or unsafe file name: ${String(f && f.name) || '(none)'}.` });
    }
    if (f.content.length > MAX_CONTENT_CHARS) {
      return res.status(413).json({ error: `${safeName} exceeds the 500,000 character analysis cap.` });
    }
    if (f.content.trim().length === 0) {
      return res.status(400).json({ error: `${safeName} is empty and cannot be fixed.` });
    }
    inputs.push({ name: safeName, content: String(f.content) });
  }

  try {
    const { results, totals } = buildFixedResults(inputs, target || null);
    return res.json({ results, totals, analyzedAt: new Date().toISOString() });
  } catch (fixError) {
    console.error('[sourceAnalysis] fix failed:', fixError.message);
    return res.status(500).json({ error: 'The code could not be generated. No files were changed.' });
  }
});

/* ------------------------------------------------------------------ */
/* Fixed-file download endpoint                                        */
/* ------------------------------------------------------------------ */

/**
 * Maps a source extension to an appropriate HTTP Content-Type for download.
 */
function contentTypeFor(ext) {
  switch (String(ext || '').toLowerCase()) {
    case 'html':
    case 'htm':
      return 'text/html; charset=utf-8';
    case 'css':
      return 'text/css; charset=utf-8';
    case 'js':
      return 'text/javascript; charset=utf-8';
    case 'jsx':
    case 'ts':
    case 'tsx':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

/**
 * POST /api/source-analysis/download
 * Content-Type: application/json. Authenticated only.
 * Body: { files: [{ name, content }], target?: { file, line, id } }
 *
 * Re-generates the corrected source server-side (using the exact same engine
 * as /fix) and streams it back as a file download. This guarantees the
 * downloaded file contains the real, verified fix rather than trusting the
 * client.
 *
 * Ownership: the endpoint only ever operates on source data supplied by the
 * caller within their own authenticated session. No user id is accepted from
 * the client, no file names/paths are looked up server-side, and no persisted
 * per-user file store exists — so a user cannot reference or download another
 * user's fixed source. Responses:
 *   - 401 for unauthenticated requests
 *   - 400 for malformed input
 *   - 404 when the requested fixed file cannot be produced
 *   - 422 when the generated content is blocked (e.g. sensitive material)
 */
router.post('/download', requireAuth, (req, res) => {
  const { files, target } = req.body || {};

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files were provided to download.' });
  }
  if (files.length > MAX_FILES) {
    return res.status(400).json({ error: `Too many files. Maximum is ${MAX_FILES} files per request.` });
  }
  if (target && (typeof target !== 'object' || typeof target.file !== 'string' || typeof target.id !== 'string' || target.line == null)) {
    return res.status(400).json({ error: 'Invalid fix target. Expected { file, line, id }.' });
  }

  const inputs = [];
  for (const f of files) {
    if (!f || typeof f.content !== 'string') {
      return res.status(400).json({ error: 'Each file must include its text content.' });
    }
    const safeName = sanitizeFilename(String(f.name));
    if (!safeName) {
      return res.status(400).json({ error: `Unsupported or unsafe file name: ${String(f && f.name) || '(none)'}.` });
    }
    if (f.content.length > MAX_CONTENT_CHARS) {
      return res.status(413).json({ error: `${safeName} exceeds the 500,000 character analysis cap.` });
    }
    if (f.content.trim().length === 0) {
      return res.status(400).json({ error: `${safeName} is empty and cannot be fixed.` });
    }
    inputs.push({ name: safeName, content: String(f.content) });
  }

  try {
    const { results } = buildFixedResults(inputs, target || null);
    const targetFile = target && target.file ? String(target.file) : null;
    const match = results.find(r =>
      targetFile ? r.name === targetFile : true
    );
    if (!match) {
      return res.status(404).json({ error: 'The requested fixed file could not be generated.' });
    }
    if (match.verification && match.verification.blocked) {
      return res.status(422).json({
        error: 'Download blocked: sensitive content was detected in the fixed file.',
        detail: match.verification.sensitive || []
      });
    }
    const filename = match.fixedFileName;
    res.setHeader('Content-Type', contentTypeFor(match.ext));
    // Use a safe, server-derived filename; never the raw client name or a path.
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(match.fixedContent);
  } catch (fixError) {
    console.error('[sourceAnalysis] download failed:', fixError.message);
    return res.status(500).json({ error: 'The file could not be generated for download.' });
  }
});

/**
 * POST /api/source-analysis/reanalyze
 * Content-Type: application/json. Authenticated only.
 * Body: { files: [{ name, content }] }
 *
 * Re-runs static analysis (no edits) over already-fixed content so the UI can
 * show real before/after numbers. Nothing is persisted.
 */
router.post('/reanalyze', requireAuth, (req, res) => {
  const { files } = req.body || {};

  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files were provided to re-analyze.' });
  }
  if (files.length > MAX_FILES) {
    return res.status(400).json({ error: `Too many files. Maximum is ${MAX_FILES} files per request.` });
  }

  const inputs = [];
  for (const f of files) {
    if (!f || typeof f.content !== 'string') {
      return res.status(400).json({ error: 'Each file must include its text content.' });
    }
    const safeName = sanitizeFilename(String(f.name));
    if (!safeName) {
      return res.status(400).json({ error: `Unsupported or unsafe file name: ${String(f && f.name) || '(none)'}.` });
    }
    if (f.content.length > MAX_CONTENT_CHARS) {
      return res.status(413).json({ error: `${safeName} exceeds the 500,000 character analysis cap.` });
    }
    inputs.push({ name: safeName, content: String(f.content) });
  }

  try {
    const { results, totals } = reanalyzeFixedResults(inputs);
    return res.json({ results, totals, analyzedAt: new Date().toISOString() });
  } catch (reanalyzeError) {
    console.error('[sourceAnalysis] re-analyze failed:', reanalyzeError.message);
    return res.status(500).json({ error: 'The fixed code could not be re-analyzed.' });
  }
});

module.exports = router;
