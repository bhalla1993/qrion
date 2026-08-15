import type { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { registerQraCommands } from "./commands";
import { QraPanelProvider } from "./panel";

export function activate(context: ExtensionContext): void {
  const subscriptions = context.subscriptions;

  registerQraCommands(subscriptions);

  const provider = new QraPanelProvider(context.extensionUri);
  vscode.window.registerWebviewViewProvider("qra.panel", provider);
}

export function deactivate(): void {
  // Nothing to clean up yet.
}

