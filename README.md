# MD Reader

VS Code extension that provides a Markdown preview with built-in text-to-speech (TTS) powered by [Piper TTS](https://marketplace.visualstudio.com/items?itemName=sethmiller.piper-tts).

## Motivation

The Piper TTS extension only works with text selected inside a standard VS Code editor. It does not work in webview-based panels like the built-in Markdown Preview. MD Reader solves this by rendering Markdown in its own webview and bridging user text selection directly to the Piper TTS API.

## Architecture

```
src/
├── extension.ts       # Entry point. Registers the command and listens for document changes.
└── previewPanel.ts    # Webview panel: Markdown rendering, TTS toolbar UI, Piper TTS API bridge.
```

### Data flow

1. User opens a `.md` file and runs **MD Reader: Open Markdown Reader**.
2. `extension.ts` creates a `MarkdownPreviewPanel` webview in a side column.
3. The Markdown source is rendered to HTML via VS Code's `markdown.api.render` command.
4. The webview displays the rendered HTML with a sticky TTS toolbar (Play, Stop, Voice).
5. When the user clicks **Play**, the webview sends the selected text (or full document text) via `postMessage` to the extension host.
6. The extension host calls `PiperTTSApi.readText(text)` on the Piper TTS extension's exported API.
7. When playback finishes, the host sends `tts-ended` back to the webview to reset the UI.

### Key design decisions

- **Extension dependency**: `sethmiller.piper-tts` is declared in `extensionDependencies` so VS Code activates it automatically.
- **Lazy API acquisition**: The Piper TTS API reference is fetched once on first use, not at activation time.
- **CSP-compliant webview**: All inline styles and scripts use a per-render nonce. No external resources are loaded.
- **Live reload**: `onDidChangeTextDocument` re-renders the preview when the source `.md` file is edited.
- **Single panel per file**: Opening the same file again reveals the existing panel instead of creating a duplicate.

## Prerequisites

- VS Code >= 1.98.0
- [Piper TTS](https://marketplace.visualstudio.com/items?itemName=sethmiller.piper-tts) extension installed
- Linux x64 or Windows x64 (Piper TTS platform constraint)

## Development

```sh
# Install dependencies
npm install

# Compile TypeScript (outputs to out/)
npm run compile

# Watch mode (recompiles on save)
npm run watch
```

### Testing locally

```sh
# Package into a .vsix
npx vsce package --allow-missing-repository

# Install the .vsix
code --install-extension md-reader-*.vsix
```

After installing, reload VS Code (`Ctrl+Shift+P` → "Reload Window").

### Project commands

| Script                | Description                          |
|-----------------------|--------------------------------------|
| `npm run compile`     | One-shot TypeScript compilation      |
| `npm run watch`       | Incremental compilation on file save |
| `npx vsce package`    | Package as `.vsix` for installation  |

## Usage

1. Open any `.md` file in VS Code.
2. Click the preview icon in the editor title bar, or run `Ctrl+Shift+P` → **MD Reader: Open Markdown Reader**.
3. In the preview panel:
   - **▶ Play** — reads selected text aloud, or the full document if nothing is selected.
   - **■ Stop** — stops playback.
   - **🎤 Voice** — opens the Piper TTS voice selector.

## Extension manifest

| Field                  | Value                                      |
|------------------------|--------------------------------------------|
| ID                     | `fbernardes.md-reader`                     |
| Activation             | On command `md-reader.openPreview`         |
| Extension dependency   | `sethmiller.piper-tts`                     |
| Setting                | `piper-tts.voice` (delegated to Piper TTS) |

## Limitations

- No macOS support (Piper TTS constraint).
- TTS reads plain text extracted from rendered HTML — code blocks and tables are read as flat text.
- No sentence-level highlight during playback (Piper does not expose a progress callback).

## License

MIT
