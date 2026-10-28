'use strict';
/*
 * 编译入口：.sp 源文件 -> AST -> HTML
 */
const fs = require('fs');
const { parse } = require('./parser');
const { render } = require('./renderer');

function compileSource(source) {
  const ast = parse(source);
  const html = render(ast);
  return { ast, html };
}

function compileFile(spPath) {
  const source = fs.readFileSync(spPath, 'utf8');
  const res = compileSource(source);
  res.sourcePath = spPath;
  return res;
}

module.exports = { compileSource, compileFile };
