# -*- coding: utf-8 -*-
"""
构建「宋体斜体（SimSun Oblique）」字体，用于蒙太奇画面描述。
1) 以 simsun.ttc 为源，子集到 ASCII + 常用中文标点 + GB2312 全部汉字；
2) 对字形应用几何倾斜（oblique），保留宋体字形；
3) 输出 TTF 与 WOFF2 到 assets/fonts。
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_FONT = r"C:\Windows\Fonts\simsun.ttc"
OUT_DIR = os.path.join(ROOT, "assets", "fonts")
os.makedirs(OUT_DIR, exist_ok=True)

SUBSET_TTF = os.path.join(OUT_DIR, "_subset.ttf")
OBLIQUE_TTF = os.path.join(OUT_DIR, "SimSun-Oblique.ttf")
OBLIQUE_WOFF2 = os.path.join(OUT_DIR, "SimSun-Oblique.woff2")


def gb2312_chars():
    chars = set()
    # GB2312 编码区：0xB0A1..0xF7FE（一级、二级汉字）
    for b1 in range(0xB0, 0xF8):
        for b2 in range(0xA1, 0xFF):
            try:
                ch = bytes([b1, b2]).decode("gb2312")
                if len(ch) == 1:
                    chars.add(ch)
            except Exception:
                pass
    return chars


def build_coverage():
    cov = set()
    # ASCII 可打印
    for c in range(0x20, 0x7F):
        cov.add(chr(c))
    # 常用中文标点 / 全角
    for c in "，。、；：？！“”‘’（）《》〈〉—…·～「」『』〈〉":
        cov.add(c)
    for c in range(0x3000, 0x303F):  # CJK 标点
        cov.add(chr(c))
    for c in range(0xFF00, 0xFFF0):  # 全角拉丁/标点
        cov.add(chr(c))
    # GB2312 汉字
    cov |= gb2312_chars()
    return "".join(sorted(cov))


def main():
    coverage = build_coverage()
    cov_txt = os.path.join(OUT_DIR, "_coverage.txt")
    with open(cov_txt, "w", encoding="utf-8") as f:
        f.write(coverage)
    print("coverage chars:", len(coverage))

    # 1) 子集
    cmd = [
        sys.executable, "-m", "fontTools.subset", SRC_FONT,
        "--font-number=0",
        "--text-file=" + cov_txt,
        "--output-file=" + SUBSET_TTF,
        "--layout-features=*",
        "--glyph-names",
        "--no-hinting",
    ]
    print("subset...")
    subprocess.run(cmd, check=True)

    # 2) 倾斜
    print("skew...")
    skew_font(SUBSET_TTF, OBLIQUE_TTF)

    # 3) WOFF2
    try:
        from fontTools.ttLib import TTFont
        f = TTFont(OBLIQUE_TTF)
        f.flavor = "woff2"
        f.save(OBLIQUE_WOFF2)
        print("woff2 saved")
    except Exception as e:
        print("woff2 skipped:", e)

    for p in (OBLIQUE_TTF, OBLIQUE_WOFF2):
        if os.path.exists(p):
            print(os.path.basename(p), "%.2f KB" % (os.path.getsize(p) / 1024))


def skew_font(src, dst):
    import math
    from fontTools.ttLib import TTFont
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.misc.transform import Identity

    angle_deg = 14.0  # 倾斜角度（度）
    # 注意：Transform.skew 接收的是弧度
    matrix = Identity.skew(-math.radians(angle_deg))

    font = TTFont(src)
    glyph_set = font.getGlyphSet()
    glyf = font["glyf"]
    for name in font.getGlyphOrder():
        pen = TTGlyphPen(glyph_set)
        tpen = TransformPen(pen, matrix)
        glyph_set[name].draw(tpen)
        glyf[name] = pen.glyph()
    # 标记为斜体（元数据）
    if "post" in font:
        font["post"].italicAngle = -angle_deg
    # 重新计算边界/字宽由 TTGlyphPen 处理
    font.save(dst)


if __name__ == "__main__":
    main()
