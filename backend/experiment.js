const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const tamil = 'வணக்கம் இது ஒரு தமிழ் சோதனை உரை ஆகும்.';
const hindi = 'नमस्ते यह एक हिंदी परीक्षण पाठ है।';

const fonts = {
  arial: path.join('C:\\Windows\\Fonts', 'ARIALUNI.TTF'),
  nirmala: path.join('C:\\Windows\\Fonts', 'Nirmala.ttf'),
};

async function make(scriptOpt, fontKey, label) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('f', fonts[fontKey]);
    let y = 50;
    doc.fontSize(12).fillColor('#000');
    doc.text(label, 50, y);
    y = doc.y + 10;
    const opts = scriptOpt ? { script: scriptOpt } : {};
    doc.font('f');
    doc.text('T: ' + tamil, 50, y, opts);
    y = doc.y + 20;
    doc.text('H: ' + hindi, 50, y, opts);
    doc.end();
  });
}

(async () => {
  for (const sc of [null, 'tam', 'dev', 'taml', 'deva']) {
    const label = sc ? `script=${sc}` : 'no-script';
    for (const fk of ['arial', 'nirmala']) {
      const buf = await make(sc, fk, `${label} font=${fk}`);
      const p = path.join(__dirname, `exp-${label.replace('=', '-')}-${fk}.pdf`);
      fs.writeFileSync(p, buf);
    }
  }
  console.log('done');
})();
