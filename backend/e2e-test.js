/* eslint-disable */
/**
 * End-to-end API tests for Access Check Source Code Analysis integration.
 * Requires the backend running on http://localhost:5000.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = 'http://localhost:5000';
const LOCAL_SITE = 'http://127.0.0.1:8123';
const TMP = 'C:/Users/user/AppData/Local/Temp/opencode';
const VERIFY = 'C:/Users/user/AppData/Local/Temp/opencode/verify_e2e_pdf.py';

let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, label, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    failures.push(label + (extra ? ` :: ${extra}` : ''));
    console.log(`  FAIL: ${label}${extra ? ` :: ${extra}` : ''}`);
  }
}

async function req(method, urlPath, { body, cookie, rawBody, headers = {}, asBuffer = false } = {}) {
  const opts = { method, headers: { ...headers } };
  if (cookie) opts.headers.Cookie = cookie.indexOf('=') === -1 ? `accesscheck.sid=${cookie}` : cookie;
  if (rawBody !== undefined) {
    opts.headers['Content-Type'] = headers['Content-Type'] || 'application/octet-stream';
    opts.body = rawBody;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + urlPath, opts);
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const setCookie = res.headers.get('set-cookie');
  const ct = res.headers.get('content-type') || '';
  let data;
  if (asBuffer || ct.includes('application/pdf')) {
    data = await res.arrayBuffer();
  } else {
    data = await res.json().catch(() => null);
  }
  return { status: res.status, data, setCookie, setCookies, ct };
}

function grabCookie(setCookie, setCookies) {
  const all = (setCookies && setCookies.length ? setCookies : (setCookie ? [setCookie] : []));
  for (const s of all) {
    const m = /accesscheck\.sid=([^;]+)/.exec(s);
    if (m) return m[1];
  }
  return null;
}

function multipart(files) {
  const boundary = '----accesscheck-e2e-' + Date.now();
  const chunks = [];
  for (const [name, content] of files) {
    chunks.push(`--${boundary}\r\n`);
    chunks.push(`Content-Disposition: form-data; name="files"; filename="${name}"\r\n`);
    chunks.push(`Content-Type: text/plain\r\n\r\n`);
    chunks.push(content);
    chunks.push('\r\n');
  }
  chunks.push(`--${boundary}--\r\n`);
  return {
    body: chunks.join(''),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

function verifyPdf(pdfPath, expect, rtype, expectIndic) {
  const args = [VERIFY, pdfPath, expect, rtype];
  if (expectIndic) args.push('1');
  return execSync(`python ${args.map(a => '"' + a + '"').join(' ')}`, { encoding: 'utf8' });
}

(async () => {
  const stamp = Date.now();

  // ------------------------------------------------------------------
  // Register users A and B
  // ------------------------------------------------------------------
  console.log('\n== Register User A ==');
  const regA = await req('POST', '/api/auth/register', {
    body: { name: 'UserA', email: `e2e-a-${stamp}@test.com`, password: 'password123', confirmPassword: 'password123' }
  });
  ok(regA.status === 201, 'User A registered', `status=${regA.status}`);
  const cookieA = grabCookie(regA.setCookie, regA.setCookies);

  console.log('\n== Register User B ==');
  const regB = await req('POST', '/api/auth/register', {
    body: { name: 'UserB', email: `e2e-b-${stamp}@test.com`, password: 'password123', confirmPassword: 'password123' }
  });
  ok(regB.status === 201, 'User B registered', `status=${regB.status}`);
  const cookieB = grabCookie(regB.setCookie, regB.setCookies);

  // ------------------------------------------------------------------
  // Logged-out failure tests
  // ------------------------------------------------------------------
  console.log('\n== Logged-out failure tests ==');
  let r = await req('GET', '/api/audits');
  ok(r.status === 401, 'Logged-out GET /api/audits -> 401', `status=${r.status}`);
  r = await req('POST', '/api/source-analysis', {
    rawBody: multipart([['x.html', '<html><body></body></html>']]).body,
    headers: { 'Content-Type': multipart([['x.html', 'x']]).contentType }
  });
  ok(r.status === 401, 'Logged-out POST /api/source-analysis -> 401', `status=${r.status}`);
  r = await req('GET', `/api/audits/does-not-exist`);
  ok(r.status === 401, 'Logged-out GET audit detail -> 401');

  // ------------------------------------------------------------------
  // Invalid upload tests (authenticated)
  // ------------------------------------------------------------------
  console.log('\n== Invalid upload tests (User A) ==');
  let up = multipart([['evil.exe', 'MZ...']]);
  r = await req('POST', '/api/source-analysis', { rawBody: up.body, cookie: cookieA, headers: { 'Content-Type': up.contentType } });
  ok(r.status === 400, 'Unsupported file type -> 400', `status=${r.status}, body=${JSON.stringify(r.data)}`);

  up = multipart([['empty.html', '   \n  ']]);
  r = await req('POST', '/api/source-analysis', { rawBody: up.body, cookie: cookieA, headers: { 'Content-Type': up.contentType } });
  ok(r.status === 200 && Array.isArray(r.data.warnings) && r.data.warnings.length === 1, 'Empty file -> skipped with warning', JSON.stringify(r.data));

  up = multipart([['../traversal.html', '<html><body>hi</body></html>']]);
  r = await req('POST', '/api/source-analysis', { rawBody: up.body, cookie: cookieA, headers: { 'Content-Type': up.contentType } });
  ok(r.status === 200, 'Path traversal filename -> handled without error', `status=${r.status}`);
  const analyzedNames = (r.data.files || []).map(f => f.name);
  ok(analyzedNames.every(n => !String(n).includes('..') && !String(n).includes('/') && !String(n).includes('\\')), 'No path components survive in analyzed file names', JSON.stringify(analyzedNames));

  // ------------------------------------------------------------------
  // TEST 2: Source code analysis (Phase 12 flow)
  // ------------------------------------------------------------------
  console.log('\n== Source code analysis (real file with a11y problems) ==');
  const testHtml = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '    <title>Test Accessibility</title>',
    '</head>',
    '<body>',
    '',
    '    <img src="logo.png">',
    '',
    '    <button>Submit</button>',
    '',
    '    <form>',
    '        <input type="text">',
    '    </form>',
    '',
    '</body>',
    '</html>'
  ].join('\n');

  up = multipart([['testpage.html', testHtml]]);
  r = await req('POST', '/api/source-analysis', { rawBody: up.body, cookie: cookieA, headers: { 'Content-Type': up.contentType } });
  ok(r.status === 200, 'Analysis request returns 200', `status=${r.status}`);
  ok(r.data && Array.isArray(r.data.findings) && r.data.findings.length >= 4, 'Real findings returned', `count=${r.data && r.data.findings && r.data.findings.length}`);
  ok(!!r.data.summary && typeof r.data.summary.serious === 'number', 'Severity summary present');
  ok(r.data.total > 0, 'Issue count > 0 (' + r.data.total + ')');
  ok(r.data.files && r.data.files.length === 1 && r.data.files[0].name === 'testpage.html', 'Analyzed file listed');
  ok(r.data.saved === true, 'Analysis auto-saved to history (saved=true)');
  const srcAuditId = r.data.auditId;
  ok(!!srcAuditId, 'auditId returned');

  const hasLabel = r.data.findings.some(f => f.id === 'label');
  const hasImageAlt = r.data.findings.some(f => f.id === 'image-alt');
  const hasLang = r.data.findings.some(f => f.id === 'html-lang');
  ok(hasLabel && hasImageAlt && hasLang, 'Findings include label/image-alt/html-lang rules');
  const labelFinding = r.data.findings.find(f => f.id === 'label');
  ok(labelFinding && typeof labelFinding.line === 'number' && labelFinding.line > 0, 'Finding has line number', `line=${labelFinding && labelFinding.line}`);
  ok(labelFinding && labelFinding.fix && labelFinding.fix.length > 0, 'Finding has recommended fix');
  ok(labelFinding && labelFinding.description && labelFinding.description.length > 0, 'Finding has explanation');
  ok(labelFinding && labelFinding.help && labelFinding.help.length > 0, 'Finding has title/help');
  ok(labelFinding && labelFinding.code && labelFinding.code.includes('<input'), 'Finding has code snippet');

  // ------------------------------------------------------------------
  // History list after source analysis
  // ------------------------------------------------------------------
  console.log('\n== History list (User A) ==');
  r = await req('GET', '/api/audits', { cookie: cookieA });
  ok(r.status === 200, 'GET /api/audits -> 200');
  const list = r.data.audits;
  ok(Array.isArray(list), 'audits array returned');
  const srcRecord = list.find(a => a.id === srcAuditId);
  ok(!!srcRecord, 'Source analysis record present in history');
  ok(srcRecord && srcRecord.audit_type === 'source-code', 'Record identified as source-code');
  ok(srcRecord && Array.isArray(srcRecord.source_files) && srcRecord.source_files[0].name === 'testpage.html', 'source_files listed in history');
  ok(srcRecord && typeof srcRecord.score === 'number', 'Record has score');

  // ------------------------------------------------------------------
  // Detail (stored, no re-analysis)
  // ------------------------------------------------------------------
  console.log('\n== Source analysis detail ==');
  r = await req('GET', `/api/audits/${srcAuditId}`, { cookie: cookieA });
  ok(r.status === 200, 'GET detail -> 200');
  ok(r.data && r.data.auditType === 'source-code', 'Detail returns auditType=source-code');
  ok(r.data && Array.isArray(r.data.violations) && r.data.violations.length === r.data.violationCount, 'Stored findings match violation count');
  ok(r.data && r.data.violations[0] && r.data.violations[0].fix, 'Stored finding contains fix suggestion');
  ok(r.data && r.data.sourceFiles && r.data.sourceFiles.length === 1, 'Detail returns sourceFiles');

  // ------------------------------------------------------------------
  // PDF export for source analysis
  // ------------------------------------------------------------------
  console.log('\n== Source analysis PDF export ==');
  r = await req('GET', `/api/audits/${srcAuditId}/pdf`, { cookie: cookieA, asBuffer: true });
  ok(r.status === 200, 'PDF endpoint -> 200', `status=${r.status}`);
  ok(r.ct.includes('application/pdf'), 'Content-Type is application/pdf', r.ct);
  const buf = Buffer.from(r.data);
  const pdfPath = `${TMP}/e2e-source-report.pdf`;
  fs.writeFileSync(pdfPath, buf);
  ok(buf.length > 5000, `PDF buffer size ${buf.length} bytes (non-empty)`);
  ok(buf.slice(0, 5).toString('latin1') === '%PDF-', 'PDF magic header present');

  console.log('\n== PDF content verification (PyMuPDF) ==');
  const pyOut = verifyPdf(pdfPath, 'testpage.html', 'source', false);
  console.log(pyOut.trim().split('\n').map(l => '    ' + l).join('\n'));
  ok(pyOut.includes('PDF_TEXT_OK'), 'Source report text present in PDF');
  ok(pyOut.includes('PDF_INK_OK'), 'No content outside page bounds');

  // ------------------------------------------------------------------
  // TEST 1: Website audit (real scan via Puppeteer + axe-core)
  // ------------------------------------------------------------------
  console.log('\n== Website audit (real scan via Puppeteer + axe-core) ==');
  r = await req('POST', '/api/scan', { body: { url: `${LOCAL_SITE}/a11y.html` }, cookie: cookieA });
  ok(r.status === 200, 'Website scan -> 200', `status=${r.status}`);
  ok(r.data && Array.isArray(r.data.violations) && r.data.violations.length > 0, 'Website violations returned', `count=${r.data && r.data.violations && r.data.violations.length}`);
  ok(!!r.data.screenshotUrl, 'Screenshot generated');

  r = await req('GET', '/api/audits', { cookie: cookieA });
  const webRecord = r.data.audits.find(a => a.scanned_url === `${LOCAL_SITE}/a11y.html`);
  ok(!!webRecord, 'Website audit saved to history');
  ok(webRecord && webRecord.audit_type === 'website', 'Website record identified as website');
  ok(webRecord && webRecord.violation_count > 0, 'Website violation count > 0');

  // Website PDF regression
  r = await req('GET', `/api/audits/${webRecord.id}/pdf`, { cookie: cookieA, asBuffer: true });
  ok(r.status === 200 && Buffer.from(r.data).length > 5000 && Buffer.from(r.data).slice(0, 5).toString('latin1') === '%PDF-', 'Website PDF export still works');
  const webPdfPath = `${TMP}/e2e-website-report.pdf`;
  fs.writeFileSync(webPdfPath, Buffer.from(r.data));
  const pyWeb = verifyPdf(webPdfPath, `${LOCAL_SITE}/a11y.html`, 'website', false);
  console.log(pyWeb.trim().split('\n').map(l => '    ' + l).join('\n'));
  ok(pyWeb.includes('PDF_TEXT_OK'), 'Website report text present in PDF');
  ok(pyWeb.includes('PDF_INK_OK'), 'Website PDF content in bounds');

  // ------------------------------------------------------------------
  // TEST: Indic text (Tamil + Hindi) source analysis
  // ------------------------------------------------------------------
  console.log('\n== Indic text (Tamil + Hindi) source analysis ==');
  const indicHtml = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '    <title>Indic Test</title>',
    '</head>',
    '<body>',
    '    <h1>English Accessibility Test</h1>',
    '    <p>தமிழ் அணுகல்தன்மை சோதனை</p>',
    '    <p>हिंदी अभिगम्यता परीक्षण</p>',
    '    <img src="logo.png">',
    '</body>',
    '</html>'
  ].join('\n');

  up = multipart([['indic-test.html', indicHtml]]);
  r = await req('POST', '/api/source-analysis', { rawBody: up.body, cookie: cookieA, headers: { 'Content-Type': up.contentType } });
  ok(r.status === 200 && r.data.saved === true, 'Indic source analysis saved');
  const indicAuditId = r.data.auditId;
  ok(r.data.findings.some(f => f.id === 'image-alt'), 'Indic file still analyzed for real issues');

  r = await req('GET', `/api/audits/${indicAuditId}`, { cookie: cookieA });
  ok(r.data && r.data.indicText && r.data.indicText.tamil.some(l => l.includes('தமிழ் அணுகல்தன்மை சோதனை')), 'Tamil text extracted & stored');
  ok(r.data && r.data.indicText && r.data.indicText.hindi.some(l => l.includes('हिंदी अभिगम्यता परीक्षण')), 'Hindi text extracted & stored');

  r = await req('GET', `/api/audits/${indicAuditId}/pdf`, { cookie: cookieA, asBuffer: true });
  ok(r.status === 200, 'Indic source PDF generated');
  const indicPdfPath = `${TMP}/e2e-indic-source-report.pdf`;
  fs.writeFileSync(indicPdfPath, Buffer.from(r.data));

  const pyIndic = verifyPdf(indicPdfPath, 'indic-test.html', 'source', true);
  console.log(pyIndic.trim().split('\n').map(l => '    ' + l).join('\n'));
  ok(pyIndic.includes('PDF_TEXT_OK'), 'Indic source report text present in PDF');
  ok(pyIndic.includes('PDF_INK_OK'), 'Indic PDF content in bounds');
  ok(pyIndic.includes('INDIC_DRAWINGS:'), 'Indic glyph drawing paths present');

  // ------------------------------------------------------------------
  // Website scan of Indic page + PDF (regression for website PDF)
  // ------------------------------------------------------------------
  console.log('\n== Website Indic scan + PDF regression ==');
  r = await req('POST', '/api/scan', { body: { url: `${LOCAL_SITE}/indic.html` }, cookie: cookieA });
  ok(r.status === 200, 'Indic website scan -> 200');
  r = await req('GET', '/api/audits', { cookie: cookieA });
  const indicWebRecord = r.data.audits.find(a => a.scanned_url === `${LOCAL_SITE}/indic.html`);
  ok(!!indicWebRecord, 'Indic website audit saved');
  r = await req('GET', `/api/audits/${indicWebRecord.id}/pdf`, { cookie: cookieA, asBuffer: true });
  ok(r.status === 200 && Buffer.from(r.data).length > 5000, 'Indic website PDF generated');
  const indicWebPdfPath = `${TMP}/e2e-indic-website.pdf`;
  fs.writeFileSync(indicWebPdfPath, Buffer.from(r.data));
  const pyIndicWeb = verifyPdf(indicWebPdfPath, `${LOCAL_SITE}/indic.html`, 'website', false);
  console.log(pyIndicWeb.trim().split('\n').map(l => '    ' + l).join('\n'));
  ok(pyIndicWeb.includes('PDF_TEXT_OK') && pyIndicWeb.includes('PDF_INK_OK'), 'Indic website PDF text + bounds verified');

  // ------------------------------------------------------------------
  // TEST: Multiple source records (Files A and B) stay separate
  // ------------------------------------------------------------------
  console.log('\n== Multiple source records ==');
  up = multipart([['srcA.html', '<html>\n<body>\n<img src="a.png">\n</body>\n</html>']]);
  r = await req('POST', '/api/source-analysis', { rawBody: up.body, cookie: cookieA, headers: { 'Content-Type': up.contentType } });
  const idA = r.data.auditId;
  up = multipart([['srcB.jsx', 'const App = () => <div onClick={() => {}}>Hi</div>;']]);
  r = await req('POST', '/api/source-analysis', { rawBody: up.body, cookie: cookieA, headers: { 'Content-Type': up.contentType } });
  const idB = r.data.auditId;

  r = await req('GET', `/api/audits/${idA}`, { cookie: cookieA });
  const filesA = r.data.sourceFiles.map(f => f.name);
  r = await req('GET', `/api/audits/${idB}`, { cookie: cookieA });
  const filesB = r.data.sourceFiles.map(f => f.name);
  ok(filesA.join() === 'srcA.html' && filesB.join() === 'srcB.jsx', 'Record A != Record B in history');

  r = await req('GET', `/api/audits/${idA}/pdf`, { cookie: cookieA, asBuffer: true });
  const pdfAPath = `${TMP}/e2e-srcA.pdf`;
  fs.writeFileSync(pdfAPath, Buffer.from(r.data));
  const pyA = verifyPdf(pdfAPath, 'srcA.html', 'source', false);
  ok(pyA.includes('PDF_TEXT_OK'), 'PDF A contains srcA.html report');
  ok(!pyA.includes('srcB.jsx'), 'PDF A does NOT contain srcB.jsx');

  // ------------------------------------------------------------------
  // USER ISOLATION
  // ------------------------------------------------------------------
  console.log('\n== User isolation (B cannot see A) ==');
  r = await req('GET', '/api/audits', { cookie: cookieB });
  const namesB = r.data.audits.map(a => `${a.audit_type}:${a.scanned_url}`);
  ok(namesB.length === 0, 'B history empty', JSON.stringify(namesB));

  r = await req('GET', `/api/audits/${srcAuditId}`, { cookie: cookieB });
  ok(r.status === 403 || r.status === 404, 'B cannot read A source-code record', `status=${r.status}`);

  r = await req('GET', `/api/audits/${srcAuditId}/pdf`, { cookie: cookieB, asBuffer: true });
  ok(r.status === 403 || r.status === 404, 'B cannot export A source-code PDF', `status=${r.status}`);

  r = await req('GET', `/api/audits/${webRecord.id}`, { cookie: cookieB });
  ok(r.status === 403 || r.status === 404, 'B cannot read A website record', `status=${r.status}`);

  r = await req('GET', '/api/audits/not-a-real-id', { cookie: cookieA });
  ok(r.status === 404, 'Missing audit id -> 404');

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n============================================');
  console.log(`TOTAL: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('FAILURES:');
    failures.forEach(f => console.log('  - ' + f));
  }
  process.exit(failed > 0 ? 1 : 0);
})().catch(err => {
  console.error('E2E script crashed:', err);
  process.exit(2);
});