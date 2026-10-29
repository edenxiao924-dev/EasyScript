import pymupdf

d = pymupdf.open(r'examples\v02演示.pdf')
p = d[1]
for b in p.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        for s in l['spans']:
            t = s['text']
            if t.startswith(('他一个人', '他做一件', '他把剑')):
                x0 = s['bbox'][0]
                italic = bool(s['flags'] & 2)
                print('x0=%.1f size=%s italic=%s color=%s font=%s text=%s' % (
                    x0, s['size'], italic, s['color'], s['font'], t))
