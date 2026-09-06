const { analyzeSourceFile } = require('./sourceAnalyzer');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}

// Fully accessible component -> no findings
const accessible = `
<!doctype html>
<html lang="en">
<head><title>Good</title></head>
<body>
<main>
  <h1>Title</h1>
  <img src="logo.png" alt="Company logo">
  <label for="email">Email</label>
  <input id="email" type="email">
  <button type="button">Submit</button>
  <a href="/home">Home</a>
</main>
</body>
</html>
`;
let f = analyzeSourceFile('Good.jsx', accessible, 'jsx');
console.log('Accessible doc findings:', f.length);
check('Fully accessible -> 0 findings', f.length === 0);

// Malformed source doesn't crash and returns findings (not crash)
f = analyzeSourceFile('Bad.jsx', '<div><img src><button</div>', 'jsx');
console.log('Malformed findings:', f.length);
check('Malformed does not crash', Array.isArray(f));

// Long file with repeated issues
let long = '';
for (let i = 0; i < 2000; i++) long += `<img src="${i}.png">\n`;
const t0 = Date.now();
f = analyzeSourceFile('Long.jsx', long, 'jsx');
const dt = Date.now() - t0;
console.log('Long file findings:', f.length, 'time(ms):', dt);
check('Long file produces many findings', f.length > 100);

// Multiple distinct files mixed HTML/CSS/JSX
const home = 'const App = () => <div><img src="a.png" /></div>;';
const css = '.x { outline: none; } a:focus { color: #888; background-color: #fff; }';
f = analyzeSourceFile('Home.jsx', home, 'jsx');
f = f.concat(analyzeSourceFile('style.css', css, 'css'));
console.log('Mixed summary:', f.map(x => x.id + '(' + x.file + ')').join(', '));
check('Mixed detects image-alt in Home.jsx', f.some(x => x.id === 'image-alt' && x.file === 'Home.jsx'));
check('Mixed detects outline-none + contrast in style.css', f.some(x => x.id === 'outline-none' && x.file === 'style.css') && f.some(x => x.id === 'color-contrast' && x.file === 'style.css'));

// Line number correctness
const img = 'line1\nline2\n<img src="x.png">';
f = analyzeSourceFile('L.jsx', img, 'jsx');
const hit = f.find(x => x.id === 'image-alt');
console.log('Line number for img on line 3:', hit && hit.line);
check('Correct line number (3)', hit && hit.line === 3);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
