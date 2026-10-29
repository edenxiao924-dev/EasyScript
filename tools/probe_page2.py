import pymupdf

d = pymupdf.open(r'examples\v02演示.pdf')
p = d[1]
for b in p.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        for s in l['spans']:
            print('y0=%.1f y1=%.1f x0=%.1f font=%s color=%s text=%s' % (
                s['bbox'][1], s['bbox'][3], s['bbox'][0], s['font'], s['color'], s['text'][:30]))
