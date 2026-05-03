import * as vscode from 'vscode';
import { MarkdownPreviewPanel } from './previewPanel';

export function activate(context: vscode.ExtensionContext) {
	const openPreviewDisposable = vscode.commands.registerCommand(
		'md-reader.openPreview',
		() => {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === 'markdown') {
				MarkdownPreviewPanel.createOrShow(context, editor.document.uri);
			}
		}
	);

	context.subscriptions.push(openPreviewDisposable);

	// Re-render when the source document changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.languageId === 'markdown') {
				MarkdownPreviewPanel.updateIfVisible(e.document.uri);
			}
		})
	);
}

export function deactivate() {}
