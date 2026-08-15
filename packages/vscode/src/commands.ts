import * as vscode from "vscode";
import { getQraSettings } from "./settings";

export function registerQraCommands(
  subscriptions: { push(item: vscode.Disposable): void }
): void {
  const analyzeSelection = vscode.commands.registerCommand(
    "qra.analyzeSelection",
    () => {
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.document.getText(editor.selection);
      const settings = getQraSettings();

      void vscode.window.showInformationMessage(
        `QRA analyze selection (placeholder). Experimental: ${settings.enableExperimentalFeatures}. Selected length: ${
          selection?.length ?? 0
        }`
      );
    }
  );

  const analyzeClipboard = vscode.commands.registerCommand(
    "qra.analyzeClipboard",
    async () => {
      const clipboardText = await vscode.env.clipboard.readText();
      const settings = getQraSettings();

      void vscode.window.showInformationMessage(
        `QRA analyze clipboard (placeholder). Experimental: ${settings.enableExperimentalFeatures}. Clipboard length: ${clipboardText.length}`
      );
    }
  );

  const analyzeManual = vscode.commands.registerCommand(
    "qra.analyzeManual",
    async () => {
      const manualText = await vscode.window.showInputBox({
        prompt: "Enter a query for QRA to analyze (placeholder).",
        placeHolder: "Describe your coding change or question..."
      });

      if (!manualText) {
        return;
      }

      void vscode.window.showInformationMessage(
        `QRA analyze manual query (placeholder). Length: ${manualText.length}`
      );
    }
  );

  subscriptions.push(analyzeSelection);
  subscriptions.push(analyzeClipboard);
  subscriptions.push(analyzeManual);
}

