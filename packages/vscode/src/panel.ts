import type {
  CancellationToken,
  WebviewView,
  WebviewViewProvider
} from "vscode";
import * as vscode from "vscode";
import type { AnalyzeReport, RelevantFile } from "@qra/core";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderRelevantFiles(files: RelevantFile[]): string {
  if (files.length === 0) {
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
      renderRelevantFiles(r.relevantFiles),

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

      "</body>",
      "</html>"
    ].join("");
  }
}

