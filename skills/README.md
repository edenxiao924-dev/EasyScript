# skills/

本目录存放可直接交给 AI Agent 使用的 Skill。

## easy-script（易剧本）

`.sp` 剧本语言的 Skill：Agent 读完 `skills/easy-script/SKILL.md` 就能自己写剧本、自己校验、自己导出 PDF。

v1.0 起支持 `AP`（动作）/ `SP`（场面）/ `SE`（特效）/ `CE`（摄影机与剪辑）四类带标识段落（排版与普通动作段落完全一致），并新增 `references/novel-to-script.md`：用户直接给一段小说时，按「切场 → 抽事件 → 外化内心 → 落元素」改写成标准剧本。

安装：克隆仓库后，把 `skills/easy-script` 复制到你自己的 skills 根目录。若希望脱离仓库完全独立运行，再把 `src/` 下的 `parser.js renderer.js compiler.js pdf.js` 复制到该 Skill 的 `scripts/` 目录。

用法：

```
node scripts/render.js 剧本.sp --check        # 语法体检，退出码 2 表示有错
node scripts/render.js 剧本.sp -o 剧本.pdf     # 导出 PDF
```

蒙太奇画面描述需要宋体斜体字形：仓库形态下运行 `python tools/build_oblique_font.py`，独立安装形态下运行 `scripts/build_oblique_font.py`（两者都需 `pip install fonttools brotli`）。不生成也能正常出 PDF，只是灰色斜体回退为正体宋体。

要求：Node.js 18+；Edge/Chrome/Chromium（PDF 打印）。中文字体在 Windows 上最完整，Linux/macOS 自动回退 Noto CJK。
