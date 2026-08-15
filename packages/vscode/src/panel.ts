import type {
  CancellationToken,
  WebviewView,
  WebviewViewProvider
} from "vscode";
import * as vscode from "vscode";

export class QraPanelProvider implements WebviewViewProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtml();
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
      p {
        margin: 0.3rem 0;
      }
      code {
        font-family: var(--vscode-editor-font-family);
      }
    `;

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
      "<h1>Query Risk & Scope Analyzer (QRA)</h1>",
      "<p>This is a placeholder panel. The analyzer core is not implemented yet.</p>",
      "<p>Use the QRA commands from the Command Palette to trigger analyses once available.</p>",
      "<p><code>QRA: Analyze Selected Text</code>, <code>QRA: Analyze Clipboard Text</code>, or <code>QRA: Analyze Query...</code></p>",
      "</body>",
      "</html>"
    ].join("");
  }
}

