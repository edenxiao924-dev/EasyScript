'use strict';
/*
 * Screenplay Language (.sp) —— HTML 渲染器
 * 输出可直接用于：
 *   1) VSCode Webview 实时预览（@media screen 下渲染为 A4 白纸）；
 *   2) Edge/Chrome 无头打印 PDF（@media print + @page 精确控制版心）。
 *
 * 排版规格（与用户需求一一对应）：
 *   页面：A4；上/下边距 2.54cm；左/右边距 3.81cm
 *   标题页：标题 华文中宋/Courier New 28pt 倾斜 居中 单倍行距；
 *           作者、联系方式 宋体/Courier New 14pt 居中 单倍行距
 *   正文：
 *     场景标题 宋体/Courier New 11pt 两端对齐 无首行缩进；其前空两行
 *     动作段落 宋体/Courier New 10pt 两端对齐 无首行缩进
 *     角色名   黑体/Courier New 10pt 居中 无缩进
 *     对话内容 宋体/Courier New 10pt 左对齐 左缩进3cm 右缩进2.7cm
 *     括号     仿宋/Courier New 10pt 居中 无首行缩进
 *     转场     宋体/Courier New 10pt 两端对齐 首行缩进2字符，以 -- 开头
 *   块间距：动作/对话/括号/转场之间一律空一行；场景标题前空两行
 */

const FONT_SONG = '"Courier New", "SimSun", "宋体", serif';
const FONT_HEI = '"Courier New", "SimHei", "黑体", sans-serif';
const FONT_FANGSONG = '"Courier New", "FangSong", "仿宋", "仿宋_GB2312", serif';
const FONT_ZHONGSONG = '"Courier New", "STZhongsong", "华文中宋", "SimSun", serif';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 行内标记：**粗体** *斜体* __下划线__，以及反斜杠转义。
 * 逐字符扫描，标记不跨行。
 */
function renderInline(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '\\') {
      const nxt = text[i + 1];
      if (nxt !== undefined) { out += escapeHtml(nxt); i += 2; continue; }
      out += '\\'; i++; continue;
    }
    if (ch === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end > i + 1) { out += '<strong>' + renderInline(text.slice(i + 2, end)) + '</strong>'; i = end + 2; continue; }
    }
    if (ch === '*') {
      const end = text.indexOf('*', i + 1);
      if (end > i) { out += '<em>' + renderInline(text.slice(i + 1, end)) + '</em>'; i = end + 1; continue; }
    }
    if (ch === '_' && text[i + 1] === '_') {
      const end = text.indexOf('__', i + 2);
      if (end > i + 1) { out += '<u>' + renderInline(text.slice(i + 2, end)) + '</u>'; i = end + 2; continue; }
    }
    out += escapeHtml(ch);
    i++;
  }
  return out;
}

function buildCss() {
  return `
@page {
  size: A4;
  margin: 2.54cm 3.81cm;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ${FONT_SONG};
  font-size: 10pt;
  /* 1.31 ≈ Word 中文单倍行距（SimSun 行距因子） */
  line-height: 1.31;
  color: #000;
  -webkit-font-smoothing: antialiased;
}
p { margin: 0; }

/* ===== 屏幕预览：灰色背景上的 A4 白纸 ===== */
@media screen {
  body { background: #707070; padding: 22px 0; }
  .sheet {
    background: #fff;
    width: 21cm;
    min-height: 29.7cm;
    padding: 2.54cm 3.81cm;
    margin: 0 auto 22px;
    box-shadow: 0 2px 18px rgba(0,0,0,.45);
  }
}
/* ===== 打印：@page 提供页边距，标题页后强制分页 ===== */
@media print {
  body { background: #fff; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
}

/* ===== 标题页 ===== */
.title-page .tp-title {
  font-family: ${FONT_ZHONGSONG};
  font-size: 28pt;
  font-style: italic;
  font-weight: normal;
  text-align: center;
  line-height: 1;
  margin: 0;
  margin-top: 10.6cm;
}
.title-page .tp-author {
  font-family: ${FONT_SONG};
  font-size: 14pt;
  font-weight: normal;
  text-align: center;
  line-height: 1;
  margin: 0.55cm 0 0;
}
.title-page .tp-contact {
  font-family: ${FONT_SONG};
  font-size: 14pt;
  font-weight: normal;
  text-align: center;
  line-height: 1;
  margin: 0.6cm 0 0;
}
.title-page .tp-extra {
  font-family: ${FONT_SONG};
  font-size: 14pt;
  text-align: center;
  line-height: 1;
  margin: 0.6cm 0 0;
}

/* ===== 正文块（1 个空行 = 13.1pt，即 10pt 字单倍行距） ===== */
.body .scene {
  font-family: ${FONT_SONG};
  font-size: 11pt;
  font-weight: bold;
  text-align: justify;
  text-indent: 0;
  margin: 26.2pt 0 13.1pt; /* 其前空两行、其后空一行 */
  break-after: avoid;
  page-break-after: avoid;
}
.body .scene:first-child { margin-top: 0; }

.body .action {
  font-family: ${FONT_SONG};
  font-size: 10pt;
  text-align: justify;
  text-indent: 0;
  margin: 0 0 13.1pt;
}

.body .dialogue {
  margin: 0 0 13.1pt;
  break-inside: avoid;
  page-break-inside: avoid;
}
.body .dialogue .cue {
  font-family: ${FONT_HEI};
  font-size: 10pt;
  font-weight: normal;
  text-align: center;
  text-indent: 0;
  margin: 0;
}
.body .dialogue .line {
  font-family: ${FONT_SONG};
  font-size: 10pt;
  text-align: left;
  text-indent: 0;
  margin: 0 2.7cm 0 3cm;   /* 左缩进3cm，右缩进2.7cm（相对版心） */
}

.body .paren {
  font-family: ${FONT_FANGSONG};
  font-size: 10pt;
  text-align: center;
  text-indent: 0;
  margin: 0 0 13.1pt;
  break-inside: avoid;
  page-break-inside: avoid;
}

.body .transition {
  font-family: ${FONT_SONG};
  font-size: 10pt;
  text-align: justify;
  text-indent: 2em;        /* 首行缩进2字符 */
  margin: 0 0 13.1pt;
}

.pagebreak { break-before: page; page-break-before: always; }
`;
}

function buildTitlePage(meta) {
  const lines = [];
  if (meta.title) {
    lines.push(`  <p class="tp-title">${renderInline(meta.title)}</p>`);
  }
  if (meta.author) {
    lines.push(`  <p class="tp-author">${renderInline(meta.author)}</p>`);
  }
  if (meta.contact) {
    lines.push(`  <p class="tp-contact">${renderInline(meta.contact)}</p>`);
  }
  if (meta.email) {
    lines.push(`  <p class="tp-contact">${renderInline(meta.email)}</p>`);
  }
  for (const e of meta.extra || []) {
    lines.push(`  <p class="tp-extra">${renderInline(e.value)}</p>`);
  }
  if (meta.date) {
    lines.push(`  <p class="tp-extra">${renderInline(meta.date)}</p>`);
  }
  if (meta.draft) {
    lines.push(`  <p class="tp-extra">${renderInline(meta.draft)}</p>`);
  }
  return `<div class="sheet title-page">\n${lines.join('\n')}\n</div>`;
}

function buildBody(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'scene':
        out.push(`  <p class="scene">${renderInline(b.text)}</p>`);
        break;
      case 'action':
        out.push(`  <p class="action">${renderInline(b.text)}</p>`);
        break;
      case 'dialogue': {
        const lines = [`    <p class="cue">${renderInline(b.cue)}</p>`];
        for (const l of b.lines) lines.push(`    <p class="line">${renderInline(l)}</p>`);
        out.push(`  <div class="dialogue">\n${lines.join('\n')}\n  </div>`);
        break;
      }
      case 'paren':
        out.push(`  <p class="paren">${renderInline(b.text)}</p>`);
        break;
      case 'transition':
        out.push(`  <p class="transition">${renderInline(b.text)}</p>`);
        break;
      case 'pagebreak':
        out.push(`  <div class="pagebreak"></div>`);
        break;
      default:
        break;
    }
  }
  return `<div class="sheet body">\n${out.join('\n')}\n</div>`;
}

function render(ast, options = {}) {
  const sheets = [];
  const hasTitle = ast.meta && (ast.meta.title || ast.meta.author || ast.meta.contact || ast.meta.email ||
    (ast.meta.extra && ast.meta.extra.length) || ast.meta.date || ast.meta.draft);
  if (hasTitle) sheets.push(buildTitlePage(ast.meta));
  if (ast.blocks.length) sheets.push(buildBody(ast.blocks));

  const title = (ast.meta && ast.meta.title) ? ast.meta.title : '剧本预览';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security" content="default-src 'none'; style-src 'unsafe-inline';">
<title>${escapeHtml(title)}</title>
<style>${buildCss()}</style>
</head>
<body>
${sheets.join('\n')}
</body>
</html>`;
}

module.exports = { render, renderInline, escapeHtml, buildCss };
