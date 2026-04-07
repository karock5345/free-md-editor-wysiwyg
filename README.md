# Free MD Editor (WYSIWYG starter)

A desktop Markdown editor built with Go + Wails that behaves more like a simple word processor:

- Direct rich-text style editing in a `contenteditable` document
- Save / Save As / Open `.md`
- Markdown import/export for common structures
- Windows and Linux desktop target

![](D:\Projects\free-md-editor-wysiwyg\Screenshot02.png)

## Requirements

- Go 1.21+
- Wails CLI v2.11+
- Node is not required for this starter because the frontend is plain HTML/CSS/JS

## Run

```
go mod tidy
wails dev
```

## Build

```
wails build
```

## Notes

- This is a practical starter, not a full-fidelity Markdown round-trip engine.
- It supports headings, bold, italic, strike, inline code, code blocks, blockquotes, links, lists, horizontal rules and paragraphs.
- Very complex nested Markdown may be normalized on save.
- On Linux, newer distros may require WebKit 4.1 packages and the `webkit2_41` build tag depending on your environment.

## Editor features

The in‑page rich‑text editor provides a number of convenient word‑processor style tools:

- **Live rich text editing** using a `contenteditable` area.
- **Find / Replace panel** with highlighting, navigation, and optional replace-all.
- **Formatting commands** (bold, italic, underline, strike, headings, blockquote, code, lists, etc.) via `execCommand` helpers.
- **Insert helpers** for links, inline code, code blocks, tables, horizontal rules, and more.
- **Theme toggle** (light/dark) and **zoom controls** with persistence in `localStorage`.
- **Color picker** for chosen text color, selection preservation, and status updates.
- Selection save/restore utilities allow toolbar actions to operate on the current range.

These functions are defined in `frontend/main.js` and drive the behaviour of the editor UI.
