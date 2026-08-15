## Query Risk & Scope Analyzer (QRA)

Query Risk & Scope Analyzer (QRA) is a developer tool that helps estimate the risk, scope, likely files, and token pressure of an AI coding query **before** sending it to an agent.

This repository currently contains the **MVP1 scaffold** only. The core analysis logic (heuristics, ranking, and scoring) will be implemented in later iterations.

### Project goals

- **Local-first** prompt risk / scope analysis for coding agents.
- **Deterministic, inspectable heuristics** for understanding what a query will touch.
- **No external AI calls** from the analyzer core by default.

### Monorepo structure

- **Root**
  - `package.json`: npm workspaces, shared scripts.
  - `tsconfig.base.json`: shared TypeScript configuration.
  - `.gitignore`: standard Node/TypeScript ignores.
  - `.qraignore`: patterns QRA may use when scanning a repository.
- **packages/**
  - `core`: shared TypeScript library for query analysis (to be implemented).
  - `cli`: command-line interface for running QRA locally.
  - `vscode`: VS Code extension integration.

### Status

This is a **scaffold**:

- Placeholder modules and types exist in `@qra/core`.
- CLI and VS Code extension are wired to be able to consume `@qra/core` later.
- No real analysis logic is implemented yet.

### Getting started

#### Install dependencies

```bash
npm install
```

#### Build all packages

```bash
npm run build
```

#### Run tests (placeholder)

```bash
npm test
```

> Note: Tests and concrete analysis logic will be added in future steps.

### Packages

- **`@qra/core`**
  - Shared types and deterministic, pure analysis primitives (stubs for now).
  - Will host query analysis heuristics, file ranking, token estimation, and risk scoring.

- **`@qra/cli`**
  - CLI entry point for running QRA from the terminal.
  - Currently provides a placeholder `qra analyze` command shape.

- **`@qra/vscode`**
  - VS Code extension shell for QRA.
  - Activates commands such as:
    - Analyze selected text
    - Analyze clipboard text
    - Manually analyze a query
  - Uses a basic webview panel placeholder.

### Next steps

- Flesh out the shared types and config in `@qra/core`.
- Implement deterministic query analysis heuristics and scoring.
- Wire the CLI and VS Code extension to call into the core analyzer.
- Add tests for the core analysis pipeline and integration paths.

