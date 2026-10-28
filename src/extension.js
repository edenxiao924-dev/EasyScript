'use strict';
const vscode = require('vscode');
const { compileSource } = require('./compiler');
const { htmlToPdf, findBrowser } = require('./pdf');

const LANG_ID = 'screenplay';

/** 文档 -> 预览面板 */
const panels = new Map();
/** 文档 -> 防抖定时器 */
const timers = new Map();

function getHtmlFor(doc) {
  try {
    const { ast, html } = compileSource(doc.getText());
    return { html, ast };
  } catch (e) {
    return {
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;padding:20px;color:#b00">
<h3>编译失败</h3><pre>${String(e.message || e).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>
</body></html>`,
      ast: null
    };
  }
}

function scheduleRefresh(doc) {
  if (doc.languageId !== LANG_ID) return;
  const old = timers.get(doc.uri.toString());
  if (old) clearTimeout(old);
  const t = setTimeout(() => {
    timers.delete(doc.uri.toString());
    const panel = panels.get(doc.uri.toString());
    if (panel && panel.visible !== false) {
      const { html } = getHtmlFor(doc);
      panel.webview.html = html;
    }
  }, 250);
  timers.set(doc.uri.toString(), t);
}

function openPreview(doc) {
  const key = doc.uri.toString();
  const existing = panels.get(key);
  if (existing) { existing.reveal(vscode.ViewColumn.Beside); return existing; }

  const panel = vscode.window.createWebviewPanel(
    'screenplayPreview',
    `剧本预览：${doc.fileName ? doc.fileName.split(/[\\/]/).pop() : ''}`,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: false,
      retainContextWhenHidden: true,
      localResourceRoots: []
    }
  );
  panel.webview.html = getHtmlFor(doc).html;
  panels.set(key, panel);

  panel.onDidDispose(() => {
    panels.delete(key);
    const t = timers.get(key);
    if (t) { clearTimeout(t); timers.delete(key); }
  });
  return panel;
}

async function exportPdf(doc, askPath) {
  const { ast } = getHtmlFor(doc);
  let outPath;
  if (askPath) {
    const defaultPath = doc.uri.fsPath.replace(/\.(sp|screenplay)$/i, '') + '.pdf';
    const picked = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultPath),
      filters: { PDF: ['pdf'] }
    });
    if (!picked) return;
    outPath = picked.fsPath;
  } else {
    outPath = doc.uri.fsPath.replace(/\.(sp|screenplay)$/i, '') + '.pdf';
  }

  const browser = findBrowser();
  if (!browser) {
    vscode.window.showErrorMessage('未找到 Microsoft Edge 或 Google Chrome，无法导出 PDF。');
    return;
  }

  await doc.save();
  const { html } = getHtmlFor(doc);

  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: '正在导出 PDF…',
    cancellable: false
  }, async () => {
    try {
      const pdf = await htmlToPdf(html, outPath, { browserPath: browser });
      if (ast && ast.errors && ast.errors.length) {
        vscode.window.showWarningMessage(`PDF 已生成，但有 ${ast.errors.length} 条语法提示。`, '打开 PDF')
          .then(choice => { if (choice === '打开 PDF') vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(pdf)); });
      } else {
        vscode.window.showInformationMessage(`PDF 已生成：${pdf}`, '打开所在文件夹', '在编辑器中打开')
          .then(choice => {
            if (choice === '打开所在文件夹') vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(pdf));
            if (choice === '在编辑器中打开') vscode.commands.executeCommand('vscode.open', vscode.Uri.file(pdf));
          });
      }
    } catch (e) {
      vscode.window.showErrorMessage('PDF 导出失败：' + e.message);
    }
  });
}

function activate(context) {
  const getDoc = () => {
    const editor = vscode.window.activeTextEditor;
    return editor && editor.document.languageId === LANG_ID ? editor.document : null;
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('screenplay.openPreview', async () => {
      const doc = getDoc();
      if (!doc) { vscode.window.showWarningMessage('请先打开一个 .sp 剧本文件。'); return; }
      openPreview(doc);
    }),
    vscode.commands.registerCommand('screenplay.exportPdf', async () => {
      const doc = getDoc();
      if (!doc) { vscode.window.showWarningMessage('请先打开一个 .sp 剧本文件。'); return; }
      await exportPdf(doc, false);
    }),
    vscode.commands.registerCommand('screenplay.exportPdfAs', async () => {
      const doc = getDoc();
      if (!doc) { vscode.window.showWarningMessage('请先打开一个 .sp 剧本文件。'); return; }
      await exportPdf(doc, true);
    }),
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.languageId === LANG_ID) scheduleRefresh(e.document);
    }),
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === LANG_ID) scheduleRefresh(doc);
    }),
    vscode.workspace.onDidCloseTextDocument(doc => {
      const key = doc.uri.toString();
      const panel = panels.get(key);
      if (panel) { panel.dispose(); panels.delete(key); }
    })
  );
}

function deactivate() {
  for (const panel of panels.values()) { try { panel.dispose(); } catch (_) { /* ignore */ } }
  panels.clear();
}

module.exports = { activate, deactivate };
