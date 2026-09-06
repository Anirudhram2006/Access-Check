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
RPPU = 0.25

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
    W = int(total_w + 800); H = 2400
    canvas = np.zeros((H, W), dtype=np.uint8)
    pen = 400; BASE = 1400
    for g, p in zip(infos, poss):
        xa = p.x_advance * RPPU; xo = p.x_offset * RPPU
        ft.load_glyph(g.codepoint)
        b = ft.glyph.bitmap; bw, bh_ = b.width, b.rows
        if bw == 0 or bh_ == 0:
            pen += xa; continue
        left = ft.glyph.bitmap_left * RPPU; top = ft.glyph.bitmap_top * RPPU
        data = np.frombuffer(bytes(b.buffer), dtype=np.uint8).reshape(bh_, bw)
        x0 = max(0, int(pen + xo + left)); y0 = max(0, int(BASE - top))
        y1 = min(H, y0 + bh_); x1 = min(W, x0 + bw)
        if y1 > y0 and x1 > x0:
            canvas[y0:y1, x0:x1] = np.maximum(canvas[y0:y1, x0:x1], data[:y1 - y0, :x1 - x0])
        pen += xa
    mask = canvas > 40
    rows = np.any(mask, axis=1); cols = np.any(mask, axis=0)
    r0, r1 = np.where(rows)[0][[0, -1]]; c0, c1 = np.where(cols)[0][[0, -1]]
    return canvas[r0:r1 + 1, c0:c1 + 1]

ppu = (FONTSIZE / UPEM) * PXPERT

def pdf_ink(baseline_pt):
    doc = pymupdf.open('geotest.pdf')
    pix = doc[0].get_pixmap(dpi=DPI)
    im = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
    gray = im.mean(axis=2)
    ink = gray < 190
    base = int(baseline_pt * PXPERT)
    top = max(0, base - int(40 * PXPERT)); bot = min(pix.height, base + int(40 * PXPERT))
    region = ink[top:bot, :]
    rows = np.any(region, axis=1); cols = np.any(region, axis=0)
    if not rows.any(): return None
    r0, r1 = np.where(rows)[0][[0, -1]]; c0, c1 = np.where(cols)[0][[0, -1]]
    return region[r0:r1 + 1, c0:c1 + 1].astype(bool)

def best_iou(a, b, scale_to_b):
    # resize b (reference) to a's size, then search best shift
    from PIL import Image as Im
    im = Im.fromarray((b.astype(np.uint8)) * 255)
    im = im.resize((a.shape[1], a.shape[0]), Im.LANCZOS)
    br = np.array(im) > 40
    best = 0; best_rc = None
    H, W = a.shape
    for dr in range(-4, 5, 2):
        for dc in range(-4, 5, 2):
            ar = np.roll(a, (dr, dc), axis=(0, 1))
            inter = (ar & br).sum(); union = (ar | br).sum()
            if union and inter / union > best:
                best = inter / union; best_rc = (dr, dc)
    return best, best_rc

def run(label, baseline_pt, text, script):
    ref = render_reference(text, script)
    scale = ppu / RPPU
    nw = max(1, int(ref.shape[1] * scale)); nh = max(1, int(ref.shape[0] * scale))
    refr = np.array(Image.fromarray(ref).resize((nw, nh), Image.LANCZOS)) > 40
    pdf = pdf_ink(baseline_pt)
    iou, _ = best_iou(pdf, refr, True)
    print(f'{label}: pdf {pdf.shape[1]}x{pdf.shape[0]} ref {refr.shape[1]}x{refr.shape[0]} aligned_IoU={iou:.2f}')

run('TAMIL', 100, 'வணக்கம் சோதனை உரை', 'taml')
run('HINDI', 160, 'नमस्ते हिंदी परीक्षण क्ष', 'deva')
