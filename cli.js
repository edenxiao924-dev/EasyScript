#!/usr/bin/env node
'use strict';
/*
 * Screenplay Language 命令行编译器
 *
 * 用法：
 *   node cli.js 剧本.sp                 # 同目录生成 剧本.pdf
 *   node cli.js 剧本.sp -o 输出.pdf     # 指定 PDF 路径
 *   node cli.js 剧本.sp --html 预览.html# 只输出 HTML
 *   node cli.js 剧本.sp --check         # 仅解析，输出 AST 与诊断信息
 */
const fs = require('fs');
const path = require('path');
const { compileFile } = require('./src/compiler');
const { htmlToPdf, findBrowser } = require('./src/pdf');

function parseArgs(argv) {
  const args = { positional: [], html: null, pdf: null, check: false, browser: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--html') args.html = argv[++i];
    else if (a === '--pdf') args.pdf = argv[++i];
    else if (a === '-o' || a === '--output') args.pdf = argv[++i];
    else if (a === '--check') args.check = true;
    else if (a === '--browser') args.browser = argv[++i];
    else if (a === '-h' || a === '--help') args.help = true;
    else args.positional.push(a);
  }
  return args;
}

const HELP = `Screenplay Language (.sp) 编译器

用法:
  node cli.js <input.sp> [选项]

选项:
  -o, --output <file>   指定输出 PDF 路径（默认与源文件同名 .pdf）
      --html <file>     仅输出 HTML，不生成 PDF
      --pdf <file>      输出 PDF 的另一种写法
      --check           只解析并打印诊断，不生成文件
      --browser <path>  指定 Edge/Chrome 可执行文件路径
  -h, --help            显示帮助
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.positional.length === 0) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }

  const input = path.resolve(args.positional[0]);
  if (!fs.existsSync(input)) {
    console.error(`错误：找不到源文件 ${input}`);
    process.exit(1);
  }

  const { ast, html } = compileFile(input);
  if (ast.errors.length) {
    for (const e of ast.errors) console.warn(`[第${e.line}行] ${e.message}`);
  }
  if (args.check) {
    console.log(JSON.stringify(ast, null, 2));
    process.exit(ast.errors.length ? 2 : 0);
  }

  if (args.html) {
    const out = path.resolve(args.html);
    fs.writeFileSync(out, html, 'utf8');
    console.log(`HTML 已生成：${out}`);
    if (!args.pdf) return;
  }

  if (!args.html || args.pdf) {
    const pdfOut = path.resolve(args.pdf || input.replace(/\.(sp|screenplay)$/i, '') + '.pdf');
    const browser = args.browser || findBrowser();
    if (!browser) {
      console.error('错误：未找到 Microsoft Edge 或 Google Chrome。');
      process.exit(1);
    }
    console.log(`使用浏览器：${browser}`);
    try {
      const pdf = await htmlToPdf(html, pdfOut, { browserPath: browser });
      console.log(`PDF 已生成：${pdf}`);
    } catch (e) {
      console.error(`PDF 生成失败：${e.message}`);
      process.exit(1);
    }
  }
}

main();
