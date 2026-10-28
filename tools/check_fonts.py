# -*- coding: utf-8 -*-
"""检查 PDF 中每个文本片段实际使用的字体。"""
import sys
import pymupdf

doc = pymupdf.open(sys.argv[1])
for pno, page in enumerate(doc):
    print(f"===== page {pno+1} =====")
    dd = page.get_text("dict")
    for block in dd["blocks"]:
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                txt = span["text"].strip()
                if txt:
                    print(f"  size={span['size']:.1f} italic={span['flags'] & 2 != 0} bold={span['flags'] & 16 != 0} font={span['font']!r} text={txt[:40]!r}")
doc.close()
