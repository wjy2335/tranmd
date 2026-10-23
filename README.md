# TranMD

Copy notes or a selection as clean, standard Markdown — stripping wikilinks, embeds, callouts, frontmatter, comments, tags, highlights and footnotes so it renders correctly in **MarginNote 4** and any other Markdown app.

## Why TranMD?

Obsidian has many features that are not part of standard Markdown. When you copy a note into MarginNote 4 (or a plain Markdown editor), syntax such as `[[wikilinks]]`, `![[embeds]]`, `> [!note]` callouts, YAML frontmatter, `%%comments%%`, inline `#tags`, `==highlight==`, `~~strikethrough~~`, footnotes and block references either does not render or leaks content that was meant to stay hidden. TranMD converts a note — or just the selected text — into clean, portable Markdown and copies it to your clipboard.

## Features

- Copy the current selection, or the whole note when nothing is selected
- Works in both **editing** and **reading** mode
- Desktop and mobile (iOS / iPadOS) support
- Code blocks, inline code and `$$math$$` blocks are protected from conversion
- Available from the command palette, the ribbon, the editor context menu and the file explorer context menu

## Conversion rules

| Obsidian syntax | TranMD output |
| --- | --- |
| `[[note\|alias]]`, `[[note]]` | `alias`, `note` (plain text) |
| `[[note#heading]]` | `heading` |
| `![[image.png\|300]]` | `image.png` |
| `> [!note] Title` | `> Title` (kept as a blockquote) |
| YAML frontmatter | removed |
| `%%comment%%` | removed |
| inline `#tag` | `tag` (hash removed) |
| `^blockid` | removed |
| `==highlight==` | `<mark>highlight</mark>` |
| `~~strikethrough~~` | `strikethrough` (MN4 has no strikethrough) |
| `[^1]` footnotes | reference removed, definition becomes `- footnote: ...` |
| fenced code / inline code / `$$math$$` | left untouched |

## Installation

### Community plugins

Search for **TranMD** in Settings → Community plugins → Browse.

### Manual

1. Download `manifest.json` and `main.js` from the latest release.
2. Create the folder `<vault>/.obsidian/plugins/tranmd/`.
3. Put both files inside it.
4. Enable **TranMD** in Settings → Community plugins.

## Usage

- **Command palette** (`Ctrl/Cmd+P`):
  - *Copy selection as MarginNote Markdown* — copies the selection, or the whole note if nothing is selected
  - *Copy note as MarginNote Markdown* — copies the whole note
- **Ribbon**: the clipboard icon copies the whole note
- **Editor context menu**: right-click a selection → *Copy as MarginNote Markdown*
- **File explorer**: right-click a `.md` file → *Copy as MarginNote Markdown*

Then paste into MarginNote 4 and turn on the **Markdown** toggle in the card's text field.

## Mobile (iOS / iPadOS)

The plugin is not desktop-only and includes a native clipboard path, so it also works on Obsidian mobile:

- Select text → open the selection / `⋮` menu → *Copy as MarginNote Markdown*
- Or add the command to the mobile toolbar: Settings → Mobile → Manage toolbar options
- Or run it from the command palette

## Known limitations

- Inline `$...$` math is not individually protected (`$$...$$` blocks are). A `==` or `~~` inside inline math could be converted.
- Standard Markdown links to local `.md` files are kept as-is; they will not navigate inside MarginNote.
- Nested callouts keep their indentation; only the type marker is removed.

## Development

```bash
npm install
npm run build   # bundle src/ into main.js
npm test        # run the conversion tests
npm run dev     # watch build
```

## License

[MIT](LICENSE)
