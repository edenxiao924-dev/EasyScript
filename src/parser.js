'use strict';
/*
 * Screenplay Language (.sp) —— 解析器
 * 将剧本文本解析为 AST：
 *   {
 *     meta: { title, author, contact, email, date, draft, extra: [...] },
 *     blocks: [
 *       { type: 'scene',      text },
 *       { type: 'action',     text },
 *       { type: 'dialogue',   cue, lines: [] },
 *       { type: 'paren',      text },
 *       { type: 'transition', text },
 *       { type: 'pagebreak' }
 *     ],
 *     errors: [ { line, message } ]
 *   }
 */

// 行首即场景标题的识别规则（未显式写 # 时也可自动识别）
const AUTO_SCENE_RE = /^(INT|EXT|EST|INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT)([.\s-]|$)/i;
// 场景标题关键字（用于自动编号时定位插入位置）
const SCENE_KW_RE = /^(INT|EXT|EST|INT\.\s*\/\s*EXT|EXT\.\s*\/\s*INT|INT\s*\/\s*EXT|EXT\s*\/\s*INT)(\.?)(\s+|-\s*|\s*$)/i;
// 整行被括号包裹（支持中文全角与英文半角，可混用）
const PAREN_RE = /^\s*[（(][\s\S]*[）)]\s*$/;
// 转场：以 -- 开头
const TRANSITION_RE = /^\s*--/;

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
      let val = m[2].trim().replace(/^["']|["']$/g, '');
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
 * 场景标题自动编号：
 *   # EXT 城市街头 日   ->   EXT 01 城市街头 日
 * - 仅对以场景关键字（INT/EXT/EST/INT./EXT…）开头、且关键字后尚未写编号的场景插入序号；
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

function parse(source) {
  const result = { meta: { extra: [] }, blocks: [], errors: [] };
  const lines = source.split(/\r?\n/);
  let i = 0;

  // 1) 可选文件头
  if (lines[0] !== undefined && /^\s*---\s*$/.test(lines[0])) {
    const fm = parseFrontMatter(lines, 0);
    if (fm.error) result.errors.push(fm.error);
    result.meta = Object.assign({ extra: [] }, fm.meta);
    i = fm.endIdx;
  }

  // 2) 逐行状态机
  let current = null;            // 当前开放中的块
  let inBlockComment = false;

  const flush = () => { current = null; };

  for (; i < lines.length; i++) {
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
    // 行注释（// 不是本语言的内联语法，直接切除）
    const slashIdx = line.indexOf('//');
    if (slashIdx !== -1) line = line.slice(0, slashIdx);

    const trimmed = line.trim();

    // 空行：结束当前块
    if (trimmed === '') { flush(); continue; }

    // 强制分页
    if (/^={3,}\s*$/.test(trimmed)) {
      flush();
      result.blocks.push({ type: 'pagebreak' });
      continue;
    }

    // 场景标题：# 开头 或 自动识别 INT/EXT
    const hashM = trimmed.match(/^#\s+(.+?)\s*#*$/);
    if (hashM) {
      flush();
      result.blocks.push({ type: 'scene', text: hashM[1].trim() });
      continue;
    }
    if (AUTO_SCENE_RE.test(trimmed)) {
      flush();
      result.blocks.push({ type: 'scene', text: trimmed });
      continue;
    }

    // 角色：@ 开头
    const cueM = trimmed.match(/^@\s*(.+)$/);
    if (cueM) {
      const cue = cueM[1].trim();
      if (!cue) {
        result.errors.push({ line: lineNo, message: '@ 后缺少角色名' });
        continue;
      }
      flush();
      current = { type: 'dialogue', cue, lines: [] };
      result.blocks.push(current);
      continue;
    }

    // 转场：-- 开头
    if (TRANSITION_RE.test(trimmed)) {
      flush();
      result.blocks.push({ type: 'transition', text: trimmed.replace(/^\s*--\s*/, '--') });
      continue;
    }

    // 括号：整行被括号包裹
    if (PAREN_RE.test(trimmed)) {
      flush();
      result.blocks.push({ type: 'paren', text: trimmed });
      continue;
    }

    // 普通文本：追加到对话块，或开启/延续动作段落
    if (current && current.type === 'dialogue') {
      current.lines.push(trimmed);
    } else if (current && current.type === 'action') {
      current.text = joinLines(current.text, trimmed);
    } else {
      current = { type: 'action', text: trimmed };
      result.blocks.push(current);
    }
  }

  // 3) 折叠连续分页符（开头/重复分页无意义）
  const blocks = [];
  for (const b of result.blocks) {
    if (b.type === 'pagebreak' && (blocks.length === 0 || blocks[blocks.length - 1].type === 'pagebreak')) continue;
    blocks.push(b);
  }
  result.blocks = blocks;

  // 4) 场景标题自动编号（可在文件头用 autonumber: false 关闭）
  if (!/^\s*false\s*$/i.test(result.meta.autonumber || '')) {
    numberScenes(result.blocks);
  }
  return result;
}

module.exports = { parse, isCJK };
