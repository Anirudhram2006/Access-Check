/* UI E2E check for the Change Code (auto-fix) flow in the running Vite dev server.
 * Exercises: upload -> analyze -> fixStatus pills -> single Change Code -> Apply
 * All Safe Fixes -> download interception -> re-analyze -> history FIX STATUS strip.
 * Run with: node ui-check-fix.js   (backend must be on :5000, Vite on :5173).
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BACKEND = 'http://localhost:5000';
const FRONTEND = 'http://localhost:5173';
const TMP = process.env.TEMP || 'C:\\Users\\user\\AppData\\Local\\Temp';
const FIXTURE_DIR = path.join(TMP, 'opencode');
fs.mkdirSync(FIXTURE_DIR, { recursive: true });
const FIXTURE = path.join(FIXTURE_DIR, 'testpage.html');

const fixtureHtml = [
  '<!DOCTYPE html>',
  '<html>',
  '<head>',
  '  <meta charset="UTF-8">',
  '  <title>UI fix fixture</title>',
  '</head>',
  '<body>',
  '  <img src="logo.png">',
  '  <button>Submit</button>',
  '  <a href="/home"></a>',
  '  <form>',
  '    <input placeholder="Email address">',
  '  </form>',
  '</body>',
  '</html>'
].join('\n');
fs.writeFileSync(FIXTURE, fixtureHtml, 'utf8');

let passed = 0;
let failed = 0;
function ok(cond, label, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  PASS: ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL: ${label}${extra ? ` :: ${extra}` : ''}`);
  }
}

(async () => {
  console.log('== Register UI user via API ==');
  const stamp = Date.now();
  const reg = await fetch(`${BACKEND}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'UiUser',
      email: `e2eui-${stamp}@test.com`,
      password: 'password123',
      confirmPassword: 'password123'
    })
  });
  ok(reg.status === 201, `API register -> ${reg.status}`);
  const sc = reg.headers.get('set-cookie') || '';
  const cookiePair = sc.split(';')[0];
  const [cname, ...cval] = cookiePair.split('=');
  ok(cname && cval.length > 0, 'Session cookie captured', cname);

  console.log('== Launch browser + navigate to Source Code Analysis ==');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setCookie({ name: cname, value: cval.join('='), url: FRONTEND });
  await page.goto(FRONTEND, { waitUntil: 'networkidle2' });
  await page.click('[aria-label="Source Code Analysis"]');
  ok(true, 'Navigated to Source Code Analysis tab');

  console.log('== Upload fixture + Analyze Code ==');
  const input = await page.waitForSelector('input[type="file"]', { timeout: 8000 });
  await input.uploadFile(FIXTURE);
  await page.waitForSelector('.file-chip', { timeout: 8000 });
  ok(true, 'File chip rendered after upload');
  await page.click('button.analyze-btn');
  await page.waitForSelector('.fix-panel', { timeout: 20000 });
  ok(true, 'Fix panel rendered after analysis');

  const countPills = await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('.fixstat-pill')).map(p => p.textContent.trim());
    return {
      auto: pills.filter(t => t === 'Auto-Fixable').length,
      manual: pills.filter(t => t === 'Manual Fix').length,
      findingCards: document.querySelectorAll('.violation-card-item').length
    };
  });
  ok(countPills.findingCards >= 4, `Finding cards rendered (${countPills.findingCards})`);
  ok(countPills.auto >= 1, `Auto-Fixable pills rendered (${countPills.auto})`);
  ok(countPills.manual >= 1, `Manual Fix pills rendered (${countPills.manual})`);

  const perFileStats = await page.evaluate(
    () => (document.querySelector('.fix-file-row .fix-file-stats') || {}).textContent || ''
  );
  ok(perFileStats.includes('auto-fixable') && perFileStats.includes('manual'),
    'Per-file fixability chips (auto-fixable + manual)', perFileStats.trim());

  console.log('== Per-finding Change Code (single fix) ==');
  const firstFixable = await page.evaluate(() => {
    const pill = document.querySelector('.fixstat-pill.fixable');
    pill.closest('.violation-card-item').querySelector('.card-clickable-header').click();
    return pill.closest('.violation-card-item').querySelector('.violation-help-title').textContent.trim();
  });
  const changeBtn = await page.waitForSelector('.change-code-btn', { timeout: 8000 });
  ok(true, `Change Code button visible (card: ${firstFixable})`);
  await changeBtn.click();

  await page.waitForFunction(() => {
    const line = document.querySelector('.fix-summary-line');
    return !!line && line.textContent.includes('1 fix applied');
  }, { timeout: 15000 });
  const singleSummary = await page.evaluate(() => {
    const line = document.querySelector('.fix-summary-line').textContent.trim();
    const arrow = document.querySelector('.fix-compare-stats .fix-stat.fixable').textContent.trim();
    return { line, arrow };
  });
  ok(singleSummary.line.includes('fix applied'), 'Single Change Code -> comparison panel', singleSummary.line);
  ok(singleSummary.line.includes('manual review'), 'Single fix preserves manual reviews', singleSummary.line);

  console.log('== Apply All Safe Fixes ==');
  await page.click('button.apply-all-btn');
  await page.waitForFunction(() => {
    const line = document.querySelector('.fix-summary-line');
    return !!line && /[2-9]\d* fix(es)? applied/.test(line.textContent);
  }, { timeout: 15000 });
  const allSummary = await page.evaluate(() => document.querySelector('.fix-summary-line').textContent.trim());
  ok(/applied/.test(allSummary) && /resolved/.test(allSummary), 'All safe fixes summary', allSummary);

  console.log('== Download fixed file (blob interception) ==');
  await page.evaluate(() => {
    window.__dl = null;
    window.__blobCapture = {};
    const create = window.URL.createObjectURL.bind(window.URL);
    const revoke = window.URL.revokeObjectURL.bind(window.URL);
    window.URL.createObjectURL = (b) => {
      const u = create(b);
      window.__blobCapture[u] = b;
      return u;
    };
    window.URL.revokeObjectURL = (u) => { delete window.__blobCapture[u]; revoke(u); };
    const orig = document.body.appendChild.bind(document.body);
    document.body.appendChild = (el) => {
      if (el && el.tagName === 'A' && el.download && window.__blobCapture[el.href]) {
        window.__dl = { download: el.download, blob: window.__blobCapture[el.href] };
      }
      return orig(el);
    };
  });
  await page.click('button.fix-dl-btn');
  let dl = null;
  for (let i = 0; i < 20 && !dl; i += 1) {
    await new Promise(r => setTimeout(r, 250));
    dl = await page.evaluate(() => window.__dl && { download: window.__dl.download });
  }
  ok(dl && dl.download === 'testpage-fixed.html', `Download filename = testpage-fixed.html`, dl && dl.download);
  const downloadedText = await page.evaluate(async () => {
    const d = window.__dl;
    if (!d || !d.blob) return '';
    return await d.blob.text();
  });
  ok(/lang="en"/.test(downloadedText), 'Downloaded file contains lang="en" fix', dcsz(downloadedText));
  ok(/aria-label="Email address"/.test(downloadedText), 'Downloaded file contains derived aria-label', dcsz(downloadedText));
  ok(/<button>Submit<\/button>/.test(downloadedText), 'Manual (button) untouched in downloaded copy');

  console.log('== Re-Analyze Fixed Code ==');
  await page.click('button.reanalyze-btn');
  await page.waitForSelector('.fix-stat.verified', { timeout: 15000 });
  const verified = await page.evaluate(() => document.querySelector('.fix-stat.verified').textContent.trim());
  ok(/re-analysis confirms \d+ issue/.test(verified), 'Re-analysis verifies remaining issues', verified);

  console.log('== History FIX STATUS strip ==');
  await page.click('[aria-label="Audit History"]');
  await page.waitForSelector('.history-card', { timeout: 8000 });
  await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.history-card'))
      .find(c => (c.querySelector('.history-type-chip') || {}).textContent === 'SOURCE CODE ANALYSIS'
        && c.textContent.includes('testpage.html'));
    if (card) card.click();
  });
  await page.waitForSelector('.history-fix-readiness', { timeout: 8000 });
  const ready = await page.evaluate(() => {
    const strip = document.querySelector('.history-fix-readiness');
    return {
      text: strip.textContent.replace(/\s+/g, ' ').trim(),
      pills: Array.from(strip.querySelectorAll('.fix-readiness-pill')).map(p => p.textContent.trim())
    };
  });
  ok(ready.text.startsWith('FIX STATUS'), 'History detail shows FIX STATUS strip', ready.text.slice(0, 60));
  ok(ready.pills.some(p => /auto-fixable/.test(p)), 'History strip lists auto-fixable count', ready.pills.join(' | '));
  ok(ready.pills.some(p => /manual/.test(p)), 'History strip lists manual count', ready.pills.join(' | '));

  console.log('== Cleanup + summary ==');
  await page.evaluate(() => { delete window.__dl; delete window.__blobCapture; });
  await browser.close();
  await new Promise(r => setTimeout(r, 300));
  console.log('============================================');
  console.log(`TOTAL: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(async (err) => {
  console.error('UI check crashed:', err);
  process.exit(2);
});

function dcsz(t) {
  if (!t) return 'no text';
  return t.length + ' chars';
}