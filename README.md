# DB Viz — VS Code Extension

A VS Code extension that replicates the **DB Viz** web app: a DBML & SQL schema editor with an interactive ERD diagram.

## Features

- **Custom editor** for `.dbml` and `.sql` files — opens automatically when you open those files
- **Split pane** — editable source on the left, live ERD diagram on the right (drag divider to resize)
- **Interactive ERD** — draggable table nodes, zoom/pan, fit-to-view, table search with keyboard navigation
- **Layout persistence** — node positions saved per-file in VS Code workspace state
- **Content search** — `Ctrl+F` / `Cmd+F` to find and navigate matches inside the editor
- **Save** — `Ctrl+S` / `Cmd+S` or the Save button
- **Solarized Light theme** — identical colour palette to the web app
- **SQL support** — SQL files are converted to DBML via `@dbml/core`, supports PostgreSQL, MySQL

## Usage

1. Open any `.dbml` or `.sql` file — the DB Viz editor opens automatically
2. Edit DBML/SQL in the left pane; the diagram updates in real time
3. Drag table nodes to rearrange — positions are saved automatically
4. Use **Ctrl+F** to search inside the editor
5. Use **DB Viz: New DBML File** command (right-click in Explorer) to create a new schema file

## Commands

| Command | Description |
|---|---|
| `DB Viz: Open Schema Visualizer` | Open current file in DB Viz editor |
| `DB Viz: New DBML File` | Create a new `.dbml` file with a starter schema |

## Development

```bash
pnpm install
node esbuild.js           # one-off build
node esbuild.js --watch   # watch mode
```

Press **F5** in VS Code to launch an Extension Development Host.

## Stack

Same as the web app:
- `@dbml/core` — DBML parser + SQL→DBML importer
- `@xyflow/react` — ReactFlow ERD canvas
- `lucide-react` — icons
- React 19
- esbuild for bundling
