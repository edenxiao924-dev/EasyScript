# -*- coding: utf-8 -*-
"""检测文字行并把结果写入 txt（避免终端编码问题）。"""
import sys
from PIL import Image

img_path = sys.argv[1]
out_path = sys.argv[2]
xf = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
xr = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0

img = Image.open(img_path).convert("L")
W, H = img.size
x0, x1 = int(W * xf), int(W * xr)
px = img.load()

rows = []
for y in range(H):
    dark = 0
    for x in range(x0, x1, 2):
        if px[x, y] < 100:
            dark += 1
    if dark >= 3:
        rows.append(y)

runs = []
for y in rows:
    if runs and y - runs[-1][1] <= 2:
        runs[-1][1] = y
    else:
        runs.append([y, y])

with open(out_path, "w", encoding="utf-8") as f:
    f.write(f"image {W}x{H}, x range {x0}-{x1}, {len(runs)} runs\n")
    for i, (a, b) in enumerate(runs):
        gap = a - runs[i - 1][1] if i else 0
        f.write(f"line {i+1:2d}: y={a:4d}-{b:4d} h={b-a+1:2d} gap_prev={gap:3d}\n")
print("done", len(runs))
