from PIL import Image
import numpy as np
im = np.array(Image.open('page2.png').convert('L'))
h,w = im.shape
ink = im < 200
rows = ink.sum(axis=1)
# print row band summary for ink regions
inband=False; start=0
bands=[]
for r in range(h):
    if ink[r].sum()>3 and not inband:
        inband=True; start=r
    elif ink[r].sum()<=3 and inband:
        inband=False; bands.append((start,r))
if inband: bands.append((start,h))
for (a,b) in bands:
    print('band rows %d-%d  height %d  maxink %d'%(a,b,b-a,ink[a:b].sum(axis=1).max()))
