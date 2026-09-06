import uharfbuzz as hb
import freetype
from PIL import Image
import numpy as np
import pymupdf

FONT = r'C:\Windows\Fonts\Nirmala.ttf'
FONTSIZE = 14.0
DPI = 144
PXPERT = DPI / 72.0
UPEM = 2048
RPPU = 0.25  # reference pixels per font unit (render FT at pixel size 512)

face = hb.Face(open(FONT, 'rb').read())
hbfont = hb.Font(face)
ft = freetype.Face(FONT)
ft.set_pixel_sizes(0, int(UPEM * RPPU))

def shape(text, script):
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties(); buf.direction = 'ltr'; buf.script = script
    hb.shape(hbfont, buf)
    return buf.glyph_infos, buf.glyph_positions

def render_reference(text, script):
    infos, poss = shape(text, script)
    total_w = sum(p.x_advance for p in poss) * RPPU
    W = int(total_w + 800)
    H = 2400
    canvas = np.zeros((H, W), dtype=np.uint8)
    pen = 400  # left margin px
    BASE = 1400  # baseline row (y-down)
    for g, p in zip(infos, poss):
        gid = g.codepoint
        xa = p.x_advance * RPPU
        xo = p.x_offset * RPPU
        ft.load_glyph(gid)
        b = ft.glyph.bitmap
        bw, bh_ = b.width, b.rows
        if bw == 0 or bh_ == 0:
            pen += xa; continue
        left = ft.glyph.bitmap_left * RPPU
        top = ft.glyph.bitmap_top * RPPU
        data = np.frombuffer(bytes(b.buffer), dtype=np.uint8).reshape(bh_, bw)
        x0 = int(pen + xo + left)
        y0 = int(BASE - top)
        x0 = max(0, x0); y0 = max(0, y0)
        y1 = min(H, y0 + bh_); x1 = min(W, x0 + bw)
        if y1 > y0 and x1 > x0:
            canvas[y0:y1, x0:x1] = np.maximum(canvas[y0:y1, x0:x1], data[:y1 - y0, :x1 - x0])
        pen += xa
    mask = canvas > 40
    rows = np.any(mask, axis=1); cols = np.any(mask, axis=0)
    r0, r1 = np.where(rows)[0][[0, -1]]; c0, c1 = np.where(cols)[0][[0, -1]]
    crop = canvas[r0:r1 + 1, c0:c1 + 1]
    return crop

ppu = (FONTSIZE / UPEM) * PXPERT  # px per unit in PDF page render

def pdf_ink(baseline_pt, x_left_pt):
    doc = pymupdf.open('geotest.pdf')
    pix = doc[0].get_pixmap(dpi=DPI)
    im = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
    gray = im.mean(axis=2)
    ink = gray < 190
    base = int(baseline_pt * PXPERT)
    top = max(0, base - int(20 * PXPERT)); bot = min(pix.height, base + int(8 * PXPERT))
    region = ink[top:bot, :]
    rows = np.any(region, axis=1); cols = np.any(region, axis=0)
    if not rows.any(): return None
    r0, r1 = np.where(rows)[0][[0, -1]]; c0, c1 = np.where(cols)[0][[0, -1]]
    return region[r0:r1+1, c0:c1+1].astype(np.uint8) * 255

def compare(label, baseline_pt, text, script):
    ref = render_reference(text, script)
    # downscale reference from RPPU to ppu
    scale = ppu / RPPU
    nw = max(1, int(ref.shape[1] * scale)); nh = max(1, int(ref.shape[0] * scale))
    img = Image.fromarray(ref).resize((nw, nh), Image.LANCZOS)
    refr = np.array(img) > 40
    pdf = pdf_ink(baseline_pt, 50)
    if pdf is None:
        print(label, 'NO PDF INK'); return
    pdfb = pdf > 40
    # align by baseline: refr baseline already at some row; shift both to normalize heights around baseline
    # Crude similarity: resize both to same height and compare intersection over union of row-profiles.
    hmax = max(refr.shape[0], pdfb.shape[0])
    wmax = max(refr.shape[1], pdfb.shape[1])
    def to_common(a):
        H = np.zeros((hmax, wmax), dtype=bool)
        H[:a.shape[0], :a.shape[1]] = a
        return H
    ar = to_common(refr); ap = to_common(pdfb)
    inter = (ar & ap).sum(); union = (ar | ap).sum()
    iou = inter / union if union else 0
    # also count total ink ratio
    print(f'{label}: pdf w={pdfb.shape[1]}h={pdfb.shape[0]}  ref w={refr.shape[1]}h={refr.shape[0]}  IoU={iou:.2f}')

compare('TAMIL', 100, 'வணக்கம் சோதனை உரை', 'taml')
compare('HINDI', 160, 'नमस्ते हिंदी परीक्षण क्ष', 'deva')
