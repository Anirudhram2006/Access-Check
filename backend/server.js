// Load environment variables from .env (Node >= 21.7 built-in). Falls back
// gracefully if the file is absent. Credentials are never logged or exposed.
try {
  require('node:fs').existsSync(require('node:path').join(__dirname, '.env')) && process.loadEnvFile();
} catch (envErr) {
  console.warn('Could not load .env:', envErr.message);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const { runAudit, isValidUrl } = require('./scanner');
const authRoutes = require('./auth');
const auditRoutes = require('./audit');
console.log('[AUDIT] audit.js routes loaded successfully');
const analyticsRoutes = require('./analytics');
const sourceAnalysisRoutes = require('./sourceAnalysis');
const apiAnalysisRoutes = require('./apiAnalysis');
const githubRoutes = require('./github');
const chatRoutes = require('./chat');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Generate a secure session secret at startup (not hardcoded)
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Enable Cross-Origin Resource Sharing (CORS) for front-end integration
app.use(cors({
  origin: [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://access-check-delta.vercel.app'
],
  credentials: true
}));

// Enable parsing of JSON bodies in POST requests
app.use(express.json());

// Configure session middleware
app.set('trust proxy', 1);

app.use(session({
  name: 'accesscheck.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve captured screenshots statically so the React frontend can fetch them
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Mount auth routes
app.use('/api/auth', authRoutes);

// Mount audit history routes
app.use('/api/audits', auditRoutes);

// Mount analytics routes
app.use('/api/analytics', analyticsRoutes);

// Mount source code analysis routes
app.use('/api/source-analysis', sourceAnalysisRoutes);

// Mount API / backend functionality analysis routes
app.use('/api/api-analysis', apiAnalysisRoutes);

// Mount GitHub integration routes (OAuth + repo/file browsing)
app.use('/api/github', githubRoutes);

// Mount accessibility chatbot routes
app.use('/api/chat', chatRoutes);

/**
 * Health check endpoint to verify backend status.
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok' });
});

/**
 * Authentication middleware for protected routes.
 * Checks if the user has an active session.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

/**
 * Calculates accessibility score from violations (matches frontend logic).
 */
function calculateScore(violations) {
  if (!violations || !Array.isArray(violations)) return 100;
  let penalties = 0;
  violations.forEach(v => {
    const impact = v.impact ? v.impact.toLowerCase() : 'minor';
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
 * Web Auditing Scan endpoint. Launches browser and runs accessibility scan.
 * POST /api/scan
 * Body: { "url": "https://example.com" }
 */
app.post('/api/scan', requireAuth, async (req, res) => {
  const { url } = req.body;

  // 1. Check if URL is provided
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }

  // 2. Perform simple validation upfront
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Make sure it starts with http:// or https://' });
  }

  try {
    console.log(`Starting scan request for: ${url} (user: ${req.session.userId})`);
    
    // 3. Trigger the audit runner (Puppeteer + axe-core)
    const auditResult = await runAudit(url);

    // 4. Save audit to history for the authenticated user
    try {
      const score = calculateScore(auditResult.violations);
      const auditId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO audits (id, user_id, scanned_url, score, violation_count, violations, screenshot_url, indic_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        auditId,
        req.session.userId,
        auditResult.scannedUrl,
        score,
        auditResult.violationCount,
        JSON.stringify(auditResult.violations),
        auditResult.screenshotUrl || null,
        auditResult.indicText ? JSON.stringify(auditResult.indicText) : null
      );
      console.log(`Audit saved for user ${req.session.userId}: ${auditId}`);
    } catch (saveError) {
      // Log but don't fail the scan response if saving fails
      console.error('Failed to save audit history:', saveError.message);
    }
    
    // 5. Return successful scan result
    return res.json(auditResult);
  } catch (error) {
    // 5. Catch failures and return standard error response
    console.error(`Error during scanning of ${url}:`, error.message);
    return res.status(500).json({ 
      error: error.message || 'An unexpected error occurred during the scan.'
    });
  }
});

// Start listening on the designated port
app.listen(PORT, () => {
  console.log(`Access Check Backend running on http://localhost:${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`Scan endpoint: http://localhost:${PORT}/api/scan`);
  console.log(`Auth endpoints: http://localhost:${PORT}/api/auth/*`);
});
