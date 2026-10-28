// 用 VSCode 的 Electron Node 运行，模拟扩展宿主内的 PDF 导出
const path = require('path');
const fs = require('fs');
const { compileSource } = require('../src/compiler');
const { htmlToPdf, findBrowser } = require('../src/pdf');

(async () => {
  const sp = path.join(__dirname, '..', 'examples', '雨会停.sp');
  const source = fs.readFileSync(sp, 'utf8');
  const { html } = compileSource(source);
  const out = path.join(__dirname, '..', 'examples', 'electron-repro.pdf');
  try {
    const r = await htmlToPdf(html, out, { browserPath: findBrowser() });
    console.log('OK', r, fs.statSync(r).size);
  } catch (e) {
    console.log('FAIL', e.message);
  }
})();
