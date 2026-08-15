import type { QueryFeatureSummary, SplitSuggestion } from "./types";

export function buildSplitSuggestions(
  features: QueryFeatureSummary
): SplitSuggestion[] {
  const suggestions: SplitSuggestion[] = [];

  if (features.multiStepSignals.length > 0) {
    suggestions.push({
      kind: "split",
      title: "Split a multi-step query into sequential prompts.",
      detail:
        "Use one prompt per step (e.g., analysis, refactor, tests) and wait for each result before sending the next."
    });
  }

  if (features.multiModuleSignals.length > 1) {
    suggestions.push({
      kind: "split",
      title: "Break multi-module work into module-focused prompts.",
      detail:
        "Handle auth, payments, API, database, and frontend in separate prompts so each stays within context limits."
    });
  }

  if (features.repoWideSignals.length > 0) {
    suggestions.push({
      kind: "split",
      title: "Turn repo-wide refactors into a series of smaller passes.",
      detail:
        "Start with a narrow pilot area, then repeat the prompt for the next folder or subsystem."
    });
  }

  return suggestions;
}

