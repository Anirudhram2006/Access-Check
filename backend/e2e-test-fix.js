/* eslint-disable */
/**
 * End-to-end API tests for the Automatic Code Fix (Change Code) module.
 * Requires the backend running on http://localhost:5000.
 * Covers: auth, validation, all-fixes, targeted fix, re-analysis numbers,
 * manual-only handling, sensitive-content blocking, and the stateless/
 * ownership surface (no audit records created by fix endpoints).
 */
const fs = require('fs');

const BASE = 'http://localhost:5000';
const TMP = 'C:/Users/user/AppData/Local/Temp/opencode';

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
  const boundary = '----accesscheck-fix-e2e-' + Date.now();
  const chunks = [];
  for (const [name, content] of files) {
    chunks.push(`--${boundary}\r\n`);
    chunks.push(`Content-Disposition: form-data; name="files"; filename="${name}"\r\n`);
    chunks.push(`Content-Type: text/plain\r\n\r\n`);
    chunks.push(content);
    chunks.push('\r\n');
  }
  chunks.push(`--${boundary}--\r\n`);
  return { body: chunks.join(''), contentType: `multipart/form-data; boundary=${boundary}` };
}

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
  '    <a href="/home"></a>',
  '',
  '    <form>',
  '        <input placeholder="Email address">',
  '    </form>',
  '',
  '</body>',
  '</html>'
].join('\n');

/* Only findings the analyzer actually detected may be fixed. */
const manualOnlyHtml = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head><title>Manual Only</title></head>',
  '<body>',
  '  <a href="/home"></a>',
  '  <button></button>',
  '</body>',
  '</html>'
].join('\n');

/* Contains sensitive content AND a real fixable issue. */
const secretHtml = [
  '<!DOCTYPE html>',
  '<html>',
  '<head><title>Secret</title></head>',
  '<body>',
  '  <script>',
  '    const apiKey = "AKIAIOSFODNN7EXAMPLE";',
  '    const password = "hunter22";',
  '  </script>',
  '  <img src="logo.png">',
  '</body>',
  '</html>'
].join('\n');

(async () => {
  const stamp = Date.now();

  console.log('\n== Register users ==');
  const regA = await req('POST', '/api/auth/register', {
    body: { name: 'FixA', email: `e2ef-a-${stamp}@test.com`, password: 'password123', confirmPassword: 'password123' }
  });
  ok(regA.status === 201, 'User A registered', `status=${regA.status}`);
  const cookieA = grabCookie(regA.setCookie, regA.setCookies);

  const regB = await req('POST', '/api/auth/register', {
    body: { name: 'FixB', email: `e2ef-b-${stamp}@test.com`, password: 'password123', confirmPassword: 'password123' }
  });
  ok(regB.status === 201, 'User B registered', `status=${regB.status}`);
  const cookieB = grabCookie(regB.setCookie, regB.setCookies);

  let r;

  // ------------------------------------------------------------------
  // Logged-out failure tests
  // ------------------------------------------------------------------
  console.log('\n== Logged-out failure tests ==');
  r = await req('POST', '/api/source-analysis/fix', {
    body: { files: [{ name: 'x.html', content: '<html></html>' }] }
  });
  ok(r.status === 401, 'Logged-out POST /fix -> 401', `status=${r.status}`);
  r = await req('POST', '/api/source-analysis/reanalyze', {
    body: { files: [{ name: 'x.html', content: '<html></html>' }] }
  });
  ok(r.status === 401, 'Logged-out POST /reanalyze -> 401', `status=${r.status}`);

  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------
  console.log('\n== Invalid payloads (User A) ==');
  r = await req('POST', '/api/source-analysis/fix', { body: { files: [] }, cookie: cookieA });
  ok(r.status === 400, '/fix with no files -> 400', `status=${r.status}`);
  r = await req('POST', '/api/source-analysis/fix', { body: {}, cookie: cookieA });
  ok(r.status === 400, '/fix with missing body -> 400', `status=${r.status}`);
  r = await req('POST', '/api/source-analysis/fix', { body: { files: [{ name: 'evil.exe', content: 'MZ...' }] }, cookie: cookieA });
  ok(r.status === 400, '/fix with unsupported file type -> 400', `status=${r.status}`);
  r = await req('POST', '/api/source-analysis/fix', { body: { files: [{ name: '../up.html', content: '<html></html>' }] }, cookie: cookieA });
  ok(r.status === 400, '/fix with traversal filename -> 400', `status=${r.status}`);
  r = await req('POST', '/api/source-analysis/fix', { body: { files: [{ name: 'x.html', content: '<html></html>' }], target: { file: 'x.html' } }, cookie: cookieA });
  ok(r.status === 400, '/fix with incomplete target -> 400', `status=${r.status}`);
  r = await req('POST', '/api/source-analysis/reanalyze', { body: { files: [] }, cookie: cookieA });
  ok(r.status === 400, '/reanalyze with no files -> 400', `status=${r.status}`);

  // ------------------------------------------------------------------
  // Analysis first (frontend flow: analyze -> fix)
  // ------------------------------------------------------------------
  console.log('\n== Analysis (produces fixStatus) ==');
  let up = multipart([['testpage.html', testHtml]]);
  r = await req('POST', '/api/source-analysis', { rawBody: up.body, cookie: cookieA, headers: { 'Content-Type': up.contentType } });
  ok(r.status === 200, 'Analysis -> 200');
  const findings = r.data.findings;
  ok(r.data.fixSummary && typeof r.data.fixSummary.fixable === 'number', 'fixSummary present in analysis response');
  const labelFinding = findings.find(f => f.id === 'label');
  const imgFinding = findings.find(f => f.id === 'image-alt');
  const langFinding = findings.find(f => f.id === 'html-lang');
  const linkFinding = findings.find(f => f.id === 'link-name');
  ok(labelFinding && labelFinding.fixStatus === 'fixable', 'label finding marked fixable (placeholder/name present)', `${labelFinding && labelFinding.fixStatus}`);
  ok(imgFinding && imgFinding.fixStatus === 'fixable', 'image-alt finding marked fixable', `${imgFinding && imgFinding.fixStatus}`);
  ok(langFinding && langFinding.fixStatus === 'fixable', 'html-lang finding marked fixable', `${langFinding && langFinding.fixStatus}`);
  ok(linkFinding && linkFinding.fixStatus === 'manual', 'link-name finding marked manual', `${linkFinding && linkFinding.fixStatus}`);
  const srcAuditId = r.data.auditId;

  const expectedBefore = findings.length;
  const expectedFixable = findings.filter(f => f.fixStatus === 'fixable').length;
  const expectedManual = findings.filter(f => f.fixStatus === 'manual').length;
  ok(expectedFixable >= 3 && expectedManual >= 1, `Fix classification totals (fixable=${expectedFixable}, manual=${expectedManual})`);

  // ------------------------------------------------------------------
  // Apply All Safe Fixes
  // ------------------------------------------------------------------
  console.log('\n== Apply all safe fixes ==');
  r = await req('POST', '/api/source-analysis/fix', {
    body: { files: [{ name: 'testpage.html', content: testHtml }] },
    cookie: cookieA
  });
  ok(r.status === 200, '/fix -> 200', `status=${r.status}`);
  ok(r.data && r.data.results && r.data.results.length === 1, 'One result per file');
  const res0 = r.data.results[0];
  ok(res0.name === 'testpage.html', 'Result name preserved');
  ok(res0.fixedFileName === 'testpage-fixed.html', 'Fixed file name uses -fixed suffix', res0.fixedFileName);
  ok(res0.fixesApplied === expectedFixable, `All safe fixes applied (${res0.fixesApplied})`);
  ok(res0.manualCount >= expectedManual, `Manual findings preserved (${res0.manualCount})`);
  ok(res0.beforeCount === expectedBefore, `Real before count (${res0.beforeCount})`);
  ok(res0.afterCount < res0.beforeCount, `Real after count decreased (${res0.beforeCount} -> ${res0.afterCount})`);
  ok(res0.resolvedCount === res0.beforeCount - res0.afterCount, 'Resolved = before - after (real numbers)');
  ok(res0.verification.balanced === true, 'Fixed output balanced', JSON.stringify(res0.verification));
  ok(res0.verification.blocked === false, 'Fixed output NOT flagged as sensitive');
  ok(res0.diff && Array.isArray(res0.diff.fixedChanged) && res0.diff.fixedChanged.length > 0, 'Diff highlights changed lines');
  ok(res0.fixedContent.includes('alt=""'), 'Fixed content adds alt=""');
  ok(res0.fixedContent.includes('<html lang="en">'), 'Fixed content adds lang="en"');
  ok(res0.fixedContent.includes('aria-label="Email address"'), 'Fixed content derives aria-label verbatim');
  ok(res0.changes.length === expectedFixable, 'changes list matches fixes applied');
  ok(res0.manualFixes.some(m => m.id === 'link-name'), 'Manual fixes listed with link-name');
  ok(res0.beforeSummary && res0.afterSummary && typeof res0.beforeSummary.serious === 'number', 'before/after summaries present');

  // Re-analysis endpoint reflects the fixed content (real numbers)
  r = await req('POST', '/api/source-analysis/reanalyze', {
    body: { files: [{ name: res0.fixedFileName, content: res0.fixedContent }] },
    cookie: cookieA
  });
  ok(r.status === 200, '/reanalyze -> 200');
  const re0 = r.data.results[0];
  ok(re0.total === res0.afterCount, `Re-analysis confirms after count (${re0.total} == ${res0.afterCount})`);

  // ------------------------------------------------------------------
  // Targeted per-finding fix (Change Code for one finding)
  // ------------------------------------------------------------------
  console.log('\n== Targeted per-finding fix ==');
  r = await req('POST', '/api/source-analysis/fix', {
    body: {
      files: [{ name: 'testpage.html', content: testHtml }],
      target: { file: 'testpage.html', line: imgFinding.line, id: imgFinding.id }
    },
    cookie: cookieA
  });
  ok(r.status === 200, 'Targeted /fix -> 200');
  const t0 = r.data.results[0];
  ok(t0.fixesApplied === 1, 'Exactly one fix applied', `applied=${t0.fixesApplied}`);
  ok(t0.changes[0] && t0.changes[0].id === 'image-alt', 'Targeted fix was image-alt', JSON.stringify(t0.changes));
  ok(t0.fixedContent.includes('alt=""'), 'Targeted fix present in output');
  ok(!t0.fixedContent.includes('<html lang="en">') && !t0.fixedContent.includes('aria-label="'), 'Targeted fix does NOT touch other fixable findings');

  // ------------------------------------------------------------------
  // Manual-only file: nothing auto-changed
  // ------------------------------------------------------------------
  console.log('\n== Manual-only file ==');
  up = multipart([['manual.html', manualOnlyHtml]]);
  r = await req('POST', '/api/source-analysis', { rawBody: up.body, cookie: cookieA, headers: { 'Content-Type': up.contentType } });
  const manualFindings = r.data.findings;
  ok(manualFindings.every(f => f.fixStatus === 'manual'), 'All manual findings flagged manual', manualFindings.map(f => f.id + ':' + f.fixStatus).join(','));

  r = await req('POST', '/api/source-analysis/fix', {
    body: { files: [{ name: 'manual.html', content: manualOnlyHtml }] },
    cookie: cookieA
  });
  const m0 = r.data.results[0];
  ok(m0.fixesApplied === 0, 'No fixes applied for manual-only file');
  ok(m0.manualCount === manualFindings.length, 'All findings remain manual');
  ok(m0.fixedContent === manualOnlyHtml, 'Fixed content identical to original (no auto-changes)');
  ok(m0.verification.blocked === false, 'Manual-only output not blocked');

  // Manual findings stay intact after calling fix
  const manualAfterRe = m0.manualFixes.map(f => f.id);
  ok(manualAfterRe.includes('link-name') && manualAfterRe.includes('button-name'), 'manualFixes lists link-name + button-name');

  // ------------------------------------------------------------------
  // Sensitive content blocking
  // ------------------------------------------------------------------
  console.log('\n== Sensitive content blocking ==');
  r = await req('POST', '/api/source-analysis/fix', {
    body: { files: [{ name: 'secret.html', content: secretHtml }] },
    cookie: cookieA
  });
  const s0 = r.data.results[0];
  ok(r.status === 200, '/fix -> 200 for sensitive file');
  ok(s0.verification.blocked === true, 'Blocked download recorded', JSON.stringify(s0.verification.sensitive));
  ok(s0.verification.sensitive.length > 0, 'Sensitive kinds reported: ' + s0.verification.sensitive.join(','));
  ok(s0.fixesApplied >= 1 && s0.fixedContent.includes('alt=""'), 'Fixes still generated but download blocked');

  // ------------------------------------------------------------------
  // Stateless + multi-user surface
  // ------------------------------------------------------------------
  console.log('\n== Stateless fix / no audit records created ==');
  // Any record still in history at this point was created by the (legitimate)
  // /api/source-analysis calls above. Run fix + reanalyze again and confirm the
  // count does not move.
  r = await req('GET', '/api/audits', { cookie: cookieA });
  const auditsBeforeFix = r.data.audits.length;
  await req('POST', '/api/source-analysis/fix', {
    body: { files: [{ name: 'testpage.html', content: testHtml }] },
    cookie: cookieA
  });
  await req('POST', '/api/source-analysis/fix', {
    body: { files: [{ name: 'manual.html', content: manualOnlyHtml }] },
    cookie: cookieA
  });
  await req('POST', '/api/source-analysis/reanalyze', {
    body: { files: [{ name: 'manual.html', content: manualOnlyHtml }] },
    cookie: cookieA
  });
  r = await req('GET', '/api/audits', { cookie: cookieA });
  ok(r.data.audits.length === auditsBeforeFix, 'Fix/reanalyze endpoints created NO audit records', `before=${auditsBeforeFix} after=${r.data.audits.length}`);

  r = await req('POST', '/api/source-analysis/fix', {
    body: { files: [{ name: 'testpage.html', content: testHtml }] },
    cookie: cookieB
  });
  ok(r.status === 200, 'Authenticated User B can generate fixed code (stateless, no stored artifact)');
  ok(r.data.results[0].fixedContent.includes('alt=""'), 'B receives fixed content for its own request');

  // Stored source-code analysis still enforces ownership (regression).
  r = await req('GET', `/api/audits/${srcAuditId}`, { cookie: cookieB });
  ok(r.status === 403 || r.status === 404, 'User B still cannot read User A stored record', `status=${r.status}`);
  r = await req('GET', `/api/audits/${srcAuditId}/pdf`, { cookie: cookieB, asBuffer: true });
  ok(r.status === 403 || r.status === 404, 'User B still cannot export User A PDF', `status=${r.status}`);

  // ------------------------------------------------------------------
  // Multi-file batch
  // ------------------------------------------------------------------
  console.log('\n== Multi-file batch ==');
  r = await req('POST', '/api/source-analysis/fix', {
    body: {
      files: [
        { name: 'testpage.html', content: testHtml },
        { name: 'manual.html', content: manualOnlyHtml }
      ]
    },
    cookie: cookieA
  });
  ok(r.data.results.length === 2, 'Batch processed both files');
  ok(r.data.totals.files === 2, 'Totals count both files');
  ok(r.data.totals.fixesApplied >= 3, 'Batch fixes applied across files', `applied=${r.data.totals.fixesApplied}`);
  ok(r.data.totals.beforeCount > r.data.totals.afterCount, 'Batch real before > after');
  ok(r.data.totals.manualCount >= 2, 'Batch manual total preserved');

  console.log('\n============================================');
  console.log(`TOTAL: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('FAILURES:');
    failures.forEach(f => console.log('  - ' + f));
  }
  // Give any in-flight fetch keep-alive sockets a moment to close before exit
  // (avoids a libuv assertion on Windows).
  await new Promise(r => setTimeout(r, 300));
  process.exit(failed > 0 ? 1 : 0);
})().catch(err => {
  console.error('E2E fix script crashed:', err);
  process.exit(2);
});