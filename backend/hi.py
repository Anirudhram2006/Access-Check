import pymupdf
import numpy as np
doc = pymupdf.open('geotest.pdf')
pix = doc[0].get_pixmap(dpi=200)
im = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
gray = im.mean(axis=2)
ink = gray < 200
# Hindi line at baseline 160pt -> row 160*200/72=444px
base = int(160 * 200 / 72)
top = base - 40; bot = base + 25
region = ink[top:bot, :]
rows = np.any(region, axis=1); cols = np.any(region, axis=0)
r0, r1 = np.where(rows)[0][[0, -1]]; c0, c1 = np.where(cols)[0][[0, -1]]
print('hindi ink bbox rows', r0, r1, 'cols', c0, c1, 'width_px', c1 - c0, 'height_px', r1 - r0)
# width in points
pp = 200 / 72.0
print('width_pt', (c1 - c0) / pp)
# ASCII art
cr = region[r0:r1 + 1, c0:c1 + 1]
bw = 6; bh = 3
chars = ' .:-=+*#%@'
for y in range(0, cr.shape[0], bh):
    line = ''
    for x in range(0, cr.shape[1], bw):
        blk = cr[y:y + bh, x:x + bw]
        fr = blk.mean() if blk.size else 0
        line += chars[int(fr * (len(chars) - 1))]
    print(line)
