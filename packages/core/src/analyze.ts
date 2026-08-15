import type {
  AnalyzeInput,
  AnalyzeReport,
  ContextRisk,
  QraAnalysisOptions,
  QraQueryInput,
  RiskScore,
  TokenEstimate
} from "./types";
import { extractQueryFeatures } from "./queryFeatures";
import { buildRepoIndex } from "./repoIndex";
import { rankFiles } from "./fileRanking";
import { estimateTokenUsage } from "./tokenEstimate";
import { computeContextRisk, computeRiskScore } from "./riskScore";
import { recommendModel } from "./modelAdvice";
import { buildRewriteSuggestions } from "./rewrite";
import { buildSplitSuggestions } from "./split";
import { buildReport, createDefaultOptions } from "./utils";
import { defaultConfig } from "./config";

export interface AnalyzeQueryParams extends AnalyzeInput {}

const EMPTY_TOKEN_ESTIMATE: TokenEstimate = {
  queryTokens: 0,
  fileTokensLow: 0,
  fileTokensHigh: 0,
  totalTokensLow: 0,
  totalTokensHigh: 0,
  method: "heuristic"
};

const NEUTRAL_RISK_SCORE: RiskScore = {
  overall: 0,
  level: "low",
  breakdown: {
    scope: 0,
    ambiguity: 0,
    complexity: 0,
    tokenPressure: 0,
    sensitivity: 0
  },
  reasons: []
};

export function analyzeQuery(params: AnalyzeQueryParams): AnalyzeReport {
  const options: QraAnalysisOptions = createDefaultOptions(params.options);
  const input: QraQueryInput = params.query;

  const features = extractQueryFeatures(input);

  const indexResult = buildRepoIndex({
    cwd: input.cwd
  });

  const relevantFiles = options.includeFileRanking
    ? rankFiles(input.text, {
        repoFiles: indexResult.files,
        maxResults: defaultConfig.maxFilesPerQuery,
        intent: features.intent
      })
    : [];

  const fileTokenSamples = relevantFiles.map((f) => f.approxTokens);

  const tokens: TokenEstimate = options.includeTokenEstimate
    ? estimateTokenUsage(input.text, fileTokenSamples)
    : EMPTY_TOKEN_ESTIMATE;

  const context: ContextRisk = computeContextRisk(
    tokens.totalTokensHigh,
    options.contextWindowTokens ?? 128_000
  );

  const risk: RiskScore = options.includeRiskScore
    ? computeRiskScore(features, context)
    : NEUTRAL_RISK_SCORE;

  const modelAdvice = recommendModel(risk);
  const shouldShowSuggestions =
    options.includeSuggestions && features.intent === "code-change";
  const rewrites = shouldShowSuggestions
    ? buildRewriteSuggestions(features)
    : [];
  const splits = shouldShowSuggestions
    ? buildSplitSuggestions(features)
    : [];

  const baseReport = buildReport({
    input,
    options,
    index: indexResult.files,
    relevantFiles,
    tokens,
    context,
    risk,
    features
  });

  const tokenBudget = options.maxTokens ?? defaultConfig.maxTokensPerQuery;
  const budgetReasons =
    options.includeTokenEstimate && tokenBudget && tokens.totalTokensHigh > tokenBudget
      ? [
          `Estimated tokens (~${tokens.totalTokensHigh}) exceed the configured per-query budget (~${tokenBudget}).`
        ]
      : [];

  return {
    ...baseReport,
    reasons: [...baseReport.reasons, ...budgetReasons],
    model: modelAdvice,
    rewrites,
    splits
  };
}

