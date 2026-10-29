'use strict';
/*
 * Screenplay Language (.sp) —— 解析器（v0.2）
 * 将剧本文本解析为 AST：
 *   {
 *     meta: { title, author, contact, email, date, draft, autonumber, extra: [...] },
 *     blocks: [
 *       { type: 'scene',      text },
 *       { type: 'action',     text },
 *       { type: 'dialogue',   cue, modifier: 'VO'|'OS'|'CO'|null, lines: [] },
 *       { type: 'paren',      text },
 *       { type: 'transition', text },
 *       { type: 'sfx',        text },
 *       { type: 'revise',     text, revNo },
 *       { type: 'montage',    number, blocks: [...] },
 *       { type: 'pagebreak' }
 *     ],
 *     errors: [ { line, message } ]
 *   }
 */

// 行首即场景标题的识别规则（未显式写 # 时也可自动识别）
const AUTO_SCENE_RE = /^(INT|EXT|EST|INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT)([.\s-]|$)/i;
// 场景标题关键字（用于自动编号、dash 分隔符归一时定位）
const SCENE_KW_RE = /^(INT|EXT|EST|INT\.\s*\/\s*EXT|EXT\.\s*\/\s*INT|INT\s*\/\s*EXT|EXT\s*\/\s*INT)(\.?)(\s+|-\s*|\s*$)/i;
// 整行被括号包裹（支持中文全角与英文半角，可混用）
const PAREN_RE = /^\s*[（(][\s\S]*[）)]\s*$/;
// 转场：以 -- 开头
const TRANSITION_RE = /^\s*--/;
// 音效：SFX 后接内容
const SFX_RE = /^SFX\s*[:：]?\s*(.+)$/i;
// 修订 / 蒙太奇块开启
const REVISE_OPEN_RE = /^revise\s*\{/i;
const MONTAGE_OPEN_RE = /^montage\s*\{/i;
// 角色名后缀（画外音 / 画外声 / 接续）
const CUE_SUFFIX_RE = /^(.*?)(VO|OS|CO)$/i;

function isCJK(ch) {
  if (!ch) return false;
  const code = ch.codePointAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||   // CJK 统一表意文字
    (code >= 0x3400 && code <= 0x4dbf) ||   // 扩展 A
    (code >= 0xf900 && code <= 0xfaff) ||   // 兼容表意文字
    (code >= 0x3000 && code <= 0x303f) ||   // CJK 标点
    (code >= 0xff00 && code <= 0xffef)      // 全角字符
  );
}

/**
 * 智能合并同一段落内的换行：
 * 上一行以 CJK 字符/标点结尾时直接拼接，否则补一个空格。
 */
function joinLines(a, b) {
  const last = a[a.length - 1];
  if (isCJK(last)) return a + b;
  return a + ' ' + b;
}

/**
 * 解析文件头（YAML 风格的 key: value），位于文档开头的 --- 围栏之间。
 */
function parseFrontMatter(lines, startIdx) {
  const meta = { extra: [] };
  let i = startIdx + 1;
  let closed = false;
  const KNOWN = new Set(['title', 'author', 'contact', 'phone', 'email', 'date', 'draft', 'autonumber']);
  for (; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*---\s*$/.test(raw)) { closed = true; i++; break; }
    const m = raw.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (m) {
      let key = m[1].trim().toLowerCase();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'phone') key = 'contact';
      if (KNOWN.has(key)) meta[key] = val;
      else meta.extra.push({ key, value: val });
    }
  }
  if (!closed) {
    return { meta, endIdx: startIdx + 1, error: { line: startIdx + 1, message: '文件头缺少结束标记 ---' } };
  }
  return { meta, endIdx: i, error: null };
}

/**
 * 场景标题 dash 分隔符归一化：
 *   EXT-出租屋-夜-雨   ->   EXT 出租屋 夜 雨
 * 仅把关键字之后的字段分隔符 "-" 转为空格；空格写法保持不变。
 */
function normalizeScene(raw) {
  const m = raw.match(SCENE_KW_RE);
  if (!m) return raw;
  const kw = m[1] + (m[2] || '');
  let rest = raw.slice(m[0].length).trim();
  if (rest.includes('-')) {
    rest = rest.split('-').map(s => s.trim()).filter(Boolean).join(' ');
  }
  return rest ? `${kw} ${rest}` : kw;
}

/**
 * 场景标题自动编号：
 *   EXT 城市街头 日   ->   EXT 01 城市街头 日
 * - 仅对以场景关键字开头、且关键字后尚未写编号的场景插入序号；
 * - 已手动写编号（关键字后紧跟数字）的场景保持原样；
 * - 序号为两位补零（01、02…），按场景在文档中的出现顺序全局递增。
 */
function numberScenes(blocks) {
  let n = 0;
  for (const b of blocks) {
    if (b.type !== 'scene') continue;
    const m = b.text.match(SCENE_KW_RE);
    if (!m) continue;
    const rest = b.text.slice(m[0].length);
    if (/^\d/.test(rest)) continue;   // 已手动编号
    n++;
    const num = String(n).padStart(2, '0');
    const kw = m[1] + m[2];
    b.text = `${kw} ${num} ${rest}`;
  }
}

/**
 * 拆分角色名与其后缀：
 *   周奕VO -> { cue: '周奕', modifier: 'VO' }
 *   彭宇OS -> { cue: '彭宇', modifier: 'OS' }
 *   彭宇CO -> { cue: '彭宇', modifier: 'CO' }
 * 中文名后直接剥离；英文名仅在后缀为大写时剥离，避免误判。
 */
function splitCue(raw) {
  const m = raw.match(CUE_SUFFIX_RE);
  if (!m) return { cue: raw, modifier: null };
  const name = m[1];
  const suffix = m[2];
  if (!name) return { cue: raw, modifier: null };
  const lastIsCJK = isCJK(name[name.length - 1]);
  if (lastIsCJK || suffix === suffix.toUpperCase()) {
    return { cue: name, modifier: suffix.toUpperCase() };
  }
  return { cue: raw, modifier: null };
}

/**
 * 读取以 "{" 开启、以匹配 "}" 结束的区域，返回内部行数组。
 * 支持大括号嵌套计数。
 */
function consumeBraced(lines, startIdx) {
  const innerLines = [];
  let depth = 0;
  let cur = '';
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    let j = 0;
    if (i === startIdx) {
      j = line.indexOf('{') + 1;
      depth = 1;
    }
    for (; j < line.length; j++) {
      const c = line[j];
      if (c === '{') { depth++; }
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          innerLines.push(cur);
          return { innerLines, endIdx: i + 1, ok: true };
        }
      }
      cur += c;
    }
    innerLines.push(cur);
    cur = '';
  }
  return { innerLines, endIdx: lines.length, ok: false };
}

/** 构建修订节点：提取 [新内容]，无方括号时整段视为新内容。 */
function buildRevise(innerLines) {
  const text = innerLines
    .map(l => l.trim())
    .filter(Boolean)
    .reduce((acc, t) => (acc ? joinLines(acc, t) : t), '');
  const bm = text.match(/\[([\s\S]*?)\]/);
  return { type: 'revise', text: (bm ? bm[1].trim() : text), revNo: 0 };
}

/**
 * 蒙太奇内部行解析（逐行，不合并）：
 *   - 每个 cue 行开启一段对话，其【紧跟的一行】为对话内容；
 *   - 其余非 cue 行各自为一个画面描述（action），渲染时变灰、斜体、左对齐。
 */
function parseMontageLines(lines) {
  const blocks = [];
  let awaitingLine = null;   // 等待其对话行的 dialogue 节点
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const slashIdx = line.indexOf('//');
    if (slashIdx !== -1) line = line.slice(0, slashIdx);
    const trimmed = line.trim();
    if (trimmed === '') { awaitingLine = null; continue; }

    // 角色 cue
    const cueM = trimmed.match(/^@\s*(.+)$/);
    if (cueM) {
      const { cue, modifier } = splitCue(cueM[1].trim());
      awaitingLine = { type: 'dialogue', cue, modifier, lines: [] };
      blocks.push(awaitingLine);
      continue;
    }
    // 括号
    if (PAREN_RE.test(trimmed)) {
      blocks.push({ type: 'paren', text: trimmed });
      awaitingLine = null;
      continue;
    }
    // cue 后紧跟的一行 = 对话；其余 = 画面描述
    if (awaitingLine && awaitingLine.lines.length === 0) {
      awaitingLine.lines.push(trimmed);
      awaitingLine = null;
    } else {
      blocks.push({ type: 'action', text: trimmed });
      awaitingLine = null;
    }
  }
  return blocks;
}

/** 构建蒙太奇节点：逐行解析，画面描述的特殊样式由渲染器处理。 */
function buildMontage(innerLines) {
  const blocks = parseMontageLines(innerLines);
  return { type: 'montage', number: '01', blocks };
}

/**
 * 正文行状态机（顶层正文与 MONTAGE 内部复用）。
 * 输入行数组，返回 { blocks, errors }。
 */
function parseBodyLines(lines) {
  const blocks = [];
  const errors = [];
  let current = null;
  let inBlockComment = false;
  const flush = () => { current = null; };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineNo = i + 1;

    // 块注释
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      line = line.slice(end + 2);
      inBlockComment = false;
      if (!line.trim()) continue;
    }
    // 去掉块注释开始（允许行尾出现 /* ... */）
    const bcStart = line.indexOf('/*');
    if (bcStart !== -1) {
      const bcEnd = line.indexOf('*/', bcStart + 2);
      if (bcEnd === -1) {
        line = line.slice(0, bcStart);
        inBlockComment = true;
      } else {
        line = line.slice(0, bcStart) + line.slice(bcEnd + 2);
      }
    }
    // 行注释（// 直接切除）
    const slashIdx = line.indexOf('//');
    if (slashIdx !== -1) line = line.slice(0, slashIdx);

    const trimmed = line.trim();

    // 空行：结束当前块
    if (trimmed === '') { flush(); continue; }

    // 强制分页
    if (/^={3,}\s*$/.test(trimmed)) {
      flush();
      blocks.push({ type: 'pagebreak' });
      continue;
    }

    // 修订块
    if (REVISE_OPEN_RE.test(trimmed)) {
      flush();
      const { innerLines, endIdx, ok } = consumeBraced(lines, i);
      if (!ok) errors.push({ line: lineNo, message: 'revise 块缺少结束标记 }' });
      blocks.push(buildRevise(innerLines));
      i = endIdx - 1;
      continue;
    }

    // 蒙太奇块
    if (MONTAGE_OPEN_RE.test(trimmed)) {
      flush();
      const { innerLines, endIdx, ok } = consumeBraced(lines, i);
      if (!ok) errors.push({ line: lineNo, message: 'MONTAGE 块缺少结束标记 }' });
      blocks.push(buildMontage(innerLines));
      i = endIdx - 1;
      continue;
    }

    // 场景标题：# 开头 或 自动识别 INT/EXT
    const hashM = trimmed.match(/^#\s+(.+?)\s*#*$/);
    if (hashM) {
      flush();
      blocks.push({ type: 'scene', text: normalizeScene(hashM[1].trim()) });
      continue;
    }
    if (AUTO_SCENE_RE.test(trimmed)) {
      flush();
      blocks.push({ type: 'scene', text: normalizeScene(trimmed) });
      continue;
    }

    // 音效 SFX
    const sfxM = trimmed.match(SFX_RE);
    if (sfxM) {
      flush();
      blocks.push({ type: 'sfx', text: sfxM[1].trim() });
      continue;
    }

    // 角色：@ 开头
    const cueM = trimmed.match(/^@\s*(.+)$/);
    if (cueM) {
      const raw = cueM[1].trim();
      if (!raw) {
        errors.push({ line: lineNo, message: '@ 后缺少角色名' });
        continue;
      }
      const { cue, modifier } = splitCue(raw);
      flush();
      current = { type: 'dialogue', cue, modifier, lines: [] };
      blocks.push(current);
      continue;
    }

    // 转场：-- 开头
    if (TRANSITION_RE.test(trimmed)) {
      flush();
      blocks.push({ type: 'transition', text: trimmed.replace(/^\s*--\s*/, '--') });
      continue;
    }

    // 括号：整行被括号包裹
    if (PAREN_RE.test(trimmed)) {
      flush();
      blocks.push({ type: 'paren', text: trimmed });
      continue;
    }

    // 普通文本：追加到对话块，或开启/延续动作段落
    if (current && current.type === 'dialogue') {
      current.lines.push(trimmed);
    } else if (current && current.type === 'action') {
      current.text = joinLines(current.text, trimmed);
    } else {
      current = { type: 'action', text: trimmed };
      blocks.push(current);
    }
  }

  return { blocks, errors };
}

function parse(source) {
  const result = { meta: { extra: [] }, blocks: [], errors: [] };
  const lines = source.split(/\r?\n/);
  let bodyStart = 0;

  // 1) 可选文件头
  if (lines[0] !== undefined && /^\s*---\s*$/.test(lines[0])) {
    const fm = parseFrontMatter(lines, 0);
    if (fm.error) result.errors.push(fm.error);
    result.meta = Object.assign({ extra: [] }, fm.meta);
    bodyStart = fm.endIdx;
  }

  // 2) 正文状态机
  const { blocks, errors } = parseBodyLines(lines.slice(bodyStart));
  for (const e of errors) result.errors.push(e);

  // 3) 折叠连续分页符（开头/重复分页无意义）
  const collapsed = [];
  for (const b of blocks) {
    if (b.type === 'pagebreak' && (collapsed.length === 0 || collapsed[collapsed.length - 1].type === 'pagebreak')) continue;
    collapsed.push(b);
  }
  result.blocks = collapsed;

  // 4) 场景标题自动编号（可在文件头用 autonumber: false 关闭）
  if (!/^\s*false\s*$/i.test(result.meta.autonumber || '')) {
    numberScenes(result.blocks);
  }

  // 5) 修订块、蒙太奇块顺序编号
  let rev = 0;
  let mon = 0;
  for (const b of result.blocks) {
    if (b.type === 'revise') { rev++; b.revNo = rev; }
    if (b.type === 'montage') { mon++; b.number = String(mon).padStart(2, '0'); }
  }

  return result;
}

module.exports = { parse, isCJK };
