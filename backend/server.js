const express = require('express');
const cors = require('cors');
const path = require('path');
const { runAudit, isValidUrl } = require('./scanner');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing (CORS) for front-end integration
app.use(cors());

// Enable parsing of JSON bodies in POST requests
app.use(express.json());

// Serve captured screenshots statically so the React frontend can fetch them
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

/**
 * Health check endpoint to verify backend status.
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok' });
});

/**
 * Web Auditing Scan endpoint. Launches browser and runs accessibility scan.
 * POST /api/scan
 * Body: { "url": "https://example.com" }
 */
app.post('/api/scan', async (req, res) => {
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
    console.log(`Starting scan request for: ${url}`);
    
    // 3. Trigger the audit runner (Puppeteer + axe-core)
    const auditResult = await runAudit(url);
    
    // 4. Return successful scan result
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
});
