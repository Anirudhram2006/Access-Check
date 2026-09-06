from PIL import Image
import numpy as np
from scipy import ndimage

# Render all pages and check for tofu boxes + out-of-bounds + overlaps
import pymupdf
doc = pymupdf.open('test-output.pdf')

def analyze(page, dpi=150):
    pix = page.get_pixmap(dpi=dpi)
    im = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    gray = im[:, :, 0].astype(int)
    ink = gray < 180
    scale = dpi / 72.0
    H, W = ink.shape
    # bounds in points
    right_bound = 595 * scale
    bottom_bound = 842 * scale
    lbl, n = ndimage.label(ink)
    # find components that look like tofu: roughly rectangular hollow boxes
    tofu = []
    oob = []
    min_side = 5 * scale
    slices = ndimage.find_objects(lbl)
    for i, sl in enumerate(slices[:n], 1):
        comp = (lbl[sl] == i)
        ch, cw = comp.shape
        area = comp.sum()
        # tofu: large hollow rectangle -> perimeter area mostly empty but bounding box near-full
        fill = area / (ch * cw)
        # detect component bbox extending beyond page
        r0, r1 = sl[0].start, sl[0].stop - 1
        c0, c1 = sl[1].start, sl[1].stop - 1
        if r1 > bottom_bound or c1 > right_bound or c0 < 0 or r0 < 0:
            oob.append((ch, cw))
    return tofu, oob, (H, W, scale)

for i in range(doc.page_count):
    tofu, oob, info = analyze(doc[i])
    H, W, scale = info
    print(f'page {i+1}: size {W}x{H}px, tofu={len(tofu)}, out_of_bounds_components={len(oob)}')
