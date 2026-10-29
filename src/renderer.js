'use strict';
/*
 * Screenplay Language (.sp) —— HTML 渲染器（v0.2）
 * 输出可直接用于：
 *   1) VSCode Webview 实时预览（@media screen 下渲染为 A4 白纸）；
 *   2) Edge/Chrome 无头打印 PDF（@media print + @page 精确控制版心）。
 *
 * v0.2 排版增量：
 *   角色后缀：VO 画外音（cue+对话灰色）、OS 画外声、CONT'D 接续
 *   音效 SFX：下划线，左缩进0，右缩进2.79cm
 *   修订 revise：新内容红色，上方小字注明 日期 #次数
 *   蒙太奇 MONTAGE：标题 MONTAGE NN:，内部画面描述灰色斜体
 *   动作段落中，有台词的角色名第一次出现时加粗
 */

const fs = require('fs');
const path = require('path');

const FONT_SONG = '"Courier New", "SimSun", "宋体", serif';
const FONT_HEI = '"Courier New", "SimHei", "黑体", sans-serif';
const FONT_FANGSONG = '"Courier New", "FangSong", "仿宋", "仿宋_GB2312", serif';
const FONT_ZHONGSONG = '"Courier New", "STZhongsong", "华文中宋", "SimSun", serif';
// 蒙太奇画面描述：预构建的宋体斜体（字形已倾斜，规避 headless 打印不对 CJK 合成斜体的问题）
const FONT_OBLIQUE = '"SimSun-Oblique", "Courier New", "SimSun", serif';

// 灰色（画外音 / 蒙太奇画面描述）
const GRAY = '#808080';
// 修订红色
const REV_RED = '#C00000';

/**
 * 加载预构建的「宋体斜体」WOFF2，以 base64 data URI 内联为 @font-face。
 * 这样 Webview 与 headless 打印 PDF 都能用到自带的斜体字形，无需联网。
 *
 * 为了让纯文本仓库（GitHub）也能完整承载该二进制字体，WOFF2 的 base64
 * 被拆成若干纯文本块 assets/fonts/ob/ob_NN.txt（每块约 140KB）；
 * 这里依次读取并拼接。若块不存在，则回退读取 WOFF2 二进制。
 */
function loadObliqueFace() {
  let b64 = '';
  try {
    const obDir = path.join(__dirname, '..', 'assets', 'fonts', 'ob');
    for (let i = 0; i < 100; i++) {
      const p = path.join(obDir, 'ob_' + String(i).padStart(2, '0') + '.txt');
      if (!fs.existsSync(p)) break;
      b64 += fs.readFileSync(p, 'utf8').replace(/\s+/g, '');
    }
  } catch (e) {
    b64 = '';
  }
  if (!b64) {
    try {
      const woff2 = path.join(__dirname, '..', 'assets', 'fonts', 'SimSun-Oblique.woff2');
      b64 = fs.readFileSync(woff2).toString('base64');
    } catch (e) {
      return '';
    }
  }
  return `@font-face {
  font-family: 'SimSun-Oblique';
  src: url(data:font/woff2;base64,${b64}) format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}`;
}
const OBLIQUE_FACE = loadObliqueFace();

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

/** 角色名 + 后缀 -> 展示文本（统一使用全角括号，与参考图一致）。 */
function cueDisplay(cue, modifier) {
  if (!modifier) return cue;
  if (modifier === 'VO') return `${cue}（V.O.）`;
  if (modifier === 'OS') return `${cue}（O.S.）`;
  if (modifier === 'CO') return `${cue}（CONT'D）`;
  return cue;
}

/** 当前日期标签：YYYY.MM.DD */
function todayLabel() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/** 收集所有有台词的角色名（含蒙太奇内部）。 */
function collectCueNames(blocks) {
  const names = new Set();
  for (const b of blocks) {
    if (b.type === 'dialogue') names.add(b.cue);
    if (b.type === 'montage') collectCueNames(b.blocks).forEach(n => names.add(n));
  }
  return names;
}

/**
 * 渲染动作段落：把有台词的角色名在动作段落中第一次出现时加粗。
 * 加粗状态在 ctx.bolded 中全局记录。
 */
function renderActionWithBold(text, ctx) {
  let out = '';
  let rest = text;
  while (rest) {
    let best = null;
    for (const name of ctx.names) {
      if (ctx.bolded.has(name)) continue;
      const idx = rest.indexOf(name);
      if (idx === -1) continue;
      if (best === null || idx < best.idx || (idx === best.idx && name.length > best.name.length)) {
        best = { idx, name };
      }
    }
    if (!best) { out += renderInline(rest); break; }
    out += renderInline(rest.slice(0, best.idx));
    out += '<strong class="cb">' + renderInline(best.name) + '</strong>';
    ctx.bolded.add(best.name);
    rest = rest.slice(best.idx + best.name.length);
  }
  return out;
}

function buildCss() {
  return `${OBLIQUE_FACE}
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
/* 画外音 VO：角色名与对话整体灰色 */
.body .dialogue.mod-vo .cue,
.body .dialogue.mod-vo .line { color: ${GRAY}; }

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

/* ===== 音效 SFX：下划线，左缩进0，右缩进2.79cm ===== */
.body .sfx {
  font-family: ${FONT_SONG};
  font-size: 10pt;
  text-align: left;
  text-indent: 0;
  margin: 0 2.79cm 13.1pt 0;
}

/* ===== 修订 revise ===== */
.body .revise {
  margin: 0 0 13.1pt;
  break-inside: avoid;
  page-break-inside: avoid;
}
.body .revise .rev-meta {
  color: #A0A0A0;
  font-family: ${FONT_SONG};
  font-size: 8pt;
  text-align: right;
  margin: 0 0 2pt;
}
.body .revise .rev-text {
  color: ${REV_RED};
  font-family: ${FONT_SONG};
  font-size: 10pt;
  text-align: justify;
  text-indent: 0;
  margin: 0;
}

/* ===== 蒙太奇 MONTAGE ===== */
.body .montage {
  margin: 0 0 13.1pt;
}
.body .montage .m-head {
  font-family: ${FONT_SONG};
  font-size: 10pt;
  font-weight: bold;
  text-align: left;
  margin: 0 0 13.1pt;
  break-after: avoid;
  page-break-after: avoid;
}
/* 蒙太奇内部画面描述：灰色 + 斜体（字形已在 SimSun-Oblique 中倾斜） */
.body .montage .m-action {
  font-family: ${FONT_OBLIQUE};
  font-size: 10pt;
  font-style: normal;
  color: ${GRAY};
  text-align: left;
  text-indent: 0;
  margin: 0 0 13.1pt;
}

/* 动作段落中角色名首次出现加粗：SimSun 无粗体，用描边合成粗体（保留宋体字形） */
.body .action strong.cb {
  font-weight: bold;
  -webkit-text-stroke: 0.5px currentColor;
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

/** 递归渲染块（顶层正文与 MONTAGE 内部复用）。 */
function renderBlocks(blocks, ctx) {
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'scene':
        out.push(`  <p class="scene">${renderInline(b.text)}</p>`);
        break;
      case 'action':
        if (ctx.inMontage) {
          out.push(`  <p class="action m-action">${renderInline(b.text)}</p>`);
        } else {
          out.push(`  <p class="action">${renderActionWithBold(b.text, ctx)}</p>`);
        }
        break;
      case 'dialogue': {
        const cls = b.modifier ? `dialogue mod-${b.modifier.toLowerCase()}` : 'dialogue';
        const head = [`    <p class="cue">${renderInline(cueDisplay(b.cue, b.modifier))}</p>`];
        for (const l of b.lines) head.push(`    <p class="line">${renderInline(l)}</p>`);
        out.push(`  <div class="${cls}">\n${head.join('\n')}\n  </div>`);
        break;
      }
      case 'paren':
        out.push(`  <p class="paren">${renderInline(b.text)}</p>`);
        break;
      case 'transition':
        out.push(`  <p class="transition">${renderInline(b.text)}</p>`);
        break;
      case 'sfx':
        out.push(`  <p class="sfx"><u><strong>SFX: </strong>${renderInline(b.text)}</u></p>`);
        break;
      case 'revise':
        out.push(`  <div class="revise">\n    <p class="rev-meta">${ctx.today} #${b.revNo}</p>\n    <p class="rev-text">${renderInline(b.text)}</p>\n  </div>`);
        break;
      case 'montage': {
        const inner = renderBlocks(b.blocks, Object.assign({}, ctx, { inMontage: true }));
        out.push(`  <div class="montage">\n    <p class="m-head">MONTAGE ${b.number}:</p>\n${inner}\n  </div>`);
        break;
      }
      case 'pagebreak':
        out.push(`  <div class="pagebreak"></div>`);
        break;
      default:
        break;
    }
  }
  return out.join('\n');
}

function buildBody(blocks, ctx) {
  return `<div class="sheet body">${renderBlocks(blocks, ctx)}</div>`;
}

function render(ast, options = {}) {
  const sheets = [];
  const hasTitle = ast.meta && (ast.meta.title || ast.meta.author || ast.meta.contact || ast.meta.email ||
    (ast.meta.extra && ast.meta.extra.length) || ast.meta.date || ast.meta.draft);
  if (hasTitle) sheets.push(buildTitlePage(ast.meta));

  // 渲染上下文：角色名集合、加粗状态、日期
  const ctx = {
    inMontage: false,
    today: todayLabel(),
    names: [...collectCueNames(ast.blocks)].sort((a, b) => b.length - a.length),
    bolded: new Set()
  };

  if (ast.blocks.length) sheets.push(buildBody(ast.blocks, ctx));

  const title = (ast.meta && ast.meta.title) ? ast.meta.title : '剧本预览';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:;">
<title>${escapeHtml(title)}</title>
<style>${buildCss()}</style>
</head>
<body>
${sheets.join('\n')}
</body>
</html>`;
}

module.exports = { render, renderInline, escapeHtml, buildCss };
