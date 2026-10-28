# -*- coding: utf-8 -*-
"""检测图片中文字行的 y 坐标区间（投影法），用于精确核对行间距。"""
import sys
from PIL import Image

img = Image.open(sys.argv[1]).convert("L")
W, H = img.size
# 可缩小检测的 x 范围（参数 3,4 为左右边界比例）
xf = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
xr = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
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

# 合并连续行
runs = []
for y in rows:
    if runs and y - runs[-1][1] <= 2:
        runs[-1][1] = y
    else:
        runs.append([y, y])
for i, (a, b) in enumerate(runs):
    gap_before = a - runs[i - 1][1] if i else 0
    print(f"line {i+1:2d}: y={a:4d}-{b:4d}  h={b-a+1:2d}  gap_prev={gap_before:3d}")
