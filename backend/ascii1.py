from PIL import Image
import numpy as np

im = np.array(Image.open('page2.png').convert('L'))
h, w = im.shape
# crop the INDIC region (rows 330..830, full width)
top, bot = 330, 830
crop = im[top:bot, :]
ink = crop < 210
# downsample to ASCII grid: block size
bw = 12
bh = 6
chars = ' .:-=+*#%@'
out = []
for y in range(0, crop.shape[0], bh):
    line = ''
    for x in range(0, crop.shape[1], bw):
        block = ink[y:y+bh, x:x+bw]
        frac = block.mean() if block.size else 0
        idx = int(frac * (len(chars) - 1))
        line += chars[idx]
    out.append(line)
for ln in out:
    print(ln)
