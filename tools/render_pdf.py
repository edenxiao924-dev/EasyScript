# -*- coding: utf-8 -*-
"""把 PDF 每页渲染成 PNG，用于排版核验。用法: python render_pdf.py <pdf> <out_dir> [zoom]"""
import sys, os
import pymupdf

pdf_path = sys.argv[1]
out_dir = sys.argv[2]
zoom = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
os.makedirs(out_dir, exist_ok=True)

doc = pymupdf.open(pdf_path)
print("page count:", doc.page_count)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    out = os.path.join(out_dir, f"page_{i+1}.png")
    pix.save(out)
    print(out, f"{page.rect.width:.1f}x{page.rect.height:.1f}pt")
    # 输出文本块，便于核对位置
    for b in page.get_text("blocks"):
        x0, y0, x1, y1, text = b[0], b[1], b[2], b[3], b[4].replace("\n", " ")
        print(f"  block ({x0:.1f},{y0:.1f})-({x1:.1f},{y1:.1f}): {text[:60]}")
doc.close()
