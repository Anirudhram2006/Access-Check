import * as hb from "harfbuzzjs";
import PDFDocument from "pdfkit";
import fs from "fs";

const fontPath = "C:\\Windows\\Fonts\\Nirmala.ttf";
const fontData = fs.readFileSync(fontPath);
const UPEM = 2048;

const blob = new hb.Blob(fontData);
const face = new hb.Face(blob);
const hbfont = new hb.Font(face);

const FONTSIZE = 14;

function shapeLine(text, script) {
  const buf = new hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  buf.direction = "ltr";
  buf.script = script;
  hb.shape(hbfont, buf);
  const infos = buf.getGlyphInfos();
  const positions = buf.getGlyphPositions();
  return { infos, positions };
}

const s = FONTSIZE / UPEM;

function renderShapedLine(doc, text, script, x, baselineY, color = "#000000") {
  const { infos, positions } = shapeLine(text, script);
  let penX = x;
  for (let i = 0; i < infos.length; i++) {
    const gid = infos[i].codepoint;
    const p = positions[i];
    const svg = hbfont.glyphToPath(gid);
    if (svg && svg.length > 0) {
      const gx = penX + p.xOffset * s;
      const gy = baselineY - p.yOffset * s;
      doc.save();
      doc.translate(gx, gy);
      doc.scale(s, -s);
      doc.path(svg);
      doc.fillColor(color).fill();
      doc.restore();
    }
    penX += p.xAdvance * s;
  }
  return penX;
}

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream("geotest.pdf"));
doc.save();
const tam = "வணக்கம் சோதனை உரை";
const dev = "नमस्ते हिंदी परीक्षण क्ष स्त";
const x = renderShapedLine(doc, tam, "taml", 50, 100);
renderShapedLine(doc, dev, "deva", 50, 160);
doc.end();
console.log("wrote geotest.pdf");
