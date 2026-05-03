# MD Reader

VS Code extension that provides a Markdown preview with built-in text-to-speech (TTS) powered by the browser's native [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API).

## Motivation

The built-in VS Code Markdown Preview does not expose a text selection API, making it impossible for TTS tools to read selected text. MD Reader solves this by rendering Markdown in its own webview and driving TTS directly from the webview via `window.speechSynthesis` — no external extension required.

## Architecture

```
src/
├── extension.ts       # Entry point. Registers the command and listens for document changes.
└── previewPanel.ts    # Webview panel: Markdown rendering, TTS toolbar UI, Web Speech API.
```

### Data flow

1. User opens a `.md` file and runs **MD Reader: Open Markdown Reader**.
2. `extension.ts` creates a `MarkdownPreviewPanel` webview in a side column.
3. The Markdown source is rendered to HTML via VS Code's `markdown.api.render` command.
4. The webview displays the rendered HTML with a sticky TTS toolbar (Play, Stop, voice selector).
5. When the user clicks **Play**, the webview reads the selected text (or full document text) using `window.speechSynthesis.speak()`.
6. When playback finishes or is cancelled, the UI resets automatically via `utterance.onend`.

### Key design decisions

- **Self-contained TTS**: Uses the browser's native Web Speech API — no external extension dependency.
- **Voice selector**: A `<select>` dropdown is populated from `speechSynthesis.getVoices()`, updated via `onvoiceschanged`.
- **CSP-compliant webview**: All inline styles and scripts use a per-render nonce. No external resources are loaded.
- **Live reload**: `onDidChangeTextDocument` re-renders the preview when the source `.md` file is edited.
- **Single panel per file**: Opening the same file again reveals the existing panel instead of creating a duplicate.

## Prerequisites

- VS Code >= 1.98.0

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
   - **Voice dropdown** — select any voice available in your browser/OS.

## Extension manifest

| Field      | Value                              |
|------------|------------------------------------|
| ID         | `fbernardes.md-reader`             |
| Activation | On command `md-reader.openPreview` |

## Limitations

- TTS reads plain text extracted from rendered HTML — code blocks and tables are read as flat text.
- Available voices depend on the OS and browser engine embedded in VS Code (Electron). Voice availability varies by platform.
- No word-level highlight during playback (Web Speech API's `boundary` event support varies by engine).

## License

MIT
