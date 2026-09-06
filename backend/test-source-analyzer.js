const { analyzeSourceFile } = require('./sourceAnalyzer');

function run(name, content, ext, file) {
  const findings = analyzeSourceFile(file || 'Test.jsx', content, ext || 'jsx');
  console.log(`\n===== ${name} (${ext}) =====`);
  if (!findings.length) {
    console.log('  NO FINDINGS');
  } else {
    findings.forEach(f => {
      console.log(`  [${f.impact}] ${f.id} L${f.line} (${f.confidence})`);
      console.log(`     code: ${String(f.code).replace(/\n/g, ' ').slice(0, 80)}`);
    });
  }
  return findings;
}

// Test 1 — image without alt
let f = run('Test 1: img no alt', '<img src="logo.png">', 'html', 'Home.html');
console.log('  EXPECT image-alt: ' + f.some(x => x.id === 'image-alt'));

// Test 2 — proper image
f = run('Test 2: img with alt', '<img src="logo.png" alt="Company logo">', 'html', 'Home.html');
console.log('  EXPECT no image-alt: ' + !f.some(x => x.id === 'image-alt'));

// Test 3 — input without label
f = run('Test 3: input no label', '<input type="text">', 'html', 'Form.html');
console.log('  EXPECT label: ' + f.some(x => x.id === 'label'));

// Test 4 — accessible input
f = run('Test 4: input with label', '<label for="email">Email</label><input id="email" type="email">', 'html', 'Form.html');
console.log('  EXPECT no label: ' + !f.some(x => x.id === 'label'));

// Test 5 — custom clickable div
f = run('Test 5: div onClick', 'const x = <div onClick={handleClick}>Submit</div>;', 'jsx', 'Home.jsx');
console.log('  EXPECT onclick-keyboard: ' + f.some(x => x.id === 'onclick-keyboard'));

// Test 6 — accessible button
f = run('Test 6: button onClick', 'const x = <button onClick={handleClick}>Submit</button>;', 'jsx', 'Home.jsx');
console.log('  EXPECT no onclick-keyboard: ' + !f.some(x => x.id === 'onclick-keyboard'));

// EXTRA: input with aria-label
f = run('Extra: input aria-label', '<input type="text" aria-label="Search">', 'html', 'Form.html');
console.log('  EXPECT no label: ' + !f.some(x => x.id === 'label'));

// EXTRA: input with wrapping label
f = run('Extra: wrapping label', '<label>Email <input type="email"></label>', 'html', 'Form.html');
console.log('  EXPECT no label: ' + !f.some(x => x.id === 'label'));

// EXTRA: full doc no lang no main
f = run('Extra: full doc no lang/main', '<!doctype html><html><head><title>x</title></head><body><p>hi</p></body></html>', 'html', 'Index.html');
console.log('  EXPECT html-lang: ' + f.some(x => x.id === 'html-lang') + ', landmark-main: ' + f.some(x => x.id === 'landmark-one-main'));

// EXTRA: full doc with lang+main
f = run('Extra: full doc ok', '<!doctype html><html lang="en"><head><title>x</title></head><body><main><p>hi</p></main></body></html>', 'html', 'Index.html');
console.log('  EXPECT no html-lang: ' + !f.some(x => x.id === 'html-lang') + ', no landmark: ' + !f.some(x => x.id === 'landmark-one-main'));

// EXTRA: positive tabindex
f = run('Extra: positive tabindex', '<div tabindex="5">x</div>', 'html', 'X.html');
console.log('  EXPECT tabindex-positive: ' + f.some(x => x.id === 'tabindex-positive'));

// EXTRA: invalid role
f = run('Extra: invalid role', '<div role="btton">x</div>', 'html', 'X.html');
console.log('  EXPECT aria-valid-attr: ' + f.some(x => x.id === 'aria-valid-attr'));

// EXTRA: button no text
f = run('Extra: empty button', '<button></button>', 'html', 'X.html');
console.log('  EXPECT button-name: ' + f.some(x => x.id === 'button-name'));

// EXTRA: empty link
f = run('Extra: empty link', '<a href="/home"></a>', 'html', 'X.html');
console.log('  EXPECT link-name: ' + f.some(x => x.id === 'link-name'));

// EXTRA: heading skip
f = run('Extra: heading skip h2->h4', '<h2>t</h2><h4>t</h4>', 'html', 'X.html');
console.log('  EXPECT heading-order: ' + f.some(x => x.id === 'heading-order'));

// CSS: outline none
f = run('CSS: outline none', 'a:focus { outline: none; }', 'css', 'style.css');
console.log('  EXPECT outline-none: ' + f.some(x => x.id === 'outline-none'));

// CSS: contrast
f = run('CSS: contrast low', '.x { color: #cccccc; background-color: #ffffff; }', 'css', 'style.css');
console.log('  EXPECT color-contrast: ' + f.some(x => x.id === 'color-contrast'));

// malformed source
f = run('Malformed source', '<div><span></div>', 'html', 'bad.html');
console.log('  NO CRASH, findings: ' + f.length);
