#!/usr/bin/env node
'use strict';
/*
 * Easy Script (.sp) 编译器 —— Skill 命令行入口
 *
 * 用法：
 *   node scripts/render.js 剧本.sp                 # 同目录生成 剧本.pdf
 *   node scripts/render.js 剧本.sp -o 输出.pdf     # 指定 PDF 路径
 *   node scripts/render.js 剧本.sp --html 预览.html# 只输出 HTML（不打印）
 *   node scripts/render.js 剧本.sp --check         # 只解析，报告诊断
 *
 * 选项：
 *   -o, --output, --pdf <file>   输出 PDF 路径
 *   --html <file>                输出 HTML（排版与 PDF 一致，可直接浏览器查看/打印）
 *   --check                      只解析，输出诊断，不生成文件
 *   --browser <path>             指定 Edge/Chrome 可执行文件路径
 *   --json                       以 JSON 打印结果（便于程序读取）
 *   -q, --quiet                  只输出错误
 */

const fs = require('fs');
const path = require('path');

/**
 * 引擎解析：兼容两种安装形态
 *   1) 独立安装：parser.js / renderer.js / compiler.js / pdf.js 与本脚本同目录
 *   2) 仓库内：本 Skill 位于 <repo>/skills/easy-script/scripts，引擎在 <repo>/src
 */
function loadEngine() {
  const candidates = [
    __dirname,
    path.join(__dirname, '..', '..', '..', 'src'),
    path.join(__dirname, '..', 'scripts')
  ];
  const need = ['parser.js', 'renderer.js', 'compiler.js', 'pdf.js'];
  for (const dir of candidates) {
    if (need.every(f => fs.existsSync(path.join(dir, f)))) {
      return {
        dir,
        compiler: require(path.join(dir, 'compiler')),
        pdf: require(path.join(dir, 'pdf'))
      };
    }
  }
  throw new Error(
    '找不到编译引擎（parser/renderer/compiler/pdf.js）。\n' +
    '请把仓库 src/ 下的这四个文件复制到 ' + __dirname + ' 后重试。'
  );
}

let engine;
try {
  engine = loadEngine();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

function parseArgs(argv) {
  const a = { positional: [], html: null, pdf: null, check: false, browser: null, json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--html') a.html = argv[++i];
    else if (v === '--pdf' || v === '-o' || v === '--output') a.pdf = argv[++i];
    else if (v === '--check') a.check = true;
    else if (v === '--browser') a.browser = argv[++i];
    else if (v === '--json') a.json = true;
    else if (v === '-q' || v === '--quiet') a.quiet = true;
    else if (v === '-h' || v === '--help') a.help = true;
    else a.positional.push(v);
  }
  return a;
}

const HELP = `Easy Script（.sp 剧本语言）编译器

用法:
  node scripts/render.js <input.sp> [选项]

选项:
  -o, --output <file>   指定输出 PDF 路径（默认与源文件同名 .pdf）
      --html <file>     输出 HTML（排版与 PDF 完全一致）
      --check           只解析并输出诊断，不生成文件
      --browser <path>  指定 Edge/Chrome 可执行文件路径
      --json            以 JSON 打印执行结果
  -q, --quiet           只输出错误
  -h, --help            显示帮助
`;

function emit(res, code) {
  process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  process.exit(code);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = { ok: false, engine: engine.dir, input: null, pdf: null, html: null, errors: [], warnings: [] };

  if (args.help || args.positional.length === 0) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }

  const input = path.resolve(args.positional[0]);
  result.input = input;
  if (!fs.existsSync(input)) {
    result.errors.push({ message: `找不到源文件：${input}` });
    if (args.json) emit(result, 1);
    console.error(`错误：找不到源文件 ${input}`);
    process.exit(1);
  }

  const { ast, html } = engine.compiler.compileFile(input);
  result.errors = ast.errors || [];

  if (args.check) {
    result.ok = result.errors.length === 0;
    result.blockCount = ast.blocks.length;
    result.sceneCount = ast.blocks.filter(b => b.type === 'scene').length;
    result.title = ast.meta.title || null;
    if (args.json) emit(result, result.errors.length ? 2 : 0);
    if (result.errors.length) {
      for (const e of result.errors) console.error(`[第${e.line}行] ${e.message}`);
      process.exit(2);
    }
    if (!args.quiet) {
      console.log(`解析通过：${result.sceneCount} 场，${result.blockCount} 个块` +
        (result.title ? `，标题「${result.title}」` : '（无文件头，不生成标题页）'));
    }
    process.exit(0);
  }

  if (result.errors.length) {
    for (const e of result.errors) console.error(`[第${e.line}行] ${e.message}`);
  }

  if (args.html) {
    const outHtml = path.resolve(args.html);
    fs.mkdirSync(path.dirname(outHtml), { recursive: true });
    fs.writeFileSync(outHtml, html, 'utf8');
    result.html = outHtml;
    if (!args.quiet) console.log(`HTML 已生成：${outHtml}`);
  }

  if (args.html && !args.pdf) {
    result.ok = true;
    if (args.json) emit(result, 0);
    process.exit(0);
  }

  const pdfOut = path.resolve(args.pdf || input.replace(/\.(screenplay|sp)$/i, '') + '.pdf');
  const browser = args.browser || engine.pdf.findBrowser();
  if (!browser) {
    result.errors.push({
      message: '未找到 Microsoft Edge / Google Chrome / Chromium，无法打印 PDF。' +
        '可用 --browser <path> 指定，或改用 --html 输出 HTML 后再打印。'
    });
    if (args.json) emit(result, 1);
    console.error(result.errors[result.errors.length - 1].message);
    process.exit(1);
  }

  if (!args.quiet) console.error(`使用浏览器：${browser}`);
  try {
    const pdf = await engine.pdf.htmlToPdf(html, pdfOut, { browserPath: browser });
    result.pdf = pdf;
    result.bytes = fs.statSync(pdf).size;
    result.ok = true;
    if (args.json) emit(result, 0);
    if (!args.quiet) console.log(`PDF 已生成：${pdf}（${result.bytes} 字节）`);
    process.exit(0);
  } catch (e) {
    result.errors.push({ message: `PDF 生成失败：${e.message}` });
    if (args.json) emit(result, 1);
    console.error(`PDF 生成失败：${e.message}`);
    console.error('可改用 --html <file> 输出 HTML 交付，或 --browser <path> 指定浏览器。');
    process.exit(1);
  }
}

main();
