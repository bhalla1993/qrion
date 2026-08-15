## Qrion

[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Local Only](https://img.shields.io/badge/Local--only-Yes-2E7D32)](#)
[![No AI Calls](https://img.shields.io/badge/No%20AI%20calls-Yes-7B1FA2)](#)
[![CLI](https://img.shields.io/badge/CLI-Yes-111827)](#cli-usage-qra-cli)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code%20extension-Yes-007ACC)](#vs-code-extension-usage-qra-vscode)
[![Static Analysis](https://img.shields.io/badge/Static%20analysis-Yes-0F766E)](#mvp1-features)

**Pre-query Query Risk & Scope Analyzer for AI coding workflows.**

Qrion is a local-only tool that helps you understand the **risk, scope, and token pressure** of an AI coding query **before** you send it to agents like Cursor, GitHub Copilot, Claude, or terminal-based assistants.

Instead of guessing what a prompt might do to your repo, Qrion gives you a fast, deterministic pre-flight analysis so you can adjust the prompt before you burn tokens or trigger repo-wide changes.

## Why Qrion is different

Qrion is not trying to predict an agent exactly. It is trying to help you **write better prompts**.

That means:

- Local-only analysis on your machine.
- Deterministic heuristics instead of AI calls.
- Agent-agnostic output you can use with Cursor, Copilot, Claude, or other agent tools.
- Clear reasons for every score and suggestion.

Qrion is meant for the moment **before** you send the query.

> Status: **MVP1 analyzer is implemented and usable**, but still evolving. Heuristics are approximate and intentionally conservative.

## Who Qrion is for

Qrion is useful for developers who:

- Use AI coding tools daily.
- Work with limited token budgets or plan limits.
- Want to avoid vague, broad, or expensive prompts.
- Care about understanding scope before asking an agent to change code.
- Prefer static analysis and explainable heuristics over black-box behavior.

It is especially helpful for teams and solo developers using tools such as:

- Cursor
- GitHub Copilot
- Claude Code / Claude-based workflows
- Terminal-based agent workflows

## MVP1 features

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

## Architecture overview

```text
                +---------------------------+
                |   Developer writes query  |
                +-------------+-------------+
                              |
                              v
                +---------------------------+
                |   Qrion core heuristics   |
                |  query / repo / scoring   |
                +------+------+-------------+
                       |      |
           +-----------+      +------------------+
           |                                     |
           v                                     v
  +-------------------+                +-----------------------+
  |   CLI (`qra`)     |                |  VS Code extension    |
  | human / JSON out   |                |  sidebar + commands   |
  +-------------------+                +-----------------------+
```

## Repository structure

- **Root**
  - `package.json`: npm workspaces, shared scripts.
  - `tsconfig.base.json`: shared TypeScript configuration.
  - `.gitignore`: standard Node/TypeScript ignores.
  - `.qraignore`: patterns Qrion may use when scanning a repository.
  - `MVP1.md`: internal MVP1 planning doc.

- **`packages/core`**
  - Shared TypeScript library for query analysis heuristics.
  - Main entrypoint: `analyzeQuery(AnalyzeInput): AnalyzeReport`.

- **`packages/cli`**
  - Command-line interface for running Qrion locally.

- **`packages/vscode`**
  - VS Code extension integration with a Qrion sidebar.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Build all packages

```bash
npm run build
```

### 3. Run tests

```bash
npm test
```

> Heuristics are approximate by design. Qrion does **not** simulate any specific agent and does **not** guarantee exact file or token usage.

## CLI usage (`@qra/cli`)

Once you have built the repo (`npm run build`), you can run Qrion from the terminal.

> **Naming note:** the product and repo are called **Qrion**, but the CLI binary is the shorter `qra` (the underlying **Q**uery **R**isk **A**nalyzer engine). Same tool, two names by design — `qra` for typing speed, "Qrion" for the brand.

### Analyze a query string

```bash
npx qra analyze "Refactor auth module to use JWT instead of sessions."
```

### Analyze from a file

```bash
echo "Refactor the auth and billing flows across the repo and update database migrations." > prompt.txt
npx qra analyze --file prompt.txt
```

### JSON output

```bash
npx qra analyze --json "Refactor the auth and billing flows across the repo and update database migrations."
```

### Analyze another project

If you have:

```text
/code/qrion      # this repo
/code/my-app     # your project
```

From inside `my-app`:

```bash
node ../qrion/packages/cli/dist/cli.js analyze "Refactor the auth and billing flows across the repo and update database migrations."
```

Qrion will:

- Use `my-app` as `cwd`.
- Index `my-app`’s files.
- Analyze your prompt against that repo.

> In a future release, the CLI may be published to npm so you can run `npx @qra/cli analyze ...` from any project without cloning this repo.

## Example CLI output

Command:

```bash
npx qra analyze "Refactor the entire project to use ES modules and clean up all technical debt."
```

Sample output:

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
Relevant files:
  - packages/core/src/analyze.ts (score 7, ~625 tokens) – folder matches: core | filename matches: analyze
Rewrite suggestions:
  - Clarify the intent and expected outcome.
  - Narrow the scope from repo-wide to specific areas.
Split suggestions:
  - Turn repo-wide refactors into a series of smaller passes.
Confidence: MEDIUM
  Reasons: No strongly matching files detected.
```

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

### Screenshot placeholders

- **Screenshot 1**: Qrion sidebar panel showing a Medium-risk analysis for a repo-wide refactor query.
- **Screenshot 2**: Command Palette with:
  - “Qrion: Analyze Selected Text”
  - “Qrion: Analyze Clipboard Text”
  - “Qrion: Analyze Custom Query”

These can be added later as actual images under `packages/vscode/media/` and referenced here.

## Examples

Try Qrion with prompts like these:

- `Refactor auth module to use JWT instead of sessions.`
  - Likely signals: sensitive area, focused scope, moderate token pressure.

- `Fix everything across the whole codebase and make it production ready.`
  - Likely signals: vague, repo-wide, broad scope, split suggestion.

- `First update the API routes, then adjust the DB schema, then add tests.`
  - Likely signals: multi-step, multi-module, rewrite and split suggestions.

- `Improve the frontend performance and clean up the backend logging and caching.`
  - Likely signals: multi-module, likely medium or high scope risk.

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

- Observe real agent runs locally to:
  - Compare pre-query estimates vs. actual file touches and token usage.
  - Surface “surprises” where the agent did more or less than expected.
  - Feed back into heuristic tuning.

### MVP3 – Optimization and guardrails (planned)

*(Not implemented yet – ideas only.)*

- Smarter suggestions to:
  - Automatically propose cheaper, narrower prompts.
  - Warn when a query is likely to exceed budget or context limits.
  - Offer simple guardrails such as “only touch these folders/files” hints.

## Contributing

Qrion is intentionally small and OSS-friendly. Contributions are welcome.

### Good first contributions

- Improve heuristic wording or thresholds.
- Add core tests for edge cases.
- Add sample queries to the README.
- Improve panel styling or command UX in the VS Code extension.

### Before you open a PR

- Keep the core local-only and deterministic.
- Avoid adding heavy dependencies unless they clearly improve the MVP.
- Add or update tests when changing heuristics.
- Keep public-facing wording honest about approximation and scope.

### Development flow

```bash
npm install
npm run build
npm test
```

## Limitations

To keep Qrion simple, fast, and local-only, MVP1 **does not**:

- Call any AI APIs.
- Perform deep AST parsing or rely on language servers.
- Predict exact cost or exact token counts.
- Predict exact file-read sets or simulate specific agents.

It is meant as a **prompt linting / pre-flight assistant**, not as a guarantee of what your agent will do.

## Discoverability

Qrion is aimed at developers who:

- Use AI coding tools daily.
- Have token or budget constraints.
- Care about avoiding repo-wide surprises and wasted queries.

GitHub topics are configured in the repository's **About** section, so the README does not duplicate them here.

