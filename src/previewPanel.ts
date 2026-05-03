import * as vscode from 'vscode';

interface PiperTTSApi {
	readText(text: string): Promise<void>;
	stopPlayback(): void;
	selectVoice(): Promise<void>;
}

let piperApi: PiperTTSApi | undefined;

async function getPiperApi(): Promise<PiperTTSApi | undefined> {
	if (piperApi) {
		return piperApi;
	}
	const ext = vscode.extensions.getExtension('sethmiller.piper-tts');
	if (!ext) {
		vscode.window.showErrorMessage('Piper TTS extension is not installed.');
		return undefined;
	}
	if (!ext.isActive) {
		await ext.activate();
	}
	piperApi = ext.exports as PiperTTSApi;
	return piperApi;
}

export class MarkdownPreviewPanel {
	private static panels = new Map<string, MarkdownPreviewPanel>();
	private readonly panel: vscode.WebviewPanel;
	private readonly docUri: vscode.Uri;
	private readonly context: vscode.ExtensionContext;
	private disposed = false;

	static createOrShow(context: vscode.ExtensionContext, docUri: vscode.Uri) {
		const key = docUri.toString();
		const existing = MarkdownPreviewPanel.panels.get(key);
		if (existing && !existing.disposed) {
			existing.panel.reveal(vscode.ViewColumn.Beside);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'mdReaderPreview',
			`MD Reader: ${docUri.path.split('/').pop()}`,
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);

		const instance = new MarkdownPreviewPanel(context, panel, docUri);
		MarkdownPreviewPanel.panels.set(key, instance);
	}

	static updateIfVisible(docUri: vscode.Uri) {
		const instance = MarkdownPreviewPanel.panels.get(docUri.toString());
		if (instance && !instance.disposed) {
			instance.render();
		}
	}

	private constructor(
		context: vscode.ExtensionContext,
		panel: vscode.WebviewPanel,
		docUri: vscode.Uri
	) {
		this.context = context;
		this.panel = panel;
		this.docUri = docUri;

		this.panel.onDidDispose(() => this.dispose());

		this.panel.webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case 'tts-play': {
					const api = await getPiperApi();
					if (api && msg.text) {
						try {
							await api.readText(msg.text);
							this.panel.webview.postMessage({ type: 'tts-ended' });
						} catch {
							this.panel.webview.postMessage({ type: 'tts-ended' });
						}
					}
					break;
				}
				case 'tts-stop': {
					const api = await getPiperApi();
					api?.stopPlayback();
					break;
				}
				case 'tts-select-voice': {
					const api = await getPiperApi();
					api?.selectVoice();
					break;
				}
			}
		});

		this.render();
	}

	private async render() {
		const doc = await vscode.workspace.openTextDocument(this.docUri);
		const mdText = doc.getText();
		const html = await this.renderMarkdown(mdText);
		this.panel.webview.html = html;
	}

	private async renderMarkdown(mdSource: string): Promise<string> {
		// Use VS Code's built-in markdown rendering
		const rendered = await vscode.commands.executeCommand<string>(
			'markdown.api.render',
			mdSource
		);
		const htmlBody = rendered || this.escapeHtml(mdSource);
		return this.getFullHtml(htmlBody);
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	private getFullHtml(bodyHtml: string): string {
		const nonce = getNonce();
		return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">
:root {
  --bg: var(--vscode-editor-background, #1e1e1e);
  --fg: var(--vscode-editor-foreground, #d4d4d4);
  --accent: var(--vscode-textLink-foreground, #3794ff);
  --border: var(--vscode-panel-border, #444);
  --toolbar-bg: var(--vscode-editorWidget-background, #252526);
  --btn-hover: var(--vscode-toolbar-hoverBackground, #333);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
  font-size: var(--vscode-font-size, 14px);
  background: var(--bg);
  color: var(--fg);
  line-height: 1.6;
}

/* TTS Toolbar */
#tts-toolbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--border);
}
#tts-toolbar button {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--fg);
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}
#tts-toolbar button:hover {
  background: var(--btn-hover);
}
#tts-toolbar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
#tts-toolbar button.active {
  border-color: var(--accent);
  color: var(--accent);
}
#tts-status {
  font-size: 12px;
  color: var(--accent);
  margin-left: auto;
}

/* Markdown content */
#content {
  padding: 16px 24px 48px;
  max-width: 900px;
  margin: 0 auto;
}
#content h1, #content h2, #content h3,
#content h4, #content h5, #content h6 {
  margin-top: 1.4em;
  margin-bottom: 0.4em;
  color: var(--fg);
}
#content h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
#content h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
#content p { margin: 0.6em 0; }
#content a { color: var(--accent); }
#content code {
  background: var(--vscode-textCodeBlock-background, #2d2d2d);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
}
#content pre {
  background: var(--vscode-textCodeBlock-background, #2d2d2d);
  padding: 12px 16px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.8em 0;
}
#content pre code {
  background: transparent;
  padding: 0;
}
#content blockquote {
  border-left: 4px solid var(--accent);
  padding-left: 16px;
  margin: 0.8em 0;
  opacity: 0.85;
}
#content ul, #content ol { padding-left: 2em; margin: 0.5em 0; }
#content li { margin: 0.25em 0; }
#content table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
#content th, #content td {
  border: 1px solid var(--border);
  padding: 6px 12px;
  text-align: left;
}
#content th { background: var(--toolbar-bg); }
#content img { max-width: 100%; }
#content hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }

/* Selection highlight for TTS */
::selection {
  background: rgba(55, 148, 255, 0.3);
}
</style>
</head>
<body>

<div id="tts-toolbar">
  <button id="btn-play" title="Read selected text or full document">&#9654; Play</button>
  <button id="btn-stop" title="Stop reading" disabled>&#9632; Stop</button>
  <button id="btn-voice" title="Change TTS voice">&#127908; Voice</button>
  <span id="tts-status"></span>
</div>

<div id="content">
${bodyHtml}
</div>

<script nonce="${nonce}">
(function() {
  const vscode = acquireVsCodeApi();
  const btnPlay = document.getElementById('btn-play');
  const btnStop = document.getElementById('btn-stop');
  const btnVoice = document.getElementById('btn-voice');
  const status = document.getElementById('tts-status');
  let playing = false;

  function setPlaying(val) {
    playing = val;
    btnPlay.disabled = val;
    btnStop.disabled = !val;
    if (val) {
      btnPlay.classList.add('active');
      status.textContent = 'Reading...';
    } else {
      btnPlay.classList.remove('active');
      status.textContent = '';
    }
  }

  function getSelectedText() {
    const sel = window.getSelection();
    return sel ? sel.toString().trim() : '';
  }

  function getFullText() {
    const content = document.getElementById('content');
    return content ? content.innerText.trim() : '';
  }

  btnPlay.addEventListener('click', () => {
    const text = getSelectedText() || getFullText();
    if (!text) return;
    setPlaying(true);
    vscode.postMessage({ type: 'tts-play', text: text });
  });

  btnStop.addEventListener('click', () => {
    vscode.postMessage({ type: 'tts-stop' });
    setPlaying(false);
  });

  btnVoice.addEventListener('click', () => {
    vscode.postMessage({ type: 'tts-select-voice' });
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'tts-ended') {
      setPlaying(false);
    }
  });
})();
</script>
</body>
</html>`;
	}

	private dispose() {
		this.disposed = true;
		MarkdownPreviewPanel.panels.delete(this.docUri.toString());
		this.panel.dispose();
	}
}

function getNonce(): string {
	let text = '';
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return text;
}
