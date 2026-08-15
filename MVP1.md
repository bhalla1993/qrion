## QRA MVP1 Plan

This document captures the MVP1 scope and phases for **Query Risk & Scope Analyzer (QRA)**.

QRA is a local-only, agent-agnostic pre-flight analyzer for AI coding prompts. It uses **static, deterministic heuristics** to estimate:

- Prompt **risk level** (Low / Medium / High)
- Query **complexity and ambiguity**
- Likely **relevant files**
- Approximate **token usage**
- **Context window risk** vs. a configurable limit
- Heuristic **model tier recommendation**
- **Rewrite** and **split** suggestions

No AI models are called, and no agent behavior is simulated.

---

### Core principles

- **Local-only**; no network calls from the analyzer core.
- **Static analysis only**; no AST-heavy or LSP-dependent logic in MVP1.
- **Agent-agnostic**; works regardless of which coding agent the user prefers.
- **Deterministic & explainable**; every output should have traceable reasons.
- **Fast enough to run before every query**.
- **Honest about uncertainty**; estimates are approximate, not guarantees.

---

### Architecture overview

- **`@qra/core`**
  - Pure TypeScript library with no VS Code or CLI dependencies.
  - Responsibilities:
    - Parse query text into **features** (vague, multi-step, multi-module, sensitive, repo-wide).
    - Build a lightweight **repo index** (paths, folder/file tokens, import and symbol hints, approximate token count).
    - Rank **relevant files** based on token overlap and simple heuristics.
    - Estimate **token usage** for query + relevant files (low/high range).
    - Compute **context window risk** relative to a limit (default 128k tokens).
    - Compute **risk score** (0–100) and **RiskLevel**.
    - Recommend a **ModelTier** (cheap / balanced / strong).
    - Generate **rewrite** and **split** suggestions.
    - Produce an `AnalyzeReport` with all outputs and confidence information.

- **`@qra/cli`**
  - Thin Node.js CLI wrapper around `@qra/core`.
  - Commands:
    - `qra analyze "<query>"` — analyze a query string.
    - `qra analyze --file path/to/prompt.txt` — analyze from a file.
    - `qra analyze --json "<query>"` — JSON report for tooling.
  - Default output: human-readable summary with risk, tokens, context risk, model tier, top files, rewrites, and splits.

- **`@qra/vscode`**
  - VS Code extension using the same `@qra/core` API.
  - Commands:
    - Analyze **selected text**.
    - Analyze **clipboard** text.
    - Analyze **manual** input.
  - Shows a **side panel / webview** summarizing the analysis.

---

### Shared types (simplified)

Defined in `@qra/core`:

- **`AnalyzeInput`** – query + options.
- **`AnalyzeReport`** – full analysis output.
- **`RiskLevel`** – `"low" | "medium | "high"`.
- **`ConfidenceLevel`** – `"low" | "medium" | "high"`.
- **`ModelTier`** – `"cheap" | "balanced" | "strong"`.
- **`RelevantFile`** – path, score, reasons, approxTokens.
- **`TokenEstimate`** – queryTokens, fileTokensLow/High, totalTokensLow/High.
- **`ContextRisk`** – level, window size, estimate, headroom.
- **`RewriteSuggestion`** – deterministic rewrite hints.
- **`SplitSuggestion`** – suggestions for breaking large tasks up.

These are the **single source of truth** for both CLI and VS Code.

---

### MVP1 phases & checklist

#### Phase 1 – Scaffold (DONE)
- [x] Root npm workspaces and TypeScript base config.
- [x] `@qra/core` package scaffold.
- [x] `@qra/cli` package scaffold.
- [x] `@qra/vscode` extension scaffold.

#### Phase 2 – Core analyzer (DONE – first pass)
- [x] Define shared types (`AnalyzeInput`, `AnalyzeReport`, `RiskLevel`, etc.).
- [x] Implement query feature extraction (vague, multi-step, multi-module, sensitive, repo-wide).
- [x] Implement lightweight repo indexing (paths, tokens, import and symbol hints).
- [x] Implement file relevance ranking (folder/name/import/symbol matches, generic-name penalties).
- [x] Implement token estimation heuristics and total low/high range.
- [x] Implement context window risk (Low/Medium/High vs. limit).
- [x] Implement weighted risk score and level mapping.
- [x] Implement model tier recommendation (cheap/balanced/strong).
- [x] Implement rewrite and split suggestion generators.
- [x] Compute confidence level and reasons; generate summary string.

> Later iterations can tune weights, thresholds, and patterns, but the pipeline is in place.

#### Phase 3 – CLI integration (NEXT)
- [ ] Wire `qra analyze` to call `analyzeQuery` from `@qra/core`.
- [ ] Support:
  - [ ] `qra analyze "<query>"`
  - [ ] `qra analyze --file path/to/prompt.txt`
  - [ ] `qra analyze --json "<query>"` (JSON output)
- [ ] Human-readable output format:
  - [ ] Risk level and score.
  - [ ] Token estimates and context window risk.
  - [ ] Top relevant files with reasons.
  - [ ] Model recommendation.
  - [ ] Key rewrite and split suggestions.

#### Phase 4 – VS Code extension integration
- [ ] Wire commands to `@qra/core`:
  - [ ] Analyze selected text.
  - [ ] Analyze clipboard text.
  - [ ] Analyze manual input.
- [ ] Use workspace folder as `cwd` for repo indexing.
- [ ] Render analysis in a side panel/webview:
  - [ ] Risk level and score.
  - [ ] Token estimates and context risk.
  - [ ] Relevant files (with reasons).
  - [ ] Model tier suggestion.
  - [ ] Rewrite and split suggestions.
  - [ ] Confidence and short explanation.

#### Phase 5 – Tests & validation
- [ ] Add minimal core tests (e.g., with Node’s built-in `node:test` or a light runner).
- [ ] Cover:
  - [ ] Query feature extraction for vague/multi-step/multi-module/sensitive/repo-wide cases.
  - [ ] Risk score mapping to Low/Medium/High.
  - [ ] Token estimate sanity (longer text ⇒ higher estimate).
  - [ ] File ranking ordering with simple fixture repo.
- [ ] Add smoke tests for CLI and VS Code (manual instructions are fine for MVP1).

#### Phase 6 – Docs & polish
- [ ] Update `README.md` with:
  - [ ] Clear description of QRA and its limitations.
  - [ ] Installation and build instructions.
  - [ ] CLI usage examples.
  - [ ] VS Code extension usage notes.
  - [ ] Disclaimer about approximations and non-simulation of agents.
- [ ] Add simple CONTRIBUTING notes (optional for MVP1).
- [ ] Ensure license and metadata are public-OSS ready.

---

### Acceptance criteria for MVP1

- `qra analyze "<query>"` runs locally using only static analysis.
- `qra analyze --json "<query>"` returns a single JSON `AnalyzeReport`.
- VS Code extension can analyze selection / clipboard / manual text and display a readable report.
- Both CLI and extension rely solely on `@qra/core` for analysis logic.
- Heuristics are fast, explainable, and obviously approximate.
- Repository is suitable for a public GitHub release.

