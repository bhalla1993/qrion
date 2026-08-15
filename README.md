## Qrion

**Pre-query Query Risk & Scope Analyzer for AI coding workflows.**

Qrion is a local-only tool that helps you understand the **risk, scope, and token pressure** of an AI coding query **before** you send it to agents like Cursor, GitHub Copilot, Claude, or terminal-based assistants.

Instead of guessing what a prompt might do to your repo, Qrion gives you a fast, deterministic “pre-flight” analysis so you can adjust the prompt before you burn tokens or trigger repo-wide changes.

### Why Qrion exists

Modern AI coding tools are powerful, but it’s easy to:

- Send **vague or broad prompts** that confuse the agent.
- Accidentally ask for **repo-wide refactors**.
- Blow through **token limits and budgets** on over-scoped queries.
- Touch **sensitive areas** (auth, payments, infra) without realizing the risk.

Qrion sits **one step before** your agent. You run Qrion on your query first, see what it thinks the scope and risk are, then refine your prompt and send it to your agent of choice.

Qrion is:

- **Local-first**: runs on your machine, no external services.
- **Agent-agnostic**: works with Cursor, Copilot, Claude, etc.
- **Heuristic and deterministic**: no AI calls; behavior is explainable.

> Status: **MVP1 analyzer is implemented and usable**, but still evolving. Heuristics are approximate and intentionally conservative.

---

### MVP1 features

For a given query and workspace, Qrion computes:

- **Risk score**
  - 0–100 numeric score and **Low / Medium / High** risk level.
  - Based on vague/broad wording, repo-wide language, multi-module scope, multi-step instructions, sensitive areas, and context pressure.

- **Query complexity analysis**
  - Detects:
    - Vague terms.
    - Repo-wide language (“entire project”, “all files”, “whole codebase”).
    - Multi-step instructions (“first… then… finally…”).
    - Multi-module queries (auth, payments, API, DB, frontend/backend, CI/CD).
    - Sensitive domains (auth, billing, DB schema, migrations, infra, secrets).

- **Likely relevant files**
  - Indexes your workspace and ranks files using:
    - Filename tokens.
    - Folder tokens.
    - Import paths.
    - Simple top-level symbols (classes, functions, types).
  - Returns a top-N list with **scores and reasons**.

- **Estimated token range**
  - Heuristic estimate of:
    - Query tokens.
    - Relevant file tokens (low/high).
    - Total tokens (low/high).
  - Based on file sizes and a simple chars-per-token approximation.

- **Context window risk**
  - Compares estimated token usage against a context limit (default ~128k).
  - Flags **Low / Medium / High** context risk and approximate headroom.

- **Model recommendation**
  - Suggests a tier:
    - **cheap** – docs/tests, small focused changes, low risk.
    - **balanced** – typical multi-file work, medium risk.
    - **strong** – broad or sensitive work with higher risk.
  - Based on risk score and sensitivity/scope.

- **Rewrite suggestions**
  - Deterministic hints to:
    - Clarify intent and acceptance criteria.
    - Narrow from repo-wide to specific modules/files.
    - Separate analysis from implementation steps.
    - Call out sensitive areas explicitly.

- **Split suggestions**
  - Suggestions for breaking a broad prompt into smaller prompts:
    - One module per query.
    - One step per query (analyze → refactor → test).
    - Repo-wide refactors as a series of targeted passes.

None of this simulates an agent or guarantees exact behavior. It’s a **prompt linting and planning tool**, not a code execution engine.

---

### Monorepo structure

- **Root**
  - `package.json`: npm workspaces, shared scripts.
  - `tsconfig.base.json`: shared TypeScript configuration.
  - `.gitignore`: standard Node/TypeScript ignores.
  - `.qraignore`: patterns Qrion may use when scanning a repository.
  - `MVP1.md`: internal MVP1 planning doc.
- **packages/**
  - `core`: shared TypeScript library for query analysis (implemented heuristics).
  - `cli`: command-line interface for running Qrion locally.
  - `vscode`: VS Code extension integration.

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Build all packages

```bash
npm run build
```

### 3. Run tests (core heuristics)

```bash
npm test
```

> Heuristics are approximate by design. Qrion does **not** simulate any specific agent and does **not** guarantee exact file or token usage.

---

## Quick start: try Qrion on this repo

1. **Clone and build:**

   ```bash
   git clone https://github.com/bhalla1993/qrion.git
   cd qrion
   npm install
   npm run build
   ```

2. **Run an analysis (from the `qrion` folder):**

   ```bash
   npx qra analyze "Refactor the entire project to use ES modules and clean up all technical debt."
   ```

   This:

   - Indexes the current repo (`qrion`) using simple static analysis.
   - Prints a summary with:
     - Risk level and score.
     - Token and context window risk estimates.
     - Likely relevant files (with reasons).
     - Model tier recommendation.
     - Rewrite and split suggestions.

   Example output:

   ```text
   === Query Risk & Scope Analyzer (QRA) ===
   Query: Refactor the entire project to use ES modules and clean up all technical debt.

   Summary: Risk: MEDIUM (48/100). Estimated tokens: query ~22, files ~3000–5500, total ~3022–5522.
   Context risk: LOW against ~128000 token window. Likely relevant files: 1.

   Risk: MEDIUM (48/100)
     Reasons: Repo-wide language detected. | Vague or broad phrasing detected. | Long query; may indicate multi-part work.
   Tokens: query ~22
     files ~3000-5500
     total ~3022-5522
   Context risk: LOW
     limit ~128000 tokens, headroom ~122478
   Model tier: BALANCED
     Reasons: Medium overall risk; balanced model is appropriate.
   Top relevant files:
     - packages/core/src/analyze.ts (score 7, ~625 tokens) – folder matches: core | filename matches: analyze
   Rewrite suggestions:
     - Clarify the intent and expected outcome.
     - Narrow the scope from repo-wide to specific areas.
   Split suggestions:
     - Turn repo-wide refactors into a series of smaller passes.
   Confidence: MEDIUM
     Reasons: No strongly matching files detected.
   ```

3. **JSON output (for debugging or tooling):**

   ```bash
   npx qra analyze --json "Refactor the auth and billing flows across the repo and update database migrations."
   ```

---

## CLI usage (`@qra/cli`)

Once you have built the repo (`npm run build`), you can run Qrion in two main ways.

### 1. Analyze the `qrion` repo itself (from this folder)

```bash
npx qra analyze "Refactor the auth and billing flows"
```

Or from a file:

```bash
npx qra analyze --file prompt.txt
```

For tooling or scripts, use JSON output:

```bash
npx qra analyze --json "Refactor the auth and billing flows"
```

### 2. Analyze another project (while Qrion lives in a sibling folder)

Suppose you have:

```text
/code/qrion      # this repo
/code/my-app    # your project
```

From inside `my-app`:

```bash
node ../qrion/packages/cli/dist/cli.js analyze "Refactor the auth and billing flows across the repo and update database migrations."
```

Qrion will:

- Use `my-app` as `cwd`.
- Index `my-app`’s files.
- Analyze your prompt against that repo.

> In a future release, the CLI will likely be published to npm so you can simply run `npx @qra/cli analyze ...` from any project without cloning this repo.

---

## VS Code extension usage (`@qra/vscode`)

The VS Code extension gives you the same analysis inside your editor.

### Install locally

1. Build the extension:

   ```bash
   cd qrion
   npm run build --workspace @qra/vscode
   ```

2. In VS Code:
   - Open this repo (`qrion`) in VS Code.
   - Use the **Run and Debug** view and choose “Launch Extension” (standard VS Code extension dev flow), or package and install the extension manually (`vsce package`, then “Install from VSIX…”).

### Commands

Once the extension is running in the Extension Host window:

- **Qrion: Analyze Selected Text**
  - Select text in an open editor.
  - Run the command from the Command Palette.

- **Qrion: Analyze Clipboard Text**
  - Copy your query to the clipboard.
  - Run the command; Qrion analyzes clipboard contents.

- **Qrion: Analyze Custom Query**
  - Run the command and type or paste a query into the input box.

Qrion uses the current workspace folder as the **workspace root** for indexing.

### Qrion sidebar panel

After running any Qrion command, the **Qrion** view in the activity bar will show:

- Risk level and score.
- Token estimates and context risk.
- Likely relevant files (with reasons).
- Model tier recommendation.
- Rewrite suggestions.
- Split suggestions.
- Confidence and a short summary.

#### Screenshot placeholders

- **Screenshot 1**: Qrion sidebar panel showing a Medium-risk analysis for a repo-wide refactor query.
- **Screenshot 2**: Command Palette with:
  - “Qrion: Analyze Selected Text”
  - “Qrion: Analyze Clipboard Text”
  - “Qrion: Analyze Custom Query”

These can be added later as actual images under `packages/vscode/media/` and referenced here.

---

## Packages

- **`@qra/core`**
  - Shared, pure TypeScript library that implements:
    - Query feature extraction (vague, multi-step, multi-module, sensitive, repo-wide).
    - Lightweight repo indexing (paths, folder/file tokens, import and symbol hints, approximate token count).
    - File relevance ranking.
    - Token and context window risk estimation.
    - Risk scoring (0–100) and model tier recommendation.
    - Rewrite and split suggestion heuristics.
  - Exposes a single entry point: `analyzeQuery(AnalyzeInput): AnalyzeReport`.

- **`@qra/cli`**
  - CLI entry point for running Qrion from the terminal.
  - Commands:
    - `qra analyze "<query>"`
    - `qra analyze --file path/to/prompt.txt`
    - `qra analyze --json "<query>"`
  - Default output: human-readable summary with risk, tokens, context risk, relevant files, model tier, and suggestions.

- **`@qra/vscode`**
  - VS Code extension integration.
  - Commands:
    - Qrion: Analyze Selected Text
    - Qrion: Analyze Clipboard Text
    - Qrion: Analyze Custom Query
  - Shows a side panel (Qrion view) with the same report information as the CLI.

---

## Roadmap

Qrion is being developed in stages.

### MVP1 – Analyzer (current)

- Local-only, deterministic heuristics:
  - Query feature extraction.
  - Repo indexing and file ranking.
  - Token and context risk estimation.
  - Risk scoring and model tier suggestion.
  - Rewrite and split recommendations.
- CLI (`qra`) and VS Code extension wired to the same core.

### MVP2 – Agent Flight Recorder (planned)

*(Not implemented yet – design stage only.)*

- Observe real agent runs (locally) to:
  - Compare pre-query estimates vs. actual file touches and token usage.
  - Surface “surprises” where the agent did more/less than expected.
  - Feed back into heuristic tuning.

### MVP3 – Optimization and guardrails (planned)

*(Not implemented yet – ideas only.)*

- Smarter suggestions to:
  - Automatically propose cheaper, narrower prompts.
  - Warn when a query is likely to exceed budget or context limits.
  - Offer simple guardrails (e.g., “only touch these folders/files” hints).

---

## Limitations & scope

To keep Qrion simple, fast, and local-only, MVP1 **does not**:

- Call any AI APIs.
- Perform deep AST parsing or rely on language servers.
- Predict exact cost or exact token counts.
- Predict exact file-read sets or simulate specific agents.

It is meant as a **prompt linting / pre-flight assistant**, not as a guarantee of what your agent will do.

---

## Discoverability & topics

Qrion is aimed at developers who:

- Use AI coding tools daily.
- Have token or budget constraints.
- Care about avoiding repo-wide surprises and wasted queries.

Suggested GitHub topics:

`ai`, `developer-tools`, `cli`, `vscode-extension`, `prompt-engineering`, `prompt-linting`, `static-analysis`, `copilot`, `cursor`, `claude`, `token`, `context-window`, `refactoring`.

