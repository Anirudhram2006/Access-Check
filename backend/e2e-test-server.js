const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple local HTTP server serving test pages so Puppeteer has a real URL to
// scan without depending on external network access.
const PAGES = {
  '/a11y.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Accessibility Problems</title>
</head>
<body>
  <h1>Welcome</h1>
  <img src="logo.png">
  <button>Submit</button>
  <form>
    <input type="text">
  </form>
  <a href="#" onclick="return false;">click here</a>
  <div style="color:#cccccc;background:#ffffff;">Low contrast text</div>
</body>
</html>`,
  '/indic.html': `<!DOCTYPE html>
<html lang="en">
<head><title>Indic Test</title></head>
<body>
  <h1>English Accessibility Test</h1>
  <p>தமிழ் அணுகல்தன்மை சோதனை</p>
  <p>हिंदी अभिगम्यता परीक्षण</p>
</body>
</html>`
};

const server = http.createServer((req, res) => {
  const body = PAGES[req.url];
  if (body === undefined) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
});

server.listen(8123, '127.0.0.1', () => {
  console.log('test page server listening on http://127.0.0.1:8123');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));