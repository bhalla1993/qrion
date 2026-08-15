import type { RewriteSuggestion } from "./types";
import type { QueryFeatureSummary } from "./queryFeatures";

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

