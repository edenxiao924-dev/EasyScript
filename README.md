# Easy-script Language（剧本语言，.sp）

## 1. Description

得益于Latex的灵感，开发的一款轻量级剧本编程语言，专注于内容，不必在于格式。
我们知道AI编程是好手，该语言能够让AI用编程的思维来编写剧本，并将编写好的剧本自动渲染为PDF格式的剧本。
仅需要安装对应的VScode插件，就可以在 VSCode 中**左侧写作、右侧实时预览**。

## 2. 特性

* 完整的剧本元素语法：场景标题、动作、角色、对话、括号（表演提示）、转场、音效、注释
* 场景标题支持 dash 字段写法（`# EXT-地点-时间-环境`），便于 AI 遵守规则，并自动编号
* 作者只写内容，页边距 / 字体 / 字号 / 缩进 / 空行全部由编译器统一输出
* 实时预览：输入即渲染（A4 页面，所见即所得）
* 一键导出 PDF：调用系统内置 Edge/Chrome 无头打印，无需联网、无需第三方依赖
* 中文（华文中宋 / 宋体 / 黑体 / 仿宋）与英文（Courier New）精确混排

## 3. 快速开始
### 3.1 前置条件

- 系统：Windows 10/11（中文字体和 PDF 引擎都依赖 Windows 自带组件）
- VSCode
- Edge 或 Chrome（无头打印 PDF 用，二选一即可）
- 从源码构建才需要：Node.js（18+）、Python 3

### 3.2 安装
#### 方式一：让你的agent帮你安装

告诉你的agent助手：

```

帮我安装一个github上的剧本写作项目，项目地址：https://github.com/edenxiao924-dev/easy-script

```

#### 方式二：直接装 .VSIX（普通使用者，推荐）

1. 拿到 `screenplay-lang-0.2.1.vsix`
2. 任选一种安装：
   - 命令行：`code --install-extension screenplay-lang-0.2.1.vsix`。
   - 或 VSCode 内：直接将该扩展拖到vscode扩展界面里。
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
   - **打包安装**：`npx @vscode/vsce package` 生成 VSIX，再按方式一安装
4. 该项目零运行时依赖，**不需要 `npm install`**

### 3.3 验证
1. 请您复制下面的代码到你的VSCode中：
```
---
title: 雨会停
author: Eden Xiao
email: haoranxiao@yeah.net
---
# EXT-城市街头-日

revise{
一个巷子，周奕身披仙袍，手拿宝剑，将魔鬼甲逼到墙角。[巷子，周奕身披仙袍，手拿宝剑，将魔鬼甲逼到墙角。]
}

@周奕
邪祟，你残害百姓，罪不容诛。

@魔鬼甲
神君饶命！神君饶命！

周奕没有犹豫，一剑挥出。魔鬼顿时灰飞烟灭。周奕走出巷子。转眼间样貌瞬间变成了一个20出头、青春洋溢的大学生。

# INT-别墅谈话-夜

周奕回到别墅。他在人类世界的好朋友彭宇在别墅的沙发上坐着，见他回来。

@彭宇
听说你要离开了？

@周奕
嗯，三个月后，到时候我在这边的财产还麻烦你帮我处理。

@彭宇
去去去，我才不要，你自己处理。

（彭宇露出肉眼可见的失落表情）

@周奕
到时候麻烦你捐给WG慈善基金会。

@彭宇
周奕，你当年救我。我多想报答你，可是你什么都不缺，现在你要走了，我……

彭宇没有再往下说下去。周奕只是拍了拍彭宇的肩膀，没有再说什么。

@彭宇
走，那今晚去酒吧！就当为你饯行了，不醉不归！

（说完，两人出门，准备去酒吧）

--镜头缓慢像窗外移动，聚焦夜晚天空，然后又往下抬升，转场到酒吧外围。

# EXT-酒吧-夜
酒吧里面正在播放音乐，周奕和彭宇走进酒吧，周围的灯光闪烁，气氛热烈。
@周奕
来，我们坐这里吧
@彭宇
好啊，今晚就好好放松一下。


# EXT-城市街头-日-晴

一个巷子，周奕身披仙袍，手拿宝剑，将魔鬼甲逼到墙角。

@周奕VO
我是周奕，是天界下凡的一位神君。来人界30年，吃喝玩乐，偶尔也拯救世界。

@彭宇OS
快走了，我都等不及了！

@魔鬼甲
神君饶命！神君饶命！

revise{一个巷子，周奕身披仙袍，手拿宝剑，将魔鬼甲逼到墙角。
[一栋高楼，周奕站在顶楼楼边，手拿宝剑，眼神紧闭。]
}

SFX 雷声轰鸣

@彭宇CO
少爷别傻站着了！

MONTAGE{
@周奕VO
我是周奕。一名被抛弃的仙神。
他一个人在很好的光里。桌上只有一只杯子。
@周奕VO
来人间三百年。除了苟着、享受生活，
他做一件极慢的事——慢到不像在做，像在等。
@周奕VO
偶尔也兼职除魔卫道。
他把剑收回鞘，转身走出巷子。
}
EXT-城市街头-日-晴
```
2. VSCode 中：
* `Ctrl+K` 然后 `V`：在右侧打开实时预览
* `Ctrl+Alt+P`：导出同名 PDF，导出的文件与仓库中的[《雨会停》](雨会停.pdf)一致。
* 也可在编辑器中右键，或命令面板（`Ctrl+Shift+P`）搜索 “Screenplay”
* 导出成功即运行无误，若出现问题可咨询你的agent进行修复。


## 4. 语法速查

| 元素 | 写法 | 说明 |
| ---- | ---- | ---- |
| 标题页 | `---` 内 `title/author/contact` | 独立第 1 页 |
| 场景标题 | `# EXT 城市街头 日` / `# EXT-地点-时间-环境` | 自动编号为 EXT 01；也可识别 INT/EXT |
| 动作 | 普通段落 | 两端对齐；角色名首次出现自动加粗 |
| 角色 | `@角色名` | 居中黑体 |
| 画外音/画外声/接续 | `@角色名VO` / `@角色名OS` / `@角色名CO` | VO 灰色；OS 画外声；CO 渲染 CONT'D |
| 对话 | `@角色名` 后的行 | 宋体，左缩进 3cm / 右缩进 2.7cm |
| 音效 | `SFX 音效内容` | 下划线，右缩进 2.79cm |
| 修订 | `revise{原文 [新文]}` | 新文红色，注明日期 #序号 |
| 蒙太奇 | `MONTAGE{ ... }` | 标题 MONTAGE NN:，画面描述灰色斜体 |
| 括号 | `（……）` | 仿宋居中 |
| 转场 | `--……` | 首行缩进 2 字符 |
| 分页 | `===` | 强制分页 |
| 注释 | `//` 或 `/* */` | 不渲染 |
| 行内 | `**粗体**` `*斜体*` `__下划线__` |  |

完整语法见 [docs/语法手册.md](docs/语法手册.md)。

## 5. 命令行（可选）

```
node cli.js 剧本.sp                 # 同目录生成 剧本.pdf
node cli.js 剧本.sp --html 预览.html # 只输出 HTML
node cli.js 剧本.sp --check         # 只解析，输出 AST 与诊断
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
* 动作：宋体 / Courier New，10pt，两端对齐
* 角色名：黑体 / Courier New，10pt，居中
* 对话：宋体 / Courier New，10pt，左缩进 3cm / 右缩进 2.7cm
* 括号：仿宋 / Courier New，10pt，居中
* 转场：宋体 / Courier New，10pt，首行缩进 2 字符，以 `--` 开头

## 8. 字体依赖

Windows 自带：华文中宋（STZhongsong）、宋体（SimSun）、黑体（SimHei）、仿宋（FangSong）、Courier New。请确保你的电脑已经安装了这些字体。

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
├── examples/雨会停.sp  examples/v02演示.sp
├── tools/build_oblique_font.py       # 构建宋体斜体（生成 assets/fonts/*.woff2）
├── assets/fonts/                     # 字体构建产物（不入库，见“构建”）
└── docs/语法手册.md
```

## License

MIT
