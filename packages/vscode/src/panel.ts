import type {
  CancellationToken,
  WebviewView,
  WebviewViewProvider
} from "vscode";
import * as vscode from "vscode";
import type { AnalyzeReport, PromptIntent, RelevantFile } from "@qra/core";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderRelevantFiles(files: RelevantFile[], intent: PromptIntent): string {
  if (files.length === 0) {
    if (intent === "out-of-scope") {
      return "<p>This prompt is outside Qrion's scope, so no files were ranked.</p>";
    }
    return "<p>No strongly relevant files detected.</p>";
  }

  const items = files.slice(0, 10).map((file) => {
    const reasons = file.reasons.slice(0, 2).join(" | ");
    return `<li><code>${escapeHtml(
      file.path
    )}</code> (score ${file.score}, ~${file.approxTokens} tokens)${
      reasons ? ` – ${escapeHtml(reasons)}` : ""
    }</li>`;
  });

  return `<ul>${items.join("")}</ul>`;
}

function intentTagClass(intent: PromptIntent): string {
  switch (intent) {
    case "code-change":
      return "tag tag-intent-code-change";
    case "repo-survey":
      return "tag tag-intent-repo-survey";
    case "out-of-scope":
      return "tag tag-intent-out-of-scope";
  }
}

export class QraPanelProvider implements WebviewViewProvider {
  static instance: QraPanelProvider | undefined;

  private view: WebviewView | undefined;
  private report: AnalyzeReport | undefined;
  private errorMessage: string | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {
    QraPanelProvider.instance = this;
  }

  resolveWebviewView(
    webviewView: WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    this.update();
  }

  setReport(report: AnalyzeReport): void {
    this.report = report;
    this.errorMessage = undefined;
    this.update();
  }

  setError(message: string): void {
    this.errorMessage = message;
    this.report = undefined;
    this.update();
  }

  private update(): void {
    if (!this.view) {
      return;
    }

    this.view.webview.html = this.getHtml();
  }

  private getHtml(): string {
    const style = `
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 12px;
        line-height: 1.5;
      }
      h1 {
        font-size: 1.1rem;
        margin-bottom: 0.5rem;
      }
      h2 {
        font-size: 0.95rem;
        margin-top: 1rem;
        margin-bottom: 0.3rem;
      }
      p {
        margin: 0.25rem 0;
      }
      .section-card {
        margin-top: 0.75rem;
        padding: 0.85rem;
        border-radius: 12px;
        border: 1px solid var(--vscode-editorWidget-border);
        background: var(--vscode-editorWidget-background);
      }
      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 0.75rem;
        margin-bottom: 0.6rem;
      }
      .section-copy {
        color: var(--vscode-descriptionForeground);
        font-size: 0.9rem;
      }
      code {
        font-family: var(--vscode-editor-font-family);
      }
      ul {
        padding-left: 1.1rem;
      }
      li {
        margin-bottom: 0.2rem;
      }
      .tag {
        display: inline-block;
        padding: 0.05rem 0.3rem;
        border-radius: 4px;
        font-size: 0.75rem;
        text-transform: uppercase;
      }
      .tag-low { background: #1e8e3e33; color: #1e8e3e; }
      .tag-medium { background: #f9ab0033; color: #b76e00; }
      .tag-high { background: #d9302533; color: #a50e0e; }
      .tag-intent-code-change { background: #0984e333; color: #0984e3; }
      .tag-intent-repo-survey { background: #7b1fa233; color: #7b1fa2; }
      .tag-intent-out-of-scope { background: #5f6b7a33; color: #5f6b7a; }
      .next-action {
        font-weight: 600;
      }
      .out-of-scope-card {
        border-left: 4px solid #5f6b7a;
      }
      .copy-button {
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        cursor: pointer;
        white-space: nowrap;
      }
      .copy-button:hover {
        background: var(--vscode-button-hoverBackground);
      }
      .copy-button:active {
        transform: translateY(1px);
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
      }
    `;

    if (!this.report) {
      if (this.errorMessage) {
        return [
          "<!DOCTYPE html>",
          "<html>",
          "<head>",
          "<meta charset=\"UTF-8\" />",
          "<style>",
          style,
          "</style>",
          "</head>",
          "<body>",
          "<h1>Qrion</h1>",
          `<p>${escapeHtml(this.errorMessage)}</p>`,
          "<p>Open a workspace and run a Qrion command again.</p>",
          "</body>",
          "</html>"
        ].join("");
      }

      return [
        "<!DOCTYPE html>",
        "<html>",
        "<head>",
        "<meta charset=\"UTF-8\" />",
        "<style>",
        style,
        "</style>",
        "</head>",
        "<body>",
        "<h1>Qrion</h1>",
        "<p>No analysis yet. Run one of the QRA commands:</p>",
        "<p><code>Qrion: Analyze Selected Text</code>, <code>Qrion: Analyze Clipboard Text</code>, or <code>Qrion: Analyze Custom Query</code></p>",
        "</body>",
        "</html>"
      ].join("");
    }

    const r = this.report;

    const riskTagClass = `tag tag-${escapeHtml(r.risk.level)}`;
    const contextTagClass = `tag tag-${escapeHtml(r.contextRisk.level)}`;
    const intentClass = intentTagClass(r.queryFeatures.intent);
    const outOfScopeMessage =
      r.queryFeatures.intent === "out-of-scope"
        ? [
            "<div class=\"section-card out-of-scope-card\">",
            "<p><strong>Out of scope:</strong> This looks like general chat, not a coding or repository analysis request.</p>",
            "<p>Try asking about a file, module, bug, repo overview, or change.</p>",
            "</div>"
          ].join("")
        : "";

    const rewriteItems =
      r.rewrites.length === 0
        ? "<p>No rewrite suggestions.</p>"
        : `<ul>${r.rewrites
            .slice(0, 3)
            .map((s) => {
              const detail = s.detail ? `<div>${escapeHtml(s.detail)}</div>` : "";
              return `<li><strong>${escapeHtml(
                s.title
              )}</strong>${detail}</li>`;
            })
            .join("")}</ul>`;

    const splitItems =
      r.splits.length === 0
        ? "<p>No split suggestions.</p>"
        : `<ul>${r.splits
            .slice(0, 3)
            .map((s) => {
              const detail = s.detail ? `<div>${escapeHtml(s.detail)}</div>` : "";
              return `<li><strong>${escapeHtml(
                s.title
              )}</strong>${detail}</li>`;
            })
            .join("")}</ul>`;

    const confidenceTagClass = `tag tag-${escapeHtml(
      r.confidence.level === "high"
        ? "low"
        : r.confidence.level === "low"
        ? "high"
        : "medium"
    )}`;

    return [
      "<!DOCTYPE html>",
      "<html>",
      "<head>",
      "<meta charset=\"UTF-8\" />",
      "<style>",
      style,
      "</style>",
      "</head>",
      "<body>",
      "<h1>Qrion</h1>",
      `<p>${escapeHtml(r.summary)}</p>`,

      "<h2>Intent</h2>",
      `<p><span class="${intentClass}">${escapeHtml(r.queryFeatures.intent.toUpperCase())}</span></p>`,

      outOfScopeMessage,

      "<h2>Next action</h2>",
      `<div class="section-card"><p class="next-action">${escapeHtml(
        r.nextAction
      )}</p></div>`,

      "<h2>Refined prompt</h2>",
      "<div class=\"section-card\">",
      "<div class=\"section-head\">",
      "<p class=\"section-copy\">Copy this version into your agent when you are ready to move forward.</p>",
      "<button type=\"button\" class=\"copy-button\" id=\"copySuggestedPrompt\">Copy prompt</button>",
      "</div>",
      `<pre><code id="refinedPrompt">${escapeHtml(r.refinedPrompt)}</code></pre>`,
      "</div>",

      "<h2>Risk & context</h2>",
      `<p>Risk: <span class="${riskTagClass}">${escapeHtml(
        r.risk.level.toUpperCase()
      )}</span> (${r.risk.overall}/100)</p>`,
      `<p>Context window: <span class="${contextTagClass}">${escapeHtml(
        r.contextRisk.level.toUpperCase()
      )}</span> vs ~${r.contextRisk.contextWindowTokens} token limit (headroom ~${r.contextRisk.headroomTokens})</p>`,

      "<h2>Tokens</h2>",
      `<p>Query ~${r.tokenEstimate.queryTokens} tokens</p>`,
      `<p>Files ~${r.tokenEstimate.fileTokensLow}–${r.tokenEstimate.fileTokensHigh} tokens</p>`,
      `<p>Total ~${r.tokenEstimate.totalTokensLow}–${r.tokenEstimate.totalTokensHigh} tokens</p>`,

      "<h2>Model recommendation</h2>",
      `<p>Tier: <code>${escapeHtml(r.model.tier.toUpperCase())}</code></p>`,
      r.model.reasons.length
        ? `<p>${escapeHtml(r.model.reasons.join(" | "))}</p>`
        : "",

      "<h2>Likely relevant files</h2>",
      renderRelevantFiles(r.relevantFiles, r.queryFeatures.intent),

      "<h2>Rewrite suggestions</h2>",
      rewriteItems,

      "<h2>Split suggestions</h2>",
      splitItems,

      "<h2>Confidence</h2>",
      `<p>Level: <span class="${confidenceTagClass}">${escapeHtml(
        r.confidence.level.toUpperCase()
      )}</span></p>`,
      r.confidence.reasons.length
        ? `<p>${escapeHtml(r.confidence.reasons.join(" | "))}</p>`
        : "",

      "<script>",
      "(() => {",
      "  const button = document.getElementById('copySuggestedPrompt');",
      "  const promptNode = document.getElementById('refinedPrompt');",
      "  if (!button || !promptNode) { return; }",
      "  const originalLabel = button.textContent || 'Copy prompt';",
      "  button.addEventListener('click', async () => {",
      "    try {",
      "      await navigator.clipboard.writeText(promptNode.textContent || '');",
      "      button.textContent = 'Copied';",
      "    } catch (error) {",
      "      button.textContent = 'Copy failed';",
      "    } finally {",
      "      window.setTimeout(() => { button.textContent = originalLabel; }, 1400);",
      "    }",
      "  });",
      "})();",
      "</script>",

      "</body>",
      "</html>"
    ].join("");
  }
}

