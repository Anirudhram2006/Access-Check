const fontkit = require('fontkit');
const path = require('path');

const font = fontkit.openSync(path.join('C:\\Windows\\Fonts', 'Nirmala.ttf'));
const arial = fontkit.openSync(path.join('C:\\Windows\\Fonts', 'ARIALUNI.TTF'));

const samples = {
  tam: 'வணக்கம் இது ஒரு தமிழ் சோதனை உரை ஆகும்.',
  dev: 'नमस्ते यह एक हिंदी परीक्षण पाठ है।',
};

for (const [script, text] of Object.entries(samples)) {
  console.log('===== SCRIPT', script, '=====');
  for (const [name, f] of [['arial', arial], ['nirmala', font]]) {
    // no shaping baseline: glyphsForString (1:1)
    const base = f.glyphsForString(text);
    const layout = f.layout(text, [], script);
    console.log('--', name);
    console.log('  baseline glyphs:', base.length, '->', base.map(g=>g.id).join(','));
    console.log('  shaped  glyphs:', layout.glyphs.length, '->', layout.glyphs.map(g=>g.id).join(','));
  }
}
