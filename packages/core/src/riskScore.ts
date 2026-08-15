import type { ContextRisk, RiskLevel, RiskScore } from "./types";
import type { QueryFeatureSummary } from "./queryFeatures";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function levelFromScore(score: number): RiskLevel {
  if (score < 30) {
    return "low";
  }
  if (score < 60) {
    return "medium";
  }
  return "high";
}

export function computeContextRisk(
  estimatedTotalHigh: number,
  contextWindowTokens: number
): ContextRisk {
  const headroomTokens = Math.max(0, contextWindowTokens - estimatedTotalHigh);
  const usageRatio =
    contextWindowTokens > 0 ? estimatedTotalHigh / contextWindowTokens : 0;

  let level: RiskLevel = "low";
  if (usageRatio > 0.8) {
    level = "high";
  } else if (usageRatio > 0.5) {
    level = "medium";
  }

  return {
    level,
    contextWindowTokens,
    estimatedTotalHigh,
    headroomTokens
  };
}

export function computeRiskScore(
  features: QueryFeatureSummary,
  contextRisk: ContextRisk
): RiskScore {
  let scope = 0;
  let ambiguity = 0;
  let complexity = 0;
  let tokenPressure = 0;
  let sensitivity = 0;
  const reasons: string[] = [];

  // Increments scale with how many distinct signals fired, not just presence,
  // so that queries stacking multiple strong signals can actually reach the
  // higher end of the 0-100 range instead of plateauing far below it.
  if (features.repoWideSignals.length > 0) {
    scope += Math.min(100, features.repoWideSignals.length * 50);
    reasons.push("Repo-wide language detected.");
  }

  if (features.vagueSignals.length > 0) {
    ambiguity += Math.min(100, features.vagueSignals.length * 45);
    reasons.push("Vague or broad phrasing detected.");
  }

  if (features.multiStepSignals.length > 0) {
    complexity += 30;
    reasons.push("Multi-step instructions detected.");
  }

  if (features.multiModuleSignals.length > 1) {
    complexity += Math.min(60, features.multiModuleSignals.length * 20);
    reasons.push("Multiple modules or layers mentioned.");
  }

  if (features.sensitiveSignals.length > 0) {
    sensitivity += Math.min(100, features.sensitiveSignals.length * 25);
    reasons.push("Sensitive domains (auth, payments, infra, etc.) detected.");
  }

  if (features.wordCount > 300) {
    complexity += 15;
    reasons.push("Long query; may indicate multi-part work.");
  }

  if (features.isVeryShort) {
    ambiguity += 35;
    reasons.push("Very short query; likely underspecified.");
  }

  if (contextRisk.level === "medium") {
    tokenPressure += 40;
    reasons.push("Medium context window pressure.");
  } else if (contextRisk.level === "high") {
    tokenPressure += 80;
    reasons.push("High context window pressure.");
  }

  const breakdown = {
    scope: clamp(scope, 0, 100),
    ambiguity: clamp(ambiguity, 0, 100),
    complexity: clamp(complexity, 0, 100),
    tokenPressure: clamp(tokenPressure, 0, 100),
    sensitivity: clamp(sensitivity, 0, 100)
  };

  const weights = {
    scope: 0.25,
    ambiguity: 0.2,
    complexity: 0.2,
    tokenPressure: 0.15,
    sensitivity: 0.2
  };

  const overall =
    breakdown.scope * weights.scope +
    breakdown.ambiguity * weights.ambiguity +
    breakdown.complexity * weights.complexity +
    breakdown.tokenPressure * weights.tokenPressure +
    breakdown.sensitivity * weights.sensitivity;

  const level = levelFromScore(overall);

  return {
    overall: Math.round(overall),
    level,
    breakdown,
    reasons
  };
}

