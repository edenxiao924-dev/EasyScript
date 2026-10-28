# Screenplay Language（剧本语言，.sp）

一种专为**剧本创作与 AI 写作**设计的轻量标记语言：纯文本、中英双语、零标签噪音；在 VSCode 中**左侧写作、右侧实时预览**，一键导出排版精确的 PDF。

## 特性

* 完整的剧本元素语法：场景标题、动作、角色、对话、括号（表演提示）、转场、注释
* 作者只写内容，页边距 / 字体 / 字号 / 缩进 / 空行全部由编译器统一输出
* 实时预览：输入即渲染（A4 页面，所见即所得）
* 一键导出 PDF：调用系统内置 Edge/Chrome 无头打印，无需联网、无需第三方依赖
* 中文（华文中宋 / 宋体 / 黑体 / 仿宋）与英文（Courier New）精确混排

## 快速开始

1. 新建一个 `雨会停.sp`（UTF-8）：

```
---
title: 雨会停
author: Eden Xiao
contact: 18084992319
---

# EXT 城市街头 日

一个巷子，周奕身披仙袍，手拿宝剑，将魔鬼甲逼到墙角。

@周奕
邪祟，你残害百姓，罪不容诛。

（彭宇露出肉眼可见的失落表情）

--镜头缓慢向窗外移动，聚焦夜晚天空，然后又往下抬升，转场到酒吧外围。
```

2. VSCode 中：

* `Ctrl+K` 然后 `V`：在右侧打开实时预览
* `Ctrl+Alt+P`：导出同名 PDF
* 也可在编辑器中右键，或命令面板（`Ctrl+Shift+P`）搜索 “Screenplay”

## 语法速查

| 元素   | 写法                             | 说明                     |
| ---- | ------------------------------ | ---------------------- |
| 标题页  | `---` 内 `title/author/contact` | 独立第 1 页                |
| 场景标题 | `# EXT 城市街头 日`                 | 自动编号为 EXT 01；也可识别 INT/EXT |
| 动作   | 普通段落                           | 两端对齐                   |
| 角色   | `@角色名`                         | 居中黑体                   |
| 对话   | `@角色名` 后的行                     | 宋体，左缩进 3cm / 右缩进 2.7cm |
| 括号   | `（……）`                         | 仿宋居中                   |
| 转场   | `--……`                         | 首行缩进 2 字符              |
| 分页   | `===`                          | 强制分页                   |
| 注释   | `//` 或 `/* */`                 | 不渲染                    |
| 行内   | `**粗体**` `*斜体*` `__下划线__`      |                        |

完整语法见 [docs/语法手册.md](docs/语法手册.md)。

## 命令行（可选）

```
node cli.js 剧本.sp                 # 同目录生成 剧本.pdf
node cli.js 剧本.sp --html 预览.html# 只输出 HTML
node cli.js 剧本.sp --check         # 只解析，输出 AST 与诊断
```

## 排版规格

* 页面 A4；上 / 下 2.54cm，左 / 右 3.81cm
* 标题：华文中宋 / Courier New，28pt，倾斜，居中
* 作者 / 联系方式：宋体 / Courier New，14pt，居中
* 场景标题：宋体 / Courier New，11pt，加粗，两端对齐，其前空两行
* 动作：宋体 / Courier New，10pt，两端对齐
* 角色名：黑体 / Courier New，10pt，居中
* 对话：宋体 / Courier New，10pt，左缩进 3cm / 右缩进 2.7cm
* 括号：仿宋 / Courier New，10pt，居中
* 转场：宋体 / Courier New，10pt，首行缩进 2 字符，以 `--` 开头

## 字体依赖

Windows 自带：华文中宋（STZhongsong）、宋体（SimSun）、黑体（SimHei）、仿宋（FangSong）、Courier New。

## 目录结构

```
screenplay-lang/
├── package.json                      # 扩展清单
├── language-configuration.json       # 括号/注释/自动配对
├── syntaxes/screenplay.tmLanguage.json
├── src/
│   ├── parser.js                     # 解析器
│   ├── renderer.js                   # HTML 渲染（含全部排版 CSS）
│   ├── compiler.js
│   ├── pdf.js                        # Edge/Chrome 无头打印
│   └── extension.js                  # VSCode 扩展：实时预览 + 导出
├── cli.js                            # 命令行编译器
├── examples/雨会停.sp
└── docs/语法手册.md
```

## License

MIT