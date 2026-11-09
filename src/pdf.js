'use strict';
/*
 * HTML -> PDF：调用本机 Edge / Chrome / Chromium 的无头打印能力，无需安装任何第三方依赖。
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
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      // Linux 常见安装位置（发行版 / snap / 容器镜像各不相同）
      '/usr/local/bin/microsoft-edge',
      '/usr/local/bin/google-chrome',
      '/usr/local/bin/google-chrome-stable',
      '/usr/local/bin/chromium',
      '/usr/local/bin/chromium-browser',
      '/snap/bin/chromium',
      '/opt/google/chrome/chrome'
    );
  }
  return list;
}

/** 在 PATH 中查找浏览器可执行文件（兼容 apt / snap / 容器内自定义安装）。 */
const BROWSER_NAMES = [
  'msedge', 'microsoft-edge', 'microsoft-edge-stable',
  'google-chrome', 'google-chrome-stable', 'chrome',
  'chromium', 'chromium-browser', 'headless_shell'
];

function findByPathName() {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const name of BROWSER_NAMES) {
    for (const dir of dirs) {
      const p = path.join(dir, name);
      try { if (fs.existsSync(p)) return p; } catch (_) { /* ignore */ }
    }
  }
  return null;
}

function findBrowser() {
  for (const p of browserCandidates()) {
    try { if (p && fs.existsSync(p)) return p; } catch (_) { /* ignore */ }
  }
  return findByPathName();
}

/**
 * 构造子进程环境：剔除 Windows 应用兼容性垫片变量 __COMPAT_LAYER。
 * 该变量（如取值 DetectorsAppHealth）会让被拉起的 Chromium/Edge 无头进程
 * 立即退出、不执行打印，导致“输出文件不存在或过小”。
 */
function childEnv() {
  const env = Object.assign({}, process.env);
  delete env.__COMPAT_LAYER;
  return env;
}

function runExecutable(file, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: timeoutMs || 90000, maxBuffer: 8 * 1024 * 1024, env: childEnv() },
      (err, stdout, stderr) => {
        if (err) { err.stdout = stdout; err.stderr = stderr; reject(err); return; }
        resolve({ stdout, stderr });
      });
  });
}

// 诊断日志（便于排查扩展赅主内的无头打印问题）
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
    throw new Error('未找到 Microsoft Edge / Google Chrome / Chromium，请安装其一，或用 --browser 指定可执行文件路径。');
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
  // Linux / 容器内以 root 运行时 Chromium 需要关闭沙箱，否则静默退出
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    common.unshift('--no-sandbox', '--disable-dev-shm-usage');
  }

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
