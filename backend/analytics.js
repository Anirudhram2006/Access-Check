const express = require('express');
const db = require('./db');

const router = express.Router();

/**
 * Authentication middleware for analytics routes.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

/**
 * Get common accessibility mistakes for the authenticated user.
 * GET /api/analytics/common-mistakes
 *
 * Aggregates violations across all of the user's stored audits.
 * Each violation object is counted once per audit (regardless of node count),
 * matching the violation_count stored per audit.
 */
router.get('/common-mistakes', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;

    const audits = db.prepare(`
      SELECT violations FROM audits WHERE user_id = ?
    `).all(userId);

    if (!audits || audits.length === 0) {
      return res.json({ mistakes: [], totalAudits: 0 });
    }

    // Aggregate: ruleId -> { count, impact, description, help }
    const map = {};

    for (const audit of audits) {
      let violations;
      try {
        violations = JSON.parse(audit.violations);
      } catch {
        // Skip malformed audit records
        continue;
      }

      if (!Array.isArray(violations)) continue;

      for (const v of violations) {
        if (!v || !v.id) continue;

        const ruleId = v.id;
        const impact = v.impact || 'minor';
        const description = v.description || '';
        const help = v.help || '';

        if (!map[ruleId]) {
          map[ruleId] = { count: 0, impact, description, help };
        }

        map[ruleId].count += 1;

        // Keep the highest severity as the canonical impact
        const severityOrder = { critical: 4, serious: 3, moderate: 2, minor: 1 };
        const currentSev = severityOrder[map[ruleId].impact] || 0;
        const newSev = severityOrder[impact] || 0;
        if (newSev > currentSev) {
          map[ruleId].impact = impact;
        }
      }
    }

    // Convert to sorted array
    const mistakes = Object.entries(map)
      .map(([ruleId, data]) => ({
        ruleId,
        count: data.count,
        impact: data.impact,
        description: data.description,
        help: data.help
      }))
      .sort((a, b) => b.count - a.count);

    return res.json({ mistakes, totalAudits: audits.length });
  } catch (error) {
    console.error('Error computing analytics:', error.message);
    return res.status(500).json({ error: 'Failed to compute analytics.' });
  }
});

module.exports = router;
