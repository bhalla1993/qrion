import type {
  AnalyzeReport,
  ConfidenceLevel,
  ContextRisk,
  QraAnalysisOptions,
  QraFileIndexEntry,
  QraQueryInput,
  RelevantFile,
  RiskScore,
  TokenEstimate
} from "./types";
import type { QueryFeatureSummary } from "./queryFeatures";
import { defaultConfig } from "./config";

export function createDefaultOptions(
  overrides: Partial<QraAnalysisOptions> = {}
): QraAnalysisOptions {
  return {
    includeFileRanking: true,
    includeTokenEstimate: true,
    includeRiskScore: true,
    includeSuggestions: true,
    contextWindowTokens: 128_000,
    ...overrides
  };
}

export function inferConfidence(
  featuresWordCount: number,
  index: QraFileIndexEntry[],
  relevantFiles: RelevantFile[]
): { level: ConfidenceLevel; reasons: string[] } {
  const reasons: string[] = [];
  let level: ConfidenceLevel = "medium";

  if (featuresWordCount < 5) {
    level = "low";
    reasons.push("Very short query; limited information to analyze.");
  } else if (featuresWordCount > 400) {
    reasons.push("Long query; heuristics may miss some nuance.");
  }

  if (index.length === 0) {
    level = "low";
    reasons.push("No indexable project files found.");
  } else if (relevantFiles.length === 0) {
    reasons.push("No strongly matching files detected.");
  } else {
    if (level !== "low") {
      level = "high";
      reasons.push("Multiple signals and relevant files available.");
    }
  }

  return { level, reasons };
}

export function buildSummary(
  risk: RiskScore,
  context: ContextRisk,
  tokens: TokenEstimate,
  topFileCount: number
): string {
  const parts: string[] = [];
  parts.push(`Risk: ${risk.level.toUpperCase()} (${risk.overall}/100).`);
  parts.push(
    `Estimated tokens: query ~${tokens.queryTokens}, files ~${tokens.fileTokensLow}–${tokens.fileTokensHigh}, total ~${tokens.totalTokensLow}–${tokens.totalTokensHigh}.`
  );
  parts.push(
    `Context risk: ${context.level.toUpperCase()} against ~${context.contextWindowTokens} token window.`
  );
  parts.push(`Likely relevant files: ${topFileCount}.`);
  return parts.join(" ");
}

export function buildReport(params: {
  input: QraQueryInput;
  options: QraAnalysisOptions;
  index: QraFileIndexEntry[];
  relevantFiles: RelevantFile[];
  tokens: TokenEstimate;
  context: ContextRisk;
  risk: RiskScore;
  features: QueryFeatureSummary;
}): Omit<AnalyzeReport, "model" | "rewrites" | "splits"> {
  const confidence = inferConfidence(
    params.input.text.trim().split(/\s+/).filter(Boolean).length,
    params.index,
    params.relevantFiles
  );

  const summary = buildSummary(
    params.risk,
    params.context,
    params.tokens,
    params.relevantFiles.length
  );

  const contextLimit =
    params.options.contextWindowTokens ?? params.context.contextWindowTokens;

  const reasons = [
    ...params.risk.reasons,
    ...confidence.reasons
  ];

  return {
    input: params.input,
    options: params.options,
    workspaceRoot: params.input.cwd,
    contextLimit,
    config: defaultConfig,
    queryFeatures: params.features,
    index: params.index,
    relevantFiles: params.relevantFiles,
    tokenEstimate: params.tokens,
    contextRisk: params.context,
    risk: params.risk,
    confidence,
    reasons,
    summary
  };
}

