# -*- coding: utf-8 -*-
"""裁剪图片区域用于对比。crop.py <img> <out> <left_frac> <top_frac> <right_frac> <bottom_frac>"""
import sys
import pymupdf

img, out = sys.argv[1], sys.argv[2]
l, t, r, b = map(float, sys.argv[3:7])
pix = pymupdf.Pixmap(img)
W, H = pix.width, pix.height
clip = pymupdf.IRect(int(W*l), int(H*t), int(W*r), int(H*b))
pix2 = pymupdf.Pixmap(pix, clip)
pix2.save(out)
print(out, pix2.width, pix2.height)
