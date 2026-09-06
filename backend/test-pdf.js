const { generateAuditPDF } = require('./pdfGenerator');
const path = require('path');

const testAudit = {
  scannedUrl: 'https://example.com/very/long/path/that/should/wrap/properly',
  score: 45,
  violations: [
    {
      id: 'color-contrast',
      impact: 'critical',
      help: 'Elements must have sufficient color contrast for readability by users with low vision.',
      description: 'The foreground color of text elements does not have sufficient contrast against their background. Users with low vision or color blindness may not be able to read the text content. WCAG 2.1 requires a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text.',
      nodes: [
        { selector: 'div.container > p.text.highlighted', failureSummary: 'Fix the color contrast ratio between foreground and background to meet WCAG AA minimum of 4.5:1 for normal text' },
        { selector: 'a.nav-link.active:hover', failureSummary: 'Increase foreground color opacity or change background to meet contrast requirements' },
        { selector: 'button.submit[disabled]:focus', failureSummary: 'Ensure disabled buttons still have adequate contrast of at least 3:1' }
      ]
    },
    {
      id: 'html-has-lang',
      impact: 'serious',
      help: 'html element must have a lang attribute',
      description: 'Screen readers use the HTML lang attribute to load correct pronunciation dictionaries.',
      nodes: [{ selector: 'html', failureSummary: 'Add lang attribute to html element' }]
    },
    {
      id: 'image-alt',
      impact: 'critical',
      help: 'Images must have alternate text',
      description: 'When images lack alt text, screen readers cannot convey their meaning.',
      nodes: [
        { selector: 'img.hero-banner', failureSummary: 'Add descriptive alt attribute' },
        { selector: 'img.logo', failureSummary: 'Add alt attribute with company name' }
      ]
    }
  ],
  screenshotUrl: null,
  indicText: {
    tamil: [
      'வணக்கம் இது ஒரு தமிழ் சோதனை உரை ஆகும்.',
      'இது இரண்டாவது வரி தமிழ் எழுத்துக்களை காட்டுகிறது.',
      'மூன்றாவது வரியில் தமிழ் சொற்கள் முறையாக காட்டப்பட வேண்டும். இது நீண்ட வரி.'
    ],
    hindi: [
      'नमस्ते यह एक हिंदी परीक्षण पाठ है।',
      'यह दूसरी पंक्ति हिंदी अक्षरों को दर्शाती है।',
      'तीसरी पंक्ति में हिंदी शब्द ठीक से दिखाई देने चाहिए। यह एक लंबी पंक्ति है।'
    ]
  },
  createdAt: '2026-08-27T10:30:00Z'
};

console.log('Generating test PDF...');
generateAuditPDF(testAudit, path.join(__dirname, 'screenshots'))
  .then(buf => {
    const outPath = path.join(__dirname, 'test-output.pdf');
    require('fs').writeFileSync(outPath, buf);
    console.log('PDF saved to:', outPath);
    console.log('Size:', buf.length, 'bytes');
    console.log('Open this file to check the output.');
  })
  .catch(err => {
    console.error('FAILED:', err.message);
    console.error(err.stack);
  });
