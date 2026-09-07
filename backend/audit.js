const express = require('express');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const { generateAuditPDF, generateSourceCodePDF } = require('./pdfGenerator');

const router = express.Router();

/**
 * Authentication middleware for audit routes.
 */
function requireAuth(req, res, next) {
  console.log('[PDF/AUTH] requireAuth:', {
    path: req.path,
    userId: req.session?.userId || null,
    sessionId: req.sessionID || null
  });

  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  next();
}

/**
 * Save a completed audit for the authenticated user.
 * POST /api/audits
 * Body: { scannedUrl, score, violationCount, violations, screenshotUrl, indicText, auditType, sourceFiles }
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const { scannedUrl, score, violationCount, violations, screenshotUrl, indicText, auditType, sourceFiles } = req.body;

    if (!scannedUrl || score === undefined || violationCount === undefined || !violations) {
      return res.status(400).json({ error: 'Missing required audit fields.' });
    }

    const auditId = crypto.randomUUID();
    const userId = req.session.userId;
    const type = auditType === 'source-code' ? 'source-code' : 'website';

    db.prepare(`
      INSERT INTO audits (id, user_id, scanned_url, score, violation_count, violations, screenshot_url, indic_text, audit_type, source_files)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditId,
      userId,
      scannedUrl,
      score,
      violationCount,
      JSON.stringify(violations),
      screenshotUrl || null,
      indicText ? JSON.stringify(indicText) : null,
      type,
      sourceFiles && Array.isArray(sourceFiles) ? JSON.stringify(sourceFiles) : null
    );

    return res.status(201).json({
      id: auditId,
      scannedUrl,
      score,
      violationCount,
      auditType: type,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving audit:', error.message);
    return res.status(500).json({ error: 'Failed to save audit.' });
  }
});

/**
 * Get all audits for the authenticated user (most recent first).
 * GET /api/audits
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;

    const audits = db.prepare(`
      SELECT id, scanned_url, score, violation_count, screenshot_url, created_at, audit_type, source_files
      FROM audits
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    const safeAudits = audits.map(a => {
      let sourceFiles = null;
      if (a.source_files) {
        try {
          sourceFiles = JSON.parse(a.source_files);
        } catch {
          sourceFiles = null;
        }
      }
      return {
        id: a.id,
        scanned_url: a.scanned_url,
        score: a.score,
        violation_count: a.violation_count,
        screenshot_url: a.screenshot_url,
        created_at: a.created_at,
        audit_type: a.audit_type || 'website',
        source_files: sourceFiles
      };
    });

    return res.json({ audits: safeAudits });
  } catch (error) {
    console.error('Error fetching audits:', error.message);
    return res.status(500).json({ error: 'Failed to fetch audit history.' });
  }
});

/**
 * Export a single audit as PDF (with ownership check).
 * GET /api/audits/:id/pdf
 */
router.get('/:id/pdf', requireAuth, async (req, res) => {
  console.log('[PDF] PDF route reached:', req.params.id);
  try {
    const userId = req.session.userId;
    const auditId = req.params.id;

    const audit = db.prepare(`
      SELECT id, user_id, scanned_url, score, violation_count, violations, screenshot_url, indic_text, created_at, audit_type, source_files
      FROM audits
      WHERE id = ?
    `).get(auditId);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found.' });
    }

    if (audit.user_id !== userId) {
      return res.status(403).json({ error: 'You do not have access to this audit.' });
    }

    let violations = [];
    try {
      violations = JSON.parse(audit.violations);
    } catch {
      violations = [];
    }

    let indicText = null;
    if (audit.indic_text) {
      try {
        indicText = JSON.parse(audit.indic_text);
      } catch {
        indicText = null;
      }
    }

    let sourceFiles = null;
    if (audit.source_files) {
      try {
        sourceFiles = JSON.parse(audit.source_files);
      } catch {
        sourceFiles = null;
      }
    }

    const auditType = audit.audit_type || 'website';
    const screenshotsDir = path.join(__dirname, 'screenshots');
    let pdfBuffer;
    let safeName;

    if (auditType === 'source-code') {
      const auditData = {
        auditType: 'source-code',
        sourceFiles: Array.isArray(sourceFiles) ? sourceFiles : [],
        score: audit.score,
        violations,
        indicText,
        createdAt: audit.created_at
      };
      pdfBuffer = await generateSourceCodePDF(auditData, screenshotsDir);
      const primaryName = Array.isArray(sourceFiles) && sourceFiles.length > 0
        ? sourceFiles[0].name
        : 'source-analysis';
      safeName = primaryName
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .substring(0, 60);
      safeName = `access-check-source-report-${safeName}`;
    } else {
      const auditData = {
        scannedUrl: audit.scanned_url,
        score: audit.score,
        violations,
        screenshotUrl: audit.screenshot_url,
        indicText,
        createdAt: audit.created_at
      };
      pdfBuffer = await generateAuditPDF(auditData, screenshotsDir);
      const safeUrl = audit.scanned_url
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .substring(0, 60);
      safeName = `access-check-report-${safeUrl}`;
    }

    const filename = `${safeName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
 } catch (error) {
    console.error('[PDF] Failed to generate PDF report:', error);
    return res.status(500).json({
        error: 'Failed to generate PDF report.'
    });
}
});

/**
 * Get a single audit by ID (with ownership check).
 * GET /api/audits/:id
 */
router.get('/:id', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const auditId = req.params.id;

    const audit = db.prepare(`
      SELECT id, user_id, scanned_url, score, violation_count, violations, screenshot_url, indic_text, created_at, audit_type, source_files
      FROM audits
      WHERE id = ?
    `).get(auditId);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found.' });
    }

    if (audit.user_id !== userId) {
      return res.status(403).json({ error: 'You do not have access to this audit.' });
    }

    let violations = [];
    try {
      violations = JSON.parse(audit.violations);
    } catch {
      violations = [];
    }

    let sourceFiles = null;
    if (audit.source_files) {
      try {
        sourceFiles = JSON.parse(audit.source_files);
      } catch {
        sourceFiles = null;
      }
    }

    return res.json({
      id: audit.id,
      scannedUrl: audit.scanned_url,
      score: audit.score,
      violationCount: audit.violation_count,
      violations,
      screenshotUrl: audit.screenshot_url,
      indicText: audit.indic_text ? JSON.parse(audit.indic_text) : null,
      createdAt: audit.created_at,
      auditType: audit.audit_type || 'website',
      sourceFiles: sourceFiles
    });
  } catch (error) {
    console.error('Error fetching audit:', error.message);
    return res.status(500).json({ error: 'Failed to fetch audit.' });
  }
});

module.exports = router;
