import type { ModelAdvice, ModelTier, RiskScore } from "./types";

export function recommendModel(risk: RiskScore): ModelAdvice {
  let tier: ModelTier = "cheap";
  const reasons: string[] = [];

  if (risk.level === "high") {
    tier = "strong";
    reasons.push("High overall risk; prefer a stronger model.");
  } else if (risk.level === "medium") {
    tier = "balanced";
    reasons.push("Medium overall risk; balanced model is appropriate.");
  } else {
    tier = "cheap";
    reasons.push("Low overall risk; cheaper models likely sufficient.");
  }

  if (risk.breakdown.sensitivity > 40) {
    reasons.push("Sensitive areas present; favor models with better reasoning.");
  }

  if (risk.breakdown.scope > 40) {
    reasons.push("Wide scope; prefer models that handle larger context well.");
  }

  return {
    tier,
    reasons
  };
}

