# -*- coding: utf-8 -*-
import sys, traceback
import pymupdf

try:
    img, out, l, t, r, b = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:7])
    pix = pymupdf.Pixmap(img)
    W, H = pix.width, pix.height
    print("src", W, H, "alpha", pix.alpha, "n", pix.n)
    x0, y0, x1, y1 = int(W*l), int(H*t), int(W*r), int(H*b)
    # 用 Pillow 兜底裁剪
    try:
        from PIL import Image
        im = Image.open(img).crop((x0, y0, x1, y1))
        im.save(out)
        print("pil ok", out, im.size)
    except ImportError:
        clip = pymupdf.IRect(x0, y0, x1, y1)
        pix2 = pymupdf.Pixmap(pix, clip)
        pix2.save(out)
        print("fitz ok", out, pix2.width, pix2.height)
except Exception:
    traceback.print_exc()
    sys.exit(1)
