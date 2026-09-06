import uharfbuzz as hb
import freetype
import numpy as np

FONT = r'C:\Windows\Fonts\Nirmala.ttf'
face = hb.Face(open(FONT, 'rb').read())
hbfont = hb.Font(face)
ft = freetype.Face(FONT)
ft.set_pixel_sizes(0, 512)

buf = hb.Buffer()
buf.add_str('நம')
buf.guess_segment_properties(); buf.direction='ltr'; buf.script='taml'
hb.shape(hbfont, buf)
for g, p in zip(buf.glyph_infos, buf.glyph_positions):
    gid = g.codepoint
    ft.load_glyph(gid)
    b = ft.glyph.bitmap
    print('gid', gid, 'xa', p.x_advance, 'xo', p.x_offset, 'bmp', b.width, b.rows, 'left', ft.glyph.bitmap_left, 'top', ft.glyph.bitmap_top)
