const PDFDocument = require('pdfkit');
const { generateAuditPDF } = require('./pdfGenerator');
const path = require('path');

const origAddPage = PDFDocument.prototype.addPage;
PDFDocument.prototype.addPage = function (...a) {
  const n = (this.bufferedPageRange && this.bufferedPageRange().count) || 0;
  const stack = new Error().stack.split('\n').slice(2, 4).join(' | ').trim();
  console.log(`[addPage] -> page ${n + 1}  caller: ${stack}`);
  return origAddPage.apply(this, a);
};

const testAudit = {
  scannedUrl: 'https://example.com/very/long/path/that/should/wrap/properly',
  score: 45,
  violations: [
    { id: 'color-contrast', impact: 'critical', help: 'Elements must have sufficient color contrast.', description: 'Long description here for color contrast. '.repeat(30) },
    { id: 'html-has-lang', impact: 'serious', help: 'html element must have a lang attribute', description: 'desc' },
    { id: 'image-alt', impact: 'critical', help: 'Images must have alternate text', description: 'desc2' }
  ],
  screenshotUrl: null,
  indicText: {
    tamil: ['வணக்கம் இது ஒரு தமிழ் சோதனை உரை ஆகும்.', 'இது இரண்டாவது வரி.' ],
    hindi: ['नमस्ते यह एक हिंदी परीक्षण पाठ है।']
  },
  createdAt: '2026-08-27T10:30:00Z'
};

generateAuditPDF(testAudit, path.join(__dirname, 'screenshots'))
  .then(buf => { require('fs').writeFileSync('debug-out.pdf', buf); console.log('DONE size', buf.length); })
  .catch(e => { console.error('ERR', e); });
