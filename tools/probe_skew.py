import os
import pymupdf

path = os.path.join(os.environ['TEMP'], 'skewtest.pdf')
d = pymupdf.open(path)
p = d[0]
for b in p.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        for s in l['spans']:
            print('bbox=%s text=%s' % (s['bbox'], s['text']))
