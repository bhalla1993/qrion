import type {
  AnalyzeInput,
  AnalyzeReport,
  QraAnalysisOptions,
  QraQueryInput
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

export interface AnalyzeQueryParams extends AnalyzeInput {}

export function analyzeQuery(params: AnalyzeQueryParams): AnalyzeReport {
  const options: QraAnalysisOptions = createDefaultOptions(params.options);
  const input: QraQueryInput = params.query;

  const features = extractQueryFeatures(input);

  const indexResult = buildRepoIndex({
    cwd: input.cwd
  });

  const relevantFiles = options.includeFileRanking
    ? rankFiles(input.text, { repoFiles: indexResult.files })
    : [];

  const fileTokenSamples = relevantFiles.map((f) => f.approxTokens);
  const tokens = estimateTokenUsage(input.text, fileTokenSamples);
  const context = computeContextRisk(
    tokens.totalTokensHigh,
    options.contextWindowTokens ?? 128_000
  );
  const risk = computeRiskScore(features, context);
  const modelAdvice = recommendModel(risk);
  const rewrites = options.includeSuggestions
    ? buildRewriteSuggestions(features)
    : [];
  const splits = options.includeSuggestions
    ? buildSplitSuggestions(features)
    : [];

  const baseReport = buildReport({
    input,
    options,
    index: indexResult.files,
    relevantFiles,
    tokens,
    context,
    risk
  });

  return {
    ...baseReport,
    model: modelAdvice,
    rewrites,
    splits
  };
}

