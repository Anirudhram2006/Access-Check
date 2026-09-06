import * as hb from "harfbuzzjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const fontPath = "C:\\Windows\\Fonts\\Nirmala.ttf";
const fontData = fs.readFileSync(fontPath);

const blob = new hb.Blob(fontData);
const face = new hb.Face(blob);
const font = new hb.Font(face);
console.log("upem", face.upem);

function shapeText(text, script) {
  const buf = new hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  buf.direction = "ltr";
  buf.script = script;
  hb.shape(font, buf);
  const infos = buf.getGlyphInfos();
  const positions = buf.getGlyphPositions();
  return { infos, positions };
}

const samples = {
  tam: "வணக்கம் இது ஒரு தமிழ் சோதனை உரை ஆகும்.",
  dev: "नमस्ते यह एक हिंदी परीक्षण पाठ है।",
};

for (const [name, text] of Object.entries(samples)) {
  const script = name === "tam" ? "taml" : "deva";
  const { infos, positions } = shapeText(text, script);
  console.log("==== ", name, "glyphs", infos.length);
  let total = 0;
  for (let i = 0; i < infos.length; i++) {
    const gid = infos[i].codepoint;
    const p = positions[i];
    const svg = font.glyphToPath(gid);
    total += p.xAdvance;
    console.log(`gid=${gid} xa=${p.xAdvance} xo=${p.xOffset} yo=${p.yOffset} svg=${svg ? "YES" : "EMPTY"} len=${svg ? svg.length : 0}`);
  }
  console.log("total advance", total);
}
console.log("HB version", hb.version ? hb.version() : "?");
