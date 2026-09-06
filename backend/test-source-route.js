const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Launch a fresh backend instance on a test port with its own data dir.
process.env.PORT = '5099';
process.env.DATA_DIR = path.join(os.tmpdir(), 'ac-test-db-' + Date.now());

// db.js uses a hardcoded path; run the real server from the backend dir.
const child = spawn('node', ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: '5099' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let out = '';
child.stdout.on('data', d => { out += d; });
child.stderr.on('data', d => { out += d; });

const BASE = 'http://localhost:5099';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function request(method, urlPath, { body, headers, files } = {}) {
  const opts = {
    method,
    headers: headers || {},
  };
  const cookieJar = global.__cookie;
  if (cookieJar) opts.headers['Cookie'] = cookieJar;

  let payload;
  if (files) {
    const form = new FormData();
    for (const f of files) {
      form.append('files', new Blob([f.content], { type: 'text/plain' }), f.name);
    }
    payload = form;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(BASE + urlPath, { ...opts, body: payload, credentials: 'include', redirect: 'manual' });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    global.__cookie = setCookie.split(';')[0];
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

(async () => {
  // wait for server
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) break;
    } catch {}
    await wait(300);
  }

  // 1) Unauthenticated request should be 401
  let r = await request('POST', '/api/source-analysis', {
    files: [{ name: 'a.html', content: '<img src="x.png">' }]
  });
  console.log('Unauthenticated ->', r.status, '(expect 401)');

  // 2) Register
  r = await request('POST', '/api/auth/register', {
    body: { name: 'Test User', email: `src${Date.now()}@test.com`, password: 'password123', confirmPassword: 'password123' }
  });
  console.log('Register ->', r.status);
  if (r.status !== 201) { console.log('REGISTER FAILED', r.data); process.exit(1); }

  // 3) Valid upload (multiple files)
  r = await request('POST', '/api/source-analysis', {
    files: [
      { name: 'Home.jsx', content: '<img src="logo.png">\n<div onClick={go}>Go</div>' },
      { name: 'style.css', content: 'a:focus { outline: none; }\n.x { color: #cccccc; background-color: #ffffff; }' },
      { name: 'good.html', content: '<label for="e">Email</label><input id="e" type="email">' }
    ]
  });
  console.log('Valid upload ->', r.status, 'total=', r.data && r.data.total);
  r.data && r.data.findings.forEach(f => console.log('   ', f.id, f.file, 'L'+f.line, f.impact, f.confidence));

  // 4) Unsupported extension
  r = await request('POST', '/api/source-analysis', { files: [{ name: 'evil.sh', content: 'echo hi' }] });
  console.log('Unsupported ext ->', r.status, '(expect 4xx)');

  // 5) Empty file
  r = await request('POST', '/api/source-analysis', { files: [{ name: 'empty.html', content: '   ' }] });
  console.log('Empty file ->', r.status, 'files=', r.data && r.data.files.length, 'warnings=', r.data && r.data.warnings.length);

  // 6) Path traversal filename
  r = await request('POST', '/api/source-analysis', { files: [{ name: '../../etc/passwd.html', content: '<p>hi</p>' }] });
  console.log('Traversal name ->', r.status, 'skipped=', r.data && r.data.skipped && r.data.skipped.length);

  // 7) No files
  r = await request('POST', '/api/source-analysis', { files: [] });
  console.log('No files ->', r.status, '(expect 400)');

  // 8) Oversized file (>1MB)
  const big = 'x'.repeat(1_100_000);
  r = await request('POST', '/api/source-analysis', { files: [{ name: 'big.html', content: big }] });
  console.log('Oversized ->', r.status, '(expect 413)');

  child.kill();
  process.exit(0);
})().catch(e => { console.error('TEST ERROR', e); child.kill(); process.exit(1); });
