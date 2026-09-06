import uharfbuzz as hb
import io, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
face = hb.Face(open(r'C:\Windows\Fonts\Nirmala.ttf','rb').read())
font = hb.Font(face)
samp = {
 'tam': ('taml','வணக்கம் இது ஒரு தமிழ் சோதனை உரை ஆகும்.'),
 'dev': ('deva','नमस्ते यह एक हिंदी परीक्षण पाठ है।'),
}
for name,(script,text) in samp.items():
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    buf.direction = 'ltr'
    buf.script = script
    hb.shape(font, buf)
    infos = buf.glyph_infos
    poss = buf.glyph_positions
    print('====',name,'input:',text)
    print('====',name,'glyphs',len(infos))
    for g,p in zip(infos,poss):
        print('  gid=%s cluster=%s xa=%s xo=%s'%(g.codepoint,g.cluster,p.x_advance,p.x_offset))
