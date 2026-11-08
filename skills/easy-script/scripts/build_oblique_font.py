# -*- coding: utf-8 -*-
"""
构建「宋体斜体（SimSun Oblique）」字体，供 MONTAGE 画面描述使用。
无头打印不会对中文合成斜体，因此需要一份真实倾斜字形。

1) 以系统 simsun.ttc 为源，子集到 ASCII + 常用中文标点 + GB2312 汉字；
2) 对字形应用几何倾斜（oblique），保留宋体字形；
3) 输出 WOFF2 到 assets/oblique/（渲染器会自动加载）。

依赖：
    pip install fonttools brotli

用法：
    python scripts/build_oblique_font.py
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "oblique")
os.makedirs(OUT_DIR, exist_ok=True)

SUBSET_TTF = os.path.join(OUT_DIR, "_subset.ttf")
OBLIQUE_TTF = os.path.join(OUT_DIR, "SimSun-Oblique.ttf")
OBLIQUE_WOFF2 = os.path.join(OUT_DIR, "SimSun-Oblique.woff2")


def find_source_font():
    candidates = [
        r"C:\Windows\Fonts\simsun.ttc",
        "/usr/share/fonts/truetype/simsun/simsun.ttc",
        "/System/Library/Fonts/Songti.ttc",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    raise SystemExit("未找到宋体源文件（simsun.ttc）。请在 Windows 上运行本脚本，或用 --src 指定字体路径。")


def gb2312_chars():
    chars = set()
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
    for c in range(0x20, 0x7F):
        cov.add(chr(c))
    for c in "，。、；：？！“”‘’（）《》〈〉—…·～「」『』":
        cov.add(c)
    for c in range(0x3000, 0x303F):
        cov.add(chr(c))
    for c in range(0xFF00, 0xFFF0):
        cov.add(chr(c))
    cov |= gb2312_chars()
    return "".join(sorted(cov))


def skew_font(src, dst):
    import math
    from fontTools.ttLib import TTFont
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.misc.transform import Identity

    angle_deg = 14.0
    matrix = Identity.skew(-math.radians(angle_deg))

    font = TTFont(src)
    glyph_set = font.getGlyphSet()
    glyf = font["glyf"]
    for name in font.getGlyphOrder():
        pen = TTGlyphPen(glyph_set)
        tpen = TransformPen(pen, matrix)
        glyph_set[name].draw(tpen)
        glyf[name] = pen.glyph()
    if "post" in font:
        font["post"].italicAngle = -angle_deg
    font.save(dst)


def main():
    src = sys.argv[sys.argv.index("--src") + 1] if "--src" in sys.argv else find_source_font()
    print("源字体：", src)

    coverage = build_coverage()
    cov_txt = os.path.join(OUT_DIR, "_coverage.txt")
    with open(cov_txt, "w", encoding="utf-8") as f:
        f.write(coverage)
    print("子集字符数：", len(coverage))

    subprocess.run([
        sys.executable, "-m", "fontTools.subset", src,
        "--font-number=0",
        "--text-file=" + cov_txt,
        "--output-file=" + SUBSET_TTF,
        "--layout-features=*",
        "--glyph-names",
        "--no-hinting",
    ], check=True)

    skew_font(SUBSET_TTF, OBLIQUE_TTF)

    from fontTools.ttLib import TTFont
    f = TTFont(OBLIQUE_TTF)
    f.flavor = "woff2"
    f.save(OBLIQUE_WOFF2)

    for p in (OBLIQUE_TTF, OBLIQUE_WOFF2):
        print(os.path.basename(p), "%.0f KB" % (os.path.getsize(p) / 1024))
    print("完成。渲染器将自动使用该字体渲染 MONTAGE 画面描述。")


if __name__ == "__main__":
    main()
