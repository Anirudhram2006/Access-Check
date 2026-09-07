const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getRuleSuggestion } = require('./ruleSuggestions');

const MARGIN = 50;
const PAGE_WIDTH_PT = 595;
const PAGE_HEIGHT_PT = 842;
const CONTENT_WIDTH = PAGE_WIDTH_PT - 2 * MARGIN;
const BODY_BOTTOM = PAGE_HEIGHT_PT - 68;
const FOOTER_Y = PAGE_HEIGHT_PT - 30;
const FOOTER_LINE_Y = PAGE_HEIGHT_PT - 44;

// Font sizes tuned for a clean, readable report.
const F_TITLE = 24;
const F_SUBTITLE = 12;
const F_SECTION = 13;
const F_LABEL = 10;
const F_BODY = 10.5;
const F_SMALL = 9;

const LINE_GAP = 5;

// ---------------------------------------------------------------------------
// Font selection.
// Tamil and Devanagari are rendered with the bundled Noto Sans fonts
// (backend/fonts/) through HarfBuzz. Those Noto faces are script subsets —
// they contain Tamil/Devanagari codepoints plus digits and punctuation but NO
// Latin letters — so English/Latin text uses pdfkit's built-in base-14
// Helvetica, which every PDF viewer supplies on every platform (Windows,
// Render Linux, browsers).
// ---------------------------------------------------------------------------

const BUNDLED_FONTS_DIR = path.join(__dirname, 'fonts');

// English/Latin fonts (pdfkit base-14). Registered under the friendly names
// 'Body'/'BodyBold' so flowText()/footers/widthOfString() keep working.
const EN_FONT = 'Helvetica';
const EN_BOLD_FONT = 'Helvetica-Bold';

// HarfBuzz shaping fonts keyed by OpenType script tag — see scriptTagFor().
// Each script gets the bundled font that contains its GSUB/GPOS tables.
// 'latn' is a fallback only; Latin mixed-paragraph runs are drawn with
// Helvetica via pdfkit (see drawShapedLine).
const HB_FONT_PATHS = {
  taml: path.join(BUNDLED_FONTS_DIR, 'NotoSansTamil-Regular.ttf'),
  deva: path.join(BUNDLED_FONTS_DIR, 'NotoSansDevanagari-Regular.ttf'),
  latn: path.join(BUNDLED_FONTS_DIR, 'NotoSansTamil-Regular.ttf'),
};

// ---------------------------------------------------------------------------
// Score / severity helpers (kept from the original implementation).
// ---------------------------------------------------------------------------

function calculateScore(violations) {
  if (!violations || !Array.isArray(violations)) return 100;
  let penalties = 0;
  violations.forEach(v => {
    const impact = v.impact ? v.impact.toLowerCase() : 'minor';
    switch (impact) {
      case 'critical': penalties += 15; break;
      case 'serious': penalties += 8; break;
      case 'moderate': penalties += 4; break;
      default: penalties += 1; break;
    }
  });
  return Math.max(0, Math.min(100, 100 - penalties));
}

function formatSeverity(impact) {
  if (!impact) return 'Minor';
  return impact.charAt(0).toUpperCase() + impact.slice(1).toLowerCase();
}

function getSeverityColor(impact) {
  switch (impact ? impact.toLowerCase() : 'minor') {
    case 'critical': return '#DC2626';
    case 'serious': return '#EA580C';
    case 'moderate': return '#D97706';
    case 'minor':
    default: return '#2563EB';
  }
}

function getScoreColor(score) {
  if (score >= 80) return '#16A34A';
  if (score >= 60) return '#D97706';
  return '#DC2626';
}

function safeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, ' - ')
    .replace(/\u2026/g, '...');
}

// ---------------------------------------------------------------------------
// English text flow (uses pdfkit's wrapping; adds safe page breaks).
// ---------------------------------------------------------------------------

function flowText(doc, text, x, y, opts) {
  const fontSize = opts.fontSize != null ? opts.fontSize : F_BODY;
  const color = opts.color != null ? opts.color : '#1E293B';
  const bold = opts.bold != null ? opts.bold : false;
  const width = opts.width != null ? opts.width : CONTENT_WIDTH;
  const lineGap = opts.lineGap != null ? opts.lineGap : LINE_GAP;
  const align = opts.align || 'left';

  const font = bold ? EN_BOLD_FONT : EN_FONT;
  // pdfkit's text() wraps by width and automatically continues onto a new
  // page when a paragraph is taller than the page, so we do not add a page
  // manually here (that would create blank trailing pages).
  doc.font(font).fontSize(fontSize).fillColor(color)
    .text(String(text), x, y, { width, align, lineGap, lineBreak: true, continued: false });
  return doc.y + (opts.spacingAfter != null ? opts.spacingAfter : 6);
}

function ensureSpace(doc, y, needed) {
  if (y + needed > BODY_BOTTOM) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawRule(doc, y) {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y)
    .lineWidth(0.7).strokeColor('#CBD5E1').stroke();
  return y + 14;
}

// ---------------------------------------------------------------------------
// HarfBuzz Indic shaping + glyph outline rendering.
// Tamil and Devanagari (and most proper Indic fonts) can only be rendered
// correctly by running the OpenType GSUB/GPOS shaping engine. pdfkit's text()
// does not do this, so Indic text is shaped with HarfBuzz and each shaped
// glyph is drawn directly from its outline path.
// ---------------------------------------------------------------------------

let hbReady = null;
let hbcore = null; // harfbuzzjs module namespace
const hbFonts = {}; // HarfBuzz font wrappers keyed by script tag (taml/devd/latn)
let HARFBUZZ_UPEM = 1000; // units-per-em shared by the bundled Noto Sans fonts

function ensureHarfBuzz() {
  if (!hbReady) {
    hbReady = (async () => {
      const mod = await import('harfbuzzjs');
      hbcore = mod;
      let upem = null;
      for (const [script, fontPath] of Object.entries(HB_FONT_PATHS)) {
        if (!fs.existsSync(fontPath)) {
          throw new Error(`Bundled font not found: ${fontPath} — cannot render ${script} text.`);
        }
        const data = fs.readFileSync(fontPath);
        const blob = new mod.Blob(data);
        const face = new mod.Face(blob);
        hbFonts[script] = new mod.Font(face);
        if (upem == null) upem = face.upem;
      }
      HARFBUZZ_UPEM = upem || 1000;
    })();
  }
  return hbReady;
}

function shapeIndic(text, script) {
  const buf = new hbcore.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  buf.direction = 'ltr';
  buf.script = script;
  hbcore.shape(hbFonts[script] || hbFonts.latn, buf);
  return {
    infos: buf.getGlyphInfos(),
    positions: buf.getGlyphPositions(),
  };
}

function shapedWidth(text, script, scale) {
  const { infos, positions } = shapeIndic(text, script);
  let w = 0;
  for (let i = 0; i < infos.length; i++) {
    w += positions[i].xAdvance * scale;
  }
  return w;
}

function drawShapedLine(doc, text, script, x, baselineY, fontSize, color) {
  // Latin (English) runs have no glyphs in the bundled Noto script subsets,
  // so they are drawn with pdfkit's base-14 Helvetica. 'baseline: alphabetic'
  // puts the text baseline exactly on the shared baseline used by the Indic
  // glyphs drawn below.
  if (script === 'latn') {
    doc.font('Body').fontSize(fontSize).fillColor(color)
      .text(String(text), x, baselineY, { baseline: 'alphabetic', lineBreak: false });
    return x + doc.widthOfString(String(text));
  }
  const scale = fontSize / HARFBUZZ_UPEM;
  const { infos, positions } = shapeIndic(text, script);
  const font = hbFonts[script] || hbFonts.latn;
  let penX = x;
  for (let i = 0; i < infos.length; i++) {
    const gid = infos[i].codepoint;
    const p = positions[i];
    const svg = font.glyphToPath(gid);
    if (svg && svg.length > 0) {
      const gx = penX + p.xOffset * scale;
      const gy = baselineY - p.yOffset * scale;
      doc.save();
      doc.translate(gx, gy);
      doc.scale(scale, -scale);
      doc.path(svg);
      doc.fillColor(color).fill();
      doc.restore();
    }
    penX += p.xAdvance * scale;
  }
  return penX;
}

function renderIndicParagraph(doc, text, script, x, y, fontSize, color, width) {
  const scale = fontSize / HARFBUZZ_UPEM;
  const lineHeight = Math.round(fontSize * 1.7);
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return y;

  const spaceW = shapedWidth(' ', script, scale);

  // Wrap words into lines.
  const lines = [];
  let cur = [];
  let curW = 0;
  for (const word of words) {
    const w = shapedWidth(word, script, scale);
    const gap = cur.length ? spaceW : 0;
    if (cur.length && curW + gap + w > width) {
      lines.push(cur.join(' '));
      cur = [word];
      curW = w;
    } else {
      if (cur.length) curW += gap;
      cur.push(word);
      curW += w;
    }
  }
  if (cur.length) lines.push(cur.join(' '));

  for (const line of lines) {
    if (y > BODY_BOTTOM) {
      doc.addPage();
      y = MARGIN + fontSize + 4;
    }
    drawShapedLine(doc, line, script, x, y, fontSize, color);
    y += lineHeight;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Mixed-script text (English + Tamil + Hindi in a single line).
// Unicode code snippets and extracted text can contain Latin, Tamil and
// Devanagari on the same line. Each script run is shaped individually with
// HarfBuzz using the correct script tag and drawn at a shared baseline, so
// combining marks, reordering and spacing remain correct.
// ---------------------------------------------------------------------------

function splitScriptRuns(text) {
  const runs = [];
  let cur = null;
  for (const ch of String(text)) {
    let type = 'latin';
    if (ch >= '\u0B80' && ch <= '\u0BFF') type = 'tamil';
    else if (ch >= '\u0900' && ch <= '\u097F') type = 'devanagari';
    if (cur && cur.type === type) {
      cur.text += ch;
    } else {
      cur = { type, text: ch };
      runs.push(cur);
    }
  }
  return runs;
}

function scriptTagFor(type) {
  if (type === 'tamil') return 'taml';
  if (type === 'devanagari') return 'deva';
  return 'latn';
}

function measureWord(doc, word, fontSize, scale) {
  let w = 0;
  for (const run of splitScriptRuns(word)) {
    if (run.type === 'latin') {
      // Latin runs are drawn with Helvetica (drawShapedLine), so measure them
      // with the same font to keep wrapping consistent with the rendering.
      doc.font('Body').fontSize(fontSize);
      w += doc.widthOfString(run.text);
    } else {
      w += shapedWidth(run.text, scriptTagFor(run.type), scale);
    }
  }
  return w;
}

/**
 * Wraps text (possibly containing Latin + Tamil + Devanagari runs) into lines
 * that fit `width`. Words are measured with HarfBuzz for Indic runs and the
 * same font for Latin runs, so the measurements match the actual rendering.
 * Over-long single tokens are split so no content runs off the page.
 */
function wrapMixedText(doc, text, width, fontSize) {
  const scale = fontSize / HARFBUZZ_UPEM;
  doc.font('Body').fontSize(fontSize);
  const space = doc.widthOfString(' ');
  const words = String(text).split(/\s+/).filter(Boolean);
  const widths = words.map(w => measureWord(doc, w, fontSize, scale));

  // Split a single word into chunks that each fit within `max`.
  const splitWord = (word, max) => {
    if (measureWord(doc, word, fontSize, scale) <= max) return [word];
    const chunks = [];
    let cur = '';
    for (const ch of word) {
      if (cur && measureWord(doc, cur + ch, fontSize, scale) > max) {
        chunks.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) chunks.push(cur);
    return chunks;
  };

  const lines = [];
  let cur = [];
  let curW = 0;

  const pushWord = (word, ww) => {
    const gap = cur.length ? space : 0;
    if (cur.length && curW + gap + ww > width) {
      lines.push(cur.join(' '));
      cur = [word];
      curW = ww;
    } else {
      if (cur.length) curW += gap;
      cur.push(word);
      curW += ww;
    }
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const ww = widths[i];
    if (ww > width) {
      // Start a fresh line with the first fitting chunk of this long token.
      lines.push(cur.join(' '));
      cur = [];
      curW = 0;
      const chunks = splitWord(word, width);
      for (let c = 0; c < chunks.length; c++) {
        if (cur.length && curW + space + measureWord(doc, chunks[c], fontSize, scale) > width) {
          lines.push(cur.join(' '));
          cur = [];
          curW = 0;
        }
        if (cur.length) curW += space;
        cur.push(chunks[c]);
        curW += measureWord(doc, chunks[c], fontSize, scale);
      }
    } else {
      pushWord(word, ww);
    }
  }
  if (cur.length) lines.push(cur.join(' '));
  return lines.filter(l => l.length > 0);
}

/**
 * Renders a paragraph whose lines may mix Latin, Tamil and Devanagari.
 * All runs are shaped through HarfBuzz and drawn at a shared baseline so the
 * three scripts sit on the same line correctly.
 */
function renderMixedParagraph(doc, text, x, y, fontSize, color, width) {
  const lines = wrapMixedText(doc, text, width, fontSize);
  const scale = fontSize / HARFBUZZ_UPEM;
  const lineHeight = Math.round(fontSize * 1.75);
  if (lines.length === 0) return y;

  let baseline = y;
  for (const line of lines) {
    if (baseline > BODY_BOTTOM) {
      doc.addPage();
      baseline = MARGIN + fontSize + 4;
    }
    let penX = x;
    for (const run of splitScriptRuns(line)) {
      penX = drawShapedLine(doc, run.text, scriptTagFor(run.type), penX, baseline, fontSize, color);
    }
    baseline += lineHeight;
  }
  return baseline + 6;
}

/**
 * Renders a source-code snippet inside a light background box. Text is wrapped
 * word-wise (and long tokens are split) so nothing runs off the page, and all
 * three scripts are shaped correctly.
 */
function drawCodeBox(doc, code, x, y, width) {
  const fontSize = 9.5;
  const scale = fontSize / HARFBUZZ_UPEM;
  const lineHeight = Math.round(fontSize * 1.7);
  const padX = 10;
  const padY = 7;
  const textWidth = width - padX * 2;

  const lines = wrapMixedText(doc, safeText(code), textWidth, fontSize);
  const ascent = Math.round(fontSize * 1.4);

  if (lines.length === 0) return y;

  const boxH = padY * 2 + ascent + (lines.length - 1) * lineHeight;

  if (y + boxH > BODY_BOTTOM) {
    doc.addPage();
    y = MARGIN + fontSize + 4;
  }

  doc.rect(x, y, width, boxH).fill('#EEF2F7');

  let baseline = y + padY + ascent - 2;
  for (const line of lines) {
    let penX = x + padX;
    for (const run of splitScriptRuns(line)) {
      penX = drawShapedLine(doc, run.text, scriptTagFor(run.type), penX, baseline, fontSize, '#1E293B');
    }
    baseline += lineHeight;
  }

  return y + boxH + 10;
}

// ---------------------------------------------------------------------------
// Footer / page numbers.
// ---------------------------------------------------------------------------

function drawFooters(doc) {
  // Footers are drawn just above the very bottom of the page, which is BELOW
  // pdfkit's internal auto-wrap limit (page.maxY()). If we call doc.text()
  // there, pdfkit's LineWrapper thinks the text overflows and silently creates
  // an empty new page for it — producing trailing blank pages. Temporarily
  // raise maxY so the footer text is allowed to draw in place. Note: each page
  // is a distinct object, so the override must be applied after switchToPage.
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i);
    const prevMaxY = doc.page.maxY;
    doc.page.maxY = () => doc.page.height;
    doc.fontSize(7).font(EN_FONT).fillColor('#94A3B8')
      .text(
        'Access Check | Automated accessibility report.',
        MARGIN,
        FOOTER_LINE_Y,
        { width: CONTENT_WIDTH, align: 'center' }
      );
    doc.fontSize(8).font(EN_FONT).fillColor('#64748B')
      .text(`Page ${i - range.start + 1} of ${total}`, MARGIN, FOOTER_Y,
        { width: CONTENT_WIDTH, align: 'center' });
    doc.page.maxY = prevMaxY;
  }
}

// ---------------------------------------------------------------------------
// Public generator
// ---------------------------------------------------------------------------

function generateAuditPDF(audit, screenshotsDir) {
  return (async () => {
    console.log('[PDF] generateAuditPDF called for URL:', audit.scannedUrl);

    // Ensure the shaping engine is ready before drawing Indic text.
    await ensureHarfBuzz();

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: `Access Check Audit Report - ${audit.scannedUrl}`,
        Author: 'Access Check',
        Subject: 'Accessibility Audit Report',
        Creator: 'Access Check PDF Generator'
      }
    });

    const chunks = [];

    // Register fonts (base-14 Helvetica for English/Latin; the bundled Noto
    // subsets for Tamil/Devanagari are used directly via HarfBuzz).
    doc.registerFont('Body', EN_FONT);
    doc.registerFont('BodyBold', EN_BOLD_FONT);

    const violations = Array.isArray(audit.violations) ? audit.violations : [];
    const score = audit.score != null ? audit.score : calculateScore(violations);
    const scoreColor = getScoreColor(score);

    let y = MARGIN;

    // ---- Header ----
    doc.font(EN_BOLD_FONT).fontSize(F_TITLE).fillColor('#0F172A')
      .text('Access Check', MARGIN, y);
    y = doc.y + 6;
    y = flowText(doc, 'Accessibility Audit Report', MARGIN, y,
      { fontSize: F_SUBTITLE, color: '#64748B', spacingAfter: 8 });
    y = drawRule(doc, y);

    // ---- Audit information ----
    y = flowText(doc, 'AUDIT INFORMATION', MARGIN, y,
      { fontSize: F_SECTION, bold: true, color: '#334155', spacingAfter: 4 });

    y = flowText(doc, 'Website:', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, safeText(audit.scannedUrl || 'N/A'), MARGIN, y,
      { fontSize: F_BODY, color: '#0F172A', spacingAfter: 4 });

    let dateStr = 'Unknown';
    try {
      const raw = audit.createdAt;
      if (raw) {
        const normalized = String(raw).endsWith('Z') ? raw : raw + 'Z';
        dateStr = new Date(normalized).toLocaleString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });
      }
    } catch (e) { dateStr = 'Unknown'; }

    y = flowText(doc, 'Scan Date:', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, dateStr, MARGIN, y,
      { fontSize: F_BODY, color: '#0F172A', spacingAfter: 4 });

    y = flowText(doc, 'Accessibility Score:', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, `${score}/100`, MARGIN, y,
      { fontSize: F_BODY, bold: true, color: scoreColor, spacingAfter: 4 });

    y = flowText(doc, 'Total Violations:', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, String(violations.length), MARGIN, y,
      { fontSize: F_BODY, bold: true, color: '#0F172A', spacingAfter: 8 });

    y = drawRule(doc, y);

    // ---- Accessibility findings ----
    y = flowText(doc, 'ACCESSIBILITY FINDINGS', MARGIN, y,
      { fontSize: F_SECTION, bold: true, color: '#334155', spacingAfter: 6 });

    if (violations.length === 0) {
      y = flowText(doc, 'No accessibility violations found.', MARGIN, y,
        { fontSize: F_BODY, bold: true, color: '#16A34A', spacingAfter: 4 });
      y = flowText(doc, 'This page passed all accessibility checks. Great work!', MARGIN, y,
        { fontSize: F_BODY, color: '#475569', spacingAfter: 6 });
    } else {
      violations.forEach((violation, index) => {
        const severity = formatSeverity(violation.impact);
        const sevColor = getSeverityColor(violation.impact);

        y = flowText(doc, `Finding ${index + 1}`, MARGIN, y,
          { fontSize: F_BODY, bold: true, color: '#0F172A', spacingAfter: 2 });

        y = flowText(doc, `Rule: ${violation.id || 'Unknown'}`, MARGIN, y,
          { fontSize: F_BODY, bold: true, color: '#334155', spacingAfter: 2 });

        y = flowText(doc, `${severity} severity`, MARGIN, y,
          { fontSize: F_BODY, bold: true, color: sevColor, spacingAfter: 4 });

        const description = safeText(
          violation.help || violation.description || 'Accessibility issue found by the scanner.'
        );
        y = flowText(doc, `Description: ${description}`, MARGIN, y,
          { fontSize: F_BODY, color: '#334155', spacingAfter: 4 });

        const suggestion = getRuleSuggestion(violation.id);
        const fixText = safeText(suggestion.fixExplanation);
        y = flowText(doc, `How to Fix: ${fixText}`, MARGIN, y,
          { fontSize: F_BODY, color: '#334155', spacingAfter: 8 });

        if (index < violations.length - 1) {
          y = ensureSpace(doc, y, 20);
          y = drawRule(doc, y);
        }
      });
    }

    // ---- Indic text (shaped with HarfBuzz) ----
    const indic = audit.indicText;
    if (indic && ((indic.tamil && indic.tamil.length > 0) || (indic.hindi && indic.hindi.length > 0))) {
      y = ensureSpace(doc, y, 40);
      y += 10;
      y = drawRule(doc, y);

      y = flowText(doc, 'INDIC TEXT', MARGIN, y,
        { fontSize: F_SECTION, bold: true, color: '#334155', spacingAfter: 6 });

      const tamilLines = Array.isArray(indic.tamil) ? indic.tamil : [];
      const hindiLines = Array.isArray(indic.hindi) ? indic.hindi : [];

      if (tamilLines.length > 0) {
        y = flowText(doc, 'Tamil:', MARGIN, y,
          { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 2 });
        for (const line of tamilLines) {
          if (!line) continue;
          y = renderIndicParagraph(doc, line, 'taml', MARGIN, y, F_BODY, '#111827', CONTENT_WIDTH);
        }
        y += 6;
      }

      if (hindiLines.length > 0) {
        y = flowText(doc, 'Hindi:', MARGIN, y,
          { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 2 });
        for (const line of hindiLines) {
          if (!line) continue;
          y = renderIndicParagraph(doc, line, 'deva', MARGIN, y, F_BODY, '#111827', CONTENT_WIDTH);
        }
      }
    }

    // ---- Screenshot (visual evidence) — placed last, after all text ----
    if (audit.screenshotUrl) {
      let screenshotPath = null;
      try {
        const screenshotFilename = path.basename(audit.screenshotUrl);
        screenshotPath = path.join(screenshotsDir, screenshotFilename);
        if (!fs.existsSync(screenshotPath)) screenshotPath = null;
      } catch (e) { screenshotPath = null; }

      if (screenshotPath) {
        y = ensureSpace(doc, y, 60);
        y += 12;
        y = drawRule(doc, y);
        y = flowText(doc, 'Visual Evidence', MARGIN, y,
          { fontSize: F_SECTION, bold: true, color: '#334155', spacingAfter: 6 });

        try {
          const img = fs.readFileSync(screenshotPath);
          const maxImgWidth = CONTENT_WIDTH;
          const maxImgHeight = PAGE_HEIGHT_PT - 2 * MARGIN - 40;

          y = ensureSpace(doc, y, maxImgHeight + 10);
          doc.image(img, MARGIN, y, {
            fit: [maxImgWidth, maxImgHeight],
            align: 'center'
          });
          y = doc.y + 15;
        } catch (imgErr) {
          console.error('[PDF] Screenshot could not be embedded:', imgErr.message);
          y = flowText(doc, '(Screenshot could not be embedded)', MARGIN, y,
            { fontSize: F_SMALL, color: '#94A3B8', spacingAfter: 4 });
        }
      }
    }

    drawFooters(doc);
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  })();
}

/**
 * Generates a text-focused PDF report for a stored Source Code Analysis.
 * Reads entirely from the stored audit record — the analysis is never re-run.
 * No screenshot is embedded; the report is English + Tamil + Hindi safe.
 *
 * @param {object} audit - Stored record shape:
 *   { auditType, sourceFiles:[{name,type,size,issues}], score, violations,
 *     indicText:{tamil:[],hindi:[]}, createdAt }
 */
function generateSourceCodePDF(audit) {
  return (async () => {
    console.log('[PDF] generateSourceCodePDF called:', JSON.stringify((audit.sourceFiles || []).map(f => f.name)));

    // Ensure the shaping engine is ready before drawing any Indic text.
    await ensureHarfBuzz();

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: 'Access Check Source Code Analysis Report',
        Author: 'Access Check',
        Subject: 'Source Code Accessibility Analysis Report',
        Creator: 'Access Check PDF Generator'
      }
    });

    const chunks = [];

    // Register fonts (base-14 Helvetica for English/Latin; the bundled Noto
    // subsets for Tamil/Devanagari are used directly via HarfBuzz).
    doc.registerFont('Body', EN_FONT);
    doc.registerFont('BodyBold', EN_BOLD_FONT);

    const violations = Array.isArray(audit.violations) ? audit.violations : [];
    const score = audit.score != null ? audit.score : calculateScore(violations);
    const scoreColor = getScoreColor(score);

    let y = MARGIN;

    // ---- Header ----
    doc.font(EN_BOLD_FONT).fontSize(F_TITLE).fillColor('#0F172A')
      .text('Access Check', MARGIN, y);
    y = doc.y + 6;
    y = flowText(doc, 'Source Code Analysis Report', MARGIN, y,
      { fontSize: F_SUBTITLE, color: '#64748B', spacingAfter: 8 });
    y = drawRule(doc, y);

    // ---- Report information ----
    y = flowText(doc, 'REPORT INFORMATION', MARGIN, y,
      { fontSize: F_SECTION, bold: true, color: '#334155', spacingAfter: 4 });

    y = flowText(doc, 'Report Type:', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, 'Source Code Analysis', MARGIN, y,
      { fontSize: F_BODY, color: '#0F172A', spacingAfter: 4 });

    const sourceFiles = Array.isArray(audit.sourceFiles) ? audit.sourceFiles : [];
    const fileNames = sourceFiles.length ? sourceFiles.map(f => f.name).join(', ') : 'Unknown';
    const fileTypes = sourceFiles.length ? Array.from(new Set(sourceFiles.map(f => f.type || ''))).filter(Boolean).join(', ') || 'Unknown' : 'Unknown';

    y = flowText(doc, 'Source File(s):', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, safeText(fileNames), MARGIN, y,
      { fontSize: F_BODY, color: '#0F172A', spacingAfter: 4 });

    y = flowText(doc, 'File Type(s):', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, safeText(fileTypes), MARGIN, y,
      { fontSize: F_BODY, color: '#0F172A', spacingAfter: 4 });

    let dateStr = 'Unknown';
    try {
      const raw = audit.createdAt;
      if (raw) {
        const normalized = String(raw).endsWith('Z') ? raw : raw + 'Z';
        dateStr = new Date(normalized).toLocaleString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });
      }
    } catch (e) { dateStr = 'Unknown'; }

    y = flowText(doc, 'Analysis Date:', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, dateStr, MARGIN, y,
      { fontSize: F_BODY, color: '#0F172A', spacingAfter: 4 });

    y = flowText(doc, 'Accessibility Score:', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, `${score}/100`, MARGIN, y,
      { fontSize: F_BODY, bold: true, color: scoreColor, spacingAfter: 4 });

    y = flowText(doc, 'Total Issues:', MARGIN, y,
      { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 0 });
    y = flowText(doc, String(violations.length), MARGIN, y,
      { fontSize: F_BODY, bold: true, color: '#0F172A', spacingAfter: 8 });

    y = drawRule(doc, y);

    // ---- Findings ----
    y = flowText(doc, 'ACCESSIBILITY FINDINGS', MARGIN, y,
      { fontSize: F_SECTION, bold: true, color: '#334155', spacingAfter: 6 });

    if (violations.length === 0) {
      y = flowText(doc, 'No accessibility issues were detected in the analyzed source code.', MARGIN, y,
        { fontSize: F_BODY, bold: true, color: '#16A34A', spacingAfter: 4 });
      y = flowText(doc, 'The uploaded files passed the static accessibility checks.', MARGIN, y,
        { fontSize: F_BODY, color: '#475569', spacingAfter: 6 });
    } else {
      violations.forEach((finding, index) => {
        const severity = formatSeverity(finding.impact);
        const sevColor = getSeverityColor(finding.impact);
        const confidence = finding.confidence === 'definite' ? 'Definite' : 'Potential';

        y = flowText(doc, `Finding ${index + 1}`, MARGIN, y,
          { fontSize: F_BODY, bold: true, color: '#0F172A', spacingAfter: 2 });

        y = flowText(doc, `Rule: ${finding.id || 'Unknown'}  |  ${severity} severity  |  ${confidence}`, MARGIN, y,
          { fontSize: F_BODY, bold: true, color: '#334155', spacingAfter: 2 });

        const lineLabel = typeof finding.line === 'number' ? `Line ${finding.line}` : (finding.line || 'Not available');
        y = flowText(doc, `File: ${safeText(finding.file || 'Unknown')}  |  Line: ${lineLabel}`, MARGIN, y,
          { fontSize: F_BODY, color: '#64748B', spacingAfter: 4 });

        const description = safeText(
          finding.description || finding.help || 'Accessibility issue found by the static analyzer.'
        );
        y = flowText(doc, `Description: ${description}`, MARGIN, y,
          { fontSize: F_BODY, color: '#334155', spacingAfter: 4 });

        if (finding.code) {
          y = flowText(doc, 'Source Snippet:', MARGIN, y,
            { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 2 });
          y = drawCodeBox(doc, String(finding.code), MARGIN, y, CONTENT_WIDTH);
        }

        const fixText = safeText(
          finding.fix || getRuleSuggestion(finding.id).fixExplanation
        );
        y = flowText(doc, `Recommended Fix: ${fixText}`, MARGIN, y,
          { fontSize: F_BODY, color: '#334155', spacingAfter: 4 });

        const whyText = safeText(finding.whyItMatters || getRuleSuggestion(finding.id).whyItMatters);
        y = flowText(doc, `Why It Matters: ${whyText}`, MARGIN, y,
          { fontSize: F_BODY, color: '#475569', spacingAfter: 8 });

        if (index < violations.length - 1) {
          y = ensureSpace(doc, y, 20);
          y = drawRule(doc, y);
        }
      });
    }

    // ---- Indic text found in the source ----
    const indic = audit.indicText;
    if (indic && ((indic.tamil && indic.tamil.length > 0) || (indic.hindi && indic.hindi.length > 0))) {
      y = ensureSpace(doc, y, 40);
      y += 10;
      y = drawRule(doc, y);

      y = flowText(doc, 'INDIC TEXT IN SOURCE', MARGIN, y,
        { fontSize: F_SECTION, bold: true, color: '#334155', spacingAfter: 6 });

      const tamilLines = Array.isArray(indic.tamil) ? indic.tamil : [];
      const hindiLines = Array.isArray(indic.hindi) ? indic.hindi : [];

      if (tamilLines.length > 0) {
        y = flowText(doc, 'Tamil:', MARGIN, y,
          { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 2 });
        for (const line of tamilLines) {
          if (!line) continue;
          y = renderMixedParagraph(doc, line, MARGIN, y, F_BODY, '#111827', CONTENT_WIDTH);
        }
        y += 6;
      }

      if (hindiLines.length > 0) {
        y = flowText(doc, 'Hindi:', MARGIN, y,
          { fontSize: F_LABEL, bold: true, color: '#64748B', spacingAfter: 2 });
        for (const line of hindiLines) {
          if (!line) continue;
          y = renderMixedParagraph(doc, line, MARGIN, y, F_BODY, '#111827', CONTENT_WIDTH);
        }
      }
    }

    drawFooters(doc);
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  })();
}

module.exports = { generateAuditPDF, generateSourceCodePDF };
