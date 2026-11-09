# Easy-script Language（剧本语言，.sp）v1.0.0

## 1. Description

得益于 Latex 的灵感，开发的一款轻量级剧本编程语言，专注于内容，不必在于格式。
我们知道 AI 编程是好手，该语言能够让 AI 用编程的思维来编写剧本，并将编写好的剧本自动渲染为 PDF 格式的剧本。
仅需要安装对应的 VScode 插件，就可以在 VSCode 中**左侧写作、右侧实时预览**。

同时它也是 AI Agent 可直接使用的 Skill（`skills/easy-script`），装上后 AI 能写剧本、把小说转成剧本、一键出 PDF。

## 2. 特性

* 完整的剧本元素语法：场景标题、动作、角色、对话、括号（表演提示）、转场、音效、注释
* **v1.0：四类带标识段落** —— `AP`（动作）/ `SP`（场面）/ `SE`（特效）/ `CE`（摄影机角度与剪辑说明），排版与普通动作段落完全一致，标识只作语义锚点，旧写法继续兼容
* **v1.0：大括号可换行** —— `revise` / `MONTAGE` / `AP` / `SP` / `SE` / `CE` 的关键字与 `{` 分两行也识别，`revise` 的新文方括号 `[` `]` 可各自独占一行
* **v1.0：小说转剧本** —— 配套 `skills/easy-script/references/novel-to-script.md`，按场景标题/动作/场面/对话/音效/特效/转场/括号/摄影机把一段小说直接改成标准剧本
* 场景标题支持 dash 字段写法（`# EXT-地点-时间-环境`），便于 AI 遵守规则，并自动编号
* 作者只写内容，页边距 / 字体 / 字号 / 缩进 / 空行全部由编译器统一输出
* 实时预览：输入即渲染（A4 页面，所见即所得）
* 一键导出 PDF：调用系统内置 Edge/Chrome 无头打印，无需联网、无需第三方依赖
* 中文（华文中宋 / 宋体 / 黑体 / 仿宋）与英文（Courier New）精确混排

## 3. 快速开始
### 3.1 前置条件

- 系统：Windows 10/11 首选（中文字体与字体版式与投稿要求一致）；Linux / macOS 可运行，中文字体回退到 Noto Serif/Sans CJK，字形相近但不等同
- VSCode
- Edge / Chrome / Chromium（无头打印 PDF 用，任一即可）
- 从源码构建才需要：Node.js（18+）、Python 3

### 3.2 安装
#### 方式一：让你的 agent 帮你安装（推荐）

告诉你的 agent 助手：

```
帮我安装一个 github 上的剧本写作项目，项目地址：https://github.com/edenxiao924-dev/easy-script
```

如果你用的是支持 Skill 的 agent，直接装 `skills/easy-script` 目录即可（见第 9 节）。

#### 方式二：直接装 .VSIX（普通使用者）

1. 拿到 `screenplay-lang-0.2.2.vsix`（仓库内附带的仍是 0.2.2 版；v1.0.0 请从源码打包）
2. 任选一种安装：
   - 命令行：`code --install-extension screenplay-lang-0.2.2.vsix`
   - 或 VSCode 内：直接将该扩展拖到 vscode 扩展界面里
3. 重载窗口（`Ctrl+Shift+P` → Reload Window）
4. 新建 `.sp` 文件即可使用，无需 Node、无需 `npm install`

#### 若您是开发者
1. 安装 Node.js LTS 版，克隆仓库后用 VSCode 打开项目目录
2. 生成蒙太奇用的斜体字体（建议执行）：
```
pip install fonttools brotli
python tools/build_oblique_font.py
```
3. 两种运行方式：
   - **调试**：直接按 `F5`，会弹出一个加载了该扩展的「扩展开发宿主」新窗口
   - **打包安装**：`npx @vscode/vsce package` 生成 VSIX，再按方式二安装
4. 该项目零运行时依赖，**不需要 `npm install`**

### 3.3 验证
1. 复制下面的代码到你的 VSCode 中（已含 v1.0 四类段落与换行大括号写法）：
```
---
title: 雨会停
author: Eden Xiao
email: haoranxiao@yeah.net
---

# EXT-城市街头-日

SP
{
一条窄巷，墙面潮湿。巷口亮着一盏坏了一半的路灯。
}

AP
{
周奕身披仙袍，手拿宝剑，将魔鬼甲逼到墙角。
}

revise
{
周奕站在巷口。
[
周奕将剑尖压低，往前迈了一步。
]
}

@周奕
邪祟，你残害百姓，罪不容诛。

@魔鬼甲
神君饶命！神君饶命！

CE
{
低角度仰拍周奕，推近到剑尖。
}

周奕没有犹豫，一剑挥出。魔鬼顿时灰飞烟灭。

# INT-别墅谈话-夜

@彭宇
听说你要离开了？

@周奕
嗯，三个月后，到时候我在这边的财产还麻烦你帮我处理。

（彭宇露出肉眼可见的失落表情）

SFX 雷声轰鸣

SE
{
窗外一道白光，把两个人的影子压在墙上。
}

MONTAGE
{
@周奕VO
我是周奕。一名被抛弃的仙神。
他一个人在很好的光里。桌上只有一只杯子。
}

--镜头缓慢向窗外移动，聚焦夜晚天空，转场到酒吧外围。
```
2. VSCode 中：
* `Ctrl+K` 然后 `V`：在右侧打开实时预览
* `Ctrl+Alt+P`：导出同名 PDF
* 也可在编辑器中右键，或命令面板（`Ctrl+Shift+P`）搜索 “Screenplay”
* 导出成功即运行无误，若出现问题可咨询你的 agent 进行修复

完整案例：`examples/空屋-第一章.sp`（小说改编，含 SP/AP/SE/CE/SFX/MONTAGE/转场/对话内括号）。

## 4. 语法速查

| 元素 | 写法 | 说明 |
| ---- | ---- | ---- |
| 标题页 | `---` 内 `title/author/contact` | 独立第 1 页 |
| 场景标题 | `# EXT 城市街头 日` / `# EXT-地点-时间-环境` | 自动编号为 EXT 01；也可识别 INT/EXT |
| 动作 | `AP` + `{ … }`，或普通段落 | 两端对齐；角色名首次出现自动加粗 |
| 场面 | `SP` + `{ … }` | 环境、陈设、空间关系、光线氛围 |
| 特效 | `SE` + `{ … }` | 爆炸、血肉、火光、雨雪等视觉特效 |
| 摄影机 / 剪辑 | `CE` + `{ … }` | 机位、景别、运镜、剪辑节奏 |
| 角色 | `@角色名` | 居中黑体 |
| 画外音 / 画外声 / 接续 | `@角色名VO` / `@角色名OS` / `@角色名CO` | VO 灰色；OS 画外声；CO 渲染 CONT'D |
| 对话 | `@角色名` 后的行 | 宋体，左缩进 3cm / 右缩进 2.7cm |
| 音效 | `SFX 音效内容` | 下划线，右缩进 2.79cm |
| 修订 | `revise{原文 [新文]}`（可换行） | 新文红色，注明日期 #序号 |
| 蒙太奇 | `MONTAGE{ ... }`（可换行） | 标题 MONTAGE NN:，画面描述灰色斜体 |
| 括号 | `（……）` | 仿宋居中；夹在 `@` 与台词之间时并入该段对话 |
| 转场 | `--……` | 首行缩进 2 字符 |
| 分页 | `===` | 强制分页 |
| 注释 | `//` 或 `/* */` | 不渲染 |
| 行内 | `**粗体**` `*斜体*` `__下划线__` |  |

完整语法见 [docs/语法手册.md](docs/语法手册.md)。

## 5. 命令行（可选）

```
node cli.js 剧本.sp                  # 同目录生成 剧本.pdf
node cli.js 剧本.sp --html 预览.html  # 只输出 HTML
node cli.js 剧本.sp --check          # 只解析，输出 AST 与诊断
```

## 6. 构建（可选）

蒙太奇画面描述需要「宋体斜体」字形。由于无头打印不会对中文合成斜体，该字体由脚本从系统宋体确定性生成，**作为构建产物不入库**（已发布的 VSIX 已内置）。从源码克隆后，如需在开发环境中使用，运行一次：

```
pip install fonttools brotli
python tools/build_oblique_font.py
# 生成 assets/fonts/SimSun-Oblique.woff2（与 .ttf）
```

未生成时，扩展仍可正常运行，仅蒙太奇画面描述回退为正体宋体。

## 7. 排版规格

* 页面 A4；上 / 下 2.54cm，左 / 右 3.81cm
* 标题：华文中宋 / Courier New，28pt，倾斜，居中
* 作者 / 联系方式：宋体 / Courier New，14pt，居中
* 场景标题：宋体 / Courier New，11pt，加粗，两端对齐，其前空两行
* 动作 / 场面 / 特效 / 摄影机-剪辑：宋体 / Courier New，10pt，两端对齐（四者完全一致）
* 角色名：黑体 / Courier New，10pt，居中
* 对话：宋体 / Courier New，10pt，左缩进 3cm / 右缩进 2.7cm
* 括号：仿宋 / Courier New，10pt，居中
* 转场：宋体 / Courier New，10pt，首行缩进 2 字符，以 `--` 开头

## 8. 字体依赖

Windows 自带：华文中宋（STZhongsong）、宋体（SimSun）、黑体（SimHei）、仿宋（FangSong）、Courier New。请确保你的电脑已经安装了这些字体。
非 Windows 环境自动回退到 Noto Serif CJK SC / Noto Sans CJK SC；Linux 上无头打印额外需要 `--no-sandbox`（v1.0 已内置）。

## 9. 作为 AI Skill 使用

`skills/easy-script` 是可直接发给 AI Agent 的技能包（只要四个文件）：

```
skills/easy-script/
├── SKILL.md                       # 触发描述 + 工作流 + 硬规则
├── references/syntax.md           # 完整语法（EBNF、排版规格、诊断）
├── references/novel-to-script.md  # 小说转剧本的方法与自查清单
└── assets/template.sp             # 起手模板
```

使用时把整个目录放入你的 skill 根目录（如 `workspace/.user_skills/easy-script`），同时保证 `src/` 引擎可被 `scripts/render.js` 找到；或把 `src/` 下四个引擎文件复制到 `skills/easy-script/scripts/` 使其完全独立运行。

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
│   ├── pdf.js                        # Edge/Chrome/Chromium 无头打印
│   └── extension.js                  # VSCode 扩展：实时预览 + 导出
├── cli.js                            # 命令行编译器
├── skills/easy-script/               # AI Skill 包（SKILL.md + references + assets）
├── examples/雨会停.sp  examples/v02演示.sp  examples/空屋-第一章.sp
├── tools/build_oblique_font.py       # 构建宋体斜体（生成 assets/fonts/*.woff2）
├── assets/fonts/                     # 字体构建产物（不入库，见“构建”）
└── docs/语法手册.md
```

## License

MIT
