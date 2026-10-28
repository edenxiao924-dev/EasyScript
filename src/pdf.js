'use strict';
/*
 * HTML -> PDF：调用本机 Edge / Chrome 的无头打印能力，无需安装任何第三方依赖。
 * Chromium 的 print-to-pdf 完整支持 @page、中文字体、pt/cm 单位。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');

function browserCandidates() {
  const list = [];
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || '';
    list.push(
      path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(local, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(local, 'Google\\Chrome\\Application\\chrome.exe')
    );
  } else if (process.platform === 'darwin') {
    list.push(
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    list.push(
      '/usr/bin/microsoft-edge',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    );
  }
  return list;
}

function findBrowser() {
  for (const p of browserCandidates()) {
    try { if (p && fs.existsSync(p)) return p; } catch (_) { /* ignore */ }
  }
  return null;
}

function runExecutable(file, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: timeoutMs || 90000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) { err.stdout = stdout; err.stderr = stderr; reject(err); return; }
        resolve({ stdout, stderr });
      });
  });
}

// 诊断日志（便于排查扩展宿主内的无头打印问题）
function diagLog(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(path.join(os.tmpdir(), 'screenplay-pdf-debug.log'), line);
  } catch (_) { /* ignore */ }
}

/**
 * @param {string} html 完整 HTML 文档
 * @param {string} pdfPath 输出 PDF 绝对路径
 * @param {object} opts { browserPath, timeoutMs }
 */
async function htmlToPdf(html, pdfPath, opts = {}) {
  const browser = opts.browserPath || findBrowser();
  if (!browser) {
    throw new Error('未找到 Microsoft Edge 或 Google Chrome，请安装其一，或用 --browser 指定可执行文件路径。');
  }

  diagLog(`node=${process.version} cwd=${process.cwd()} browser=${browser}`);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenplay-'));
  const htmlPath = path.join(workDir, 'document.html');
  const profileDir = path.join(workDir, 'profile');
  // 先打印到纯 ASCII 临时路径，再移动到目标（规避部分浏览器对非 ASCII 输出路径的兼容问题）
  const tmpPdf = path.join(workDir, 'output.pdf');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const target = path.resolve(pdfPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try { fs.unlinkSync(target); } catch (_) { /* 忽略不存在 */ }

  diagLog(`workDir=${workDir} target=${target}`);

  const common = [
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-pdf-header-footer',
    `--user-data-dir=${profileDir}`,
    `--print-to-pdf=${tmpPdf}`,
    pathToFileURL(htmlPath).href
  ];

  // 优先新版 headless，失败则回退旧版
  let lastErr = null;
  for (const mode of ['--headless=new', '--headless']) {
    try {
      const r = await runExecutable(browser, [mode, ...common], opts.timeoutMs);
      diagLog(`${mode} exited ok; stderr=${(r.stderr || '').toString().slice(-200)}`);
    } catch (e) {
      lastErr = e;
      diagLog(`${mode} failed: ${e.message}; stderr=${(e.stderr || '').toString().slice(-300)}`);
    }
    if (fs.existsSync(tmpPdf) && fs.statSync(tmpPdf).size >= 1024) break;
  }

  if (!fs.existsSync(tmpPdf) || fs.statSync(tmpPdf).size < 1024) {
    const detail = lastErr
      ? `（浏览器退出：${lastErr.message} ${(lastErr.stderr || '').toString().slice(-200)}）`
      : '';
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
    throw new Error('PDF 生成失败（输出文件不存在或过小），请检查浏览器是否支持无头打印。' + detail);
  }

  // 移动到目标路径
  fs.copyFileSync(tmpPdf, target);
  try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  diagLog(`done, size=${fs.statSync(target).size}`);
  return target;
}

module.exports = { findBrowser, htmlToPdf };
