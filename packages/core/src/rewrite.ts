import type { RiskLevel, RewriteSuggestion } from "./types";
import type { QueryFeatureSummary } from "./queryFeatures";

function uniqueActions(actions: string[]): string[] {
  return Array.from(new Set(actions));
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatActionList(actions: string[]): string {
  if (actions.length === 0) {
    return "";
  }
  if (actions.length === 1) {
    return actions[0];
  }

  const last = actions[actions.length - 1];
  return `${actions.slice(0, -1).join(", ")}, and ${last}`;
}

function buildDirectiveList(
  features: QueryFeatureSummary,
  riskLevel: RiskLevel
): string[] {
  const directives: string[] = [];

  if (
    riskLevel === "high" ||
    features.repoWideSignals.length > 0 ||
    features.multiModuleSignals.length > 1
  ) {
    directives.push(
      "first identify the smallest safe scope and list the likely files or modules before editing"
    );
  }

  if (features.multiStepSignals.length > 0) {
    directives.push(
      "split the work into analysis, implementation, and validation steps"
    );
  }

  if (features.sensitiveSignals.length > 0) {
    directives.push(
      "treat auth, billing, database, migrations, infra, and secrets as sensitive areas and be conservative"
    );
  }

  if (features.vagueSignals.length > 0 || features.isVeryShort) {
    directives.push(
      "state the expected outcome and acceptance criteria clearly before making changes"
    );
  }

  if (features.wordCount > 300) {
    directives.push(
      "prefer a staged plan so the work stays readable and easy to validate"
    );
  }

  return uniqueActions(directives);
}

export function buildRewriteSuggestions(
  features: QueryFeatureSummary
): RewriteSuggestion[] {
  const suggestions: RewriteSuggestion[] = [];

  if (features.vagueSignals.length > 0 || features.isVeryShort) {
    suggestions.push({
      kind: "rewrite",
      title: "Clarify the intent and expected outcome.",
      detail:
        "Specify what should change, which modules are involved, and how you'll know the result is correct."
    });
  }

  if (features.repoWideSignals.length > 0) {
    suggestions.push({
      kind: "rewrite",
      title: "Narrow the scope from repo-wide to specific areas.",
      detail:
        "Name concrete folders, files, or components that should be in scope instead of the entire project."
    });
  }

  if (features.multiStepSignals.length > 0) {
    suggestions.push({
      kind: "rewrite",
      title: "Separate analysis from implementation steps.",
      detail:
        "Ask the agent to analyze first, summarize what it will change, and then run a second prompt for the edits."
    });
  }

  if (features.multiModuleSignals.length > 1) {
    suggestions.push({
      kind: "rewrite",
      title: "Limit the query to one or two modules at a time.",
      detail:
        "Focus on a single area (e.g., auth, billing, or frontend) per prompt to reduce coordination risk."
    });
  }

  if (features.sensitiveSignals.length > 0) {
    suggestions.push({
      kind: "rewrite",
      title: "Call out sensitive domains explicitly.",
      detail:
        "Mention that changes touch auth, billing, or infra and ask the agent to be conservative and show diffs."
    });
  }

  return suggestions;
}

export function buildNextAction(
  features: QueryFeatureSummary,
  riskLevel: RiskLevel
): string {
  const directives = buildDirectiveList(features, riskLevel);

  if (directives.length === 0) {
    return "Looks focused enough to send as-is. Keep the scope and acceptance criteria explicit.";
  }

  const opener =
    riskLevel === "high"
      ? "Rewrite before sending:"
      : "Consider tightening the prompt:";

  return `${opener} ${formatActionList(directives)}.`;
}

export function buildRefinedPrompt(
  originalText: string,
  features: QueryFeatureSummary,
  riskLevel: RiskLevel
): string {
  const task = originalText.trim().replace(/\s+/g, " ");
  const directives = buildDirectiveList(features, riskLevel);

  const guidance =
    directives.length > 0
      ? directives.map((directive) => `- ${capitalise(directive)}.`)
      : [
          "- Keep the change focused to the smallest relevant scope.",
          "- Include tests if they are needed to validate the change.",
          "- Summarize the files or modules you expect to touch."
        ];

  return [
    "Please help with the following task.",
    "",
    "Task:",
    task,
    "",
    "Guidance:",
    ...guidance,
    "",
    "Return:",
    "- a short plan",
    "- the minimal implementation or analysis",
    "- a short summary of what changed"
  ].join("\n");
}

