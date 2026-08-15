import * as vscode from "vscode";
import { analyzeQuery } from "@qra/core";
import type { AnalyzeInput } from "@qra/core";
import { QraPanelProvider } from "./panel";

function getWorkspaceCwd(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0]?.uri.fsPath;
}

function revealPanel(): void {
  void vscode.commands.executeCommand("workbench.view.extension.qra");
}

function runAnalysis(source: "selection" | "clipboard" | "manual", text: string): void {
  const cwd = getWorkspaceCwd();
  if (!cwd) {
    QraPanelProvider.instance?.setError(
      "Qrion needs an open workspace to analyze files."
    );
    void vscode.window.showWarningMessage(
      "Qrion: Open a workspace folder before running analysis."
    );
    revealPanel();
    return;
  }

  const input: AnalyzeInput = {
    query: {
      source,
      text,
      cwd
    }
  };

  try {
    const report = analyzeQuery(input);
    QraPanelProvider.instance?.setReport(report);
    revealPanel();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    QraPanelProvider.instance?.setError(`Qrion analysis failed: ${message}`);
    void vscode.window.showErrorMessage(`Qrion: analysis failed - ${message}`);
    revealPanel();
  }
}

export function registerQraCommands(
  subscriptions: { push(item: vscode.Disposable): void }
): void {
  const analyzeSelection = vscode.commands.registerCommand(
    "qra.analyzeSelection",
    () => {
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.document.getText(editor.selection) ?? "";

      if (!selection.trim()) {
        void vscode.window.showWarningMessage(
          "Qrion: No text selected to analyze."
        );
        return;
      }

      runAnalysis("selection", selection);
    }
  );

  const analyzeClipboard = vscode.commands.registerCommand(
    "qra.analyzeClipboard",
    async () => {
      const clipboardText = await vscode.env.clipboard.readText();

      if (!clipboardText.trim()) {
        void vscode.window.showWarningMessage(
          "Qrion: Clipboard is empty, nothing to analyze."
        );
        return;
      }

      runAnalysis("clipboard", clipboardText);
    }
  );

  const analyzeManual = vscode.commands.registerCommand(
    "qra.analyzeManual",
    async () => {
      const manualText = await vscode.window.showInputBox({
        prompt: "Enter a query for Qrion to analyze.",
        placeHolder: "Describe your coding change or question..."
      });

      if (!manualText || !manualText.trim()) {
        void vscode.window.showWarningMessage("Qrion: Query cannot be empty.");
        return;
      }

      runAnalysis("manual", manualText);
    }
  );

  subscriptions.push(analyzeSelection);
  subscriptions.push(analyzeClipboard);
  subscriptions.push(analyzeManual);
}

