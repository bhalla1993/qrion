import type { QraConfig } from "./config";
import type { QueryFeatureSummary } from "./queryFeatures";

export type QraQuerySource = "selection" | "clipboard" | "manual" | "file";

export type RiskLevel = "low" | "medium" | "high";

export type ConfidenceLevel = "low" | "medium" | "high";

export type ModelTier = "cheap" | "balanced" | "strong";

export interface QraQueryInput {
  /**
   * Where the query came from (editor selection, clipboard, manual entry, file).
   */
  source: QraQuerySource;
  /**
   * Raw query text the user intends to send to an AI coding agent.
   */
  text: string;
  /**
   * Optional language identifier, e.g. from an editor.
   */
  languageId?: string;
  /**
   * Working directory used for repo indexing (workspace root).
   */
  cwd?: string;
}

export interface QraAnalysisOptions {
  /**
   * Approximate maximum tokens the user intends to send.
   * Used as a soft cap, not a hard limit.
   */
  maxTokens?: number;
  /**
   * Approximate context window to compare total token estimates against.
   * Defaults come from config if omitted.
   */
  contextWindowTokens?: number;
  includeFileRanking?: boolean;
  includeTokenEstimate?: boolean;
  includeRiskScore?: boolean;
  includeSuggestions?: boolean;
}

export interface QraFileIndexEntry {
  path: string;
  sizeBytes: number;
  approxTokens: number;
  folderTokens: string[];
  fileTokens: string[];
  importTokens: string[];
  symbolTokens: string[];
}

export interface RelevantFile {
  path: string;
  score: number;
  reasons: string[];
  approxTokens: number;
}

export interface TokenEstimate {
  /**
   * Approximate tokens in the raw query string.
   */
  queryTokens: number;
  /**
   * Approximate tokens across the most relevant files considered.
   */
  fileTokensLow: number;
  fileTokensHigh: number;
  totalTokensLow: number;
  totalTokensHigh: number;
  method: "heuristic";
}

export interface ContextRisk {
  level: RiskLevel;
  contextWindowTokens: number;
  estimatedTotalHigh: number;
  headroomTokens: number;
}

export interface RiskBreakdown {
  scope: number;
  ambiguity: number;
  complexity: number;
  tokenPressure: number;
  sensitivity: number;
}

export interface RiskScore {
  overall: number;
  level: RiskLevel;
  breakdown: RiskBreakdown;
  reasons: string[];
}

export interface RewriteSuggestion {
  kind: "rewrite";
  title: string;
  detail?: string;
}

export interface SplitSuggestion {
  kind: "split";
  title: string;
  detail?: string;
}

export interface ModelAdvice {
  tier: ModelTier;
  reasons: string[];
}

export interface AnalyzeInput {
  /**
   * Query and its origin.
   */
  query: QraQueryInput;
  /**
   * Optional analysis options overriding defaults.
   */
  options?: QraAnalysisOptions;
}

export interface AnalyzeReport {
  /**
   * Original query input.
   */
  input: QraQueryInput;
  /**
   * Final options used for this analysis.
   */
  options: QraAnalysisOptions;
  /**
   * Workspace root used for indexing (alias of input.cwd).
   */
  workspaceRoot?: string;
  /**
   * Context window limit used when computing context risk.
   */
  contextLimit: number;
  /**
   * Static configuration used by QRA.
   */
  config: QraConfig;
  /**
   * Extracted query features (vague, multi-step, multi-module, sensitive, repo-wide).
   */
  queryFeatures: QueryFeatureSummary;
  /**
   * Heuristically indexed repository files.
   */
  index: QraFileIndexEntry[];
  /**
   * Ranked subset of relevant files.
   */
  relevantFiles: RelevantFile[];
  /**
   * Approximate token usage for query and relevant files.
   */
  tokenEstimate: TokenEstimate;
  /**
   * Context window usage and headroom.
   */
  contextRisk: ContextRisk;
  /**
   * Overall risk score and breakdown.
   */
  risk: RiskScore;
  /**
   * Recommended model tier for this query.
   */
  model: ModelAdvice;
  /**
   * Single best next step for the developer to take.
   */
  nextAction: string;
  /**
   * Deterministic prompt rewrite that can be copied and used directly.
   */
  refinedPrompt: string;
  /**
   * Deterministic rewrite suggestions.
   */
  rewrites: RewriteSuggestion[];
  /**
   * Deterministic split suggestions.
   */
  splits: SplitSuggestion[];
  /**
   * High-level confidence assessment.
   */
  confidence: {
    level: ConfidenceLevel;
    reasons: string[];
  };
  /**
   * Flattened list of human-readable reasons for the overall analysis.
   */
  reasons: string[];
  /**
   * Short human-readable summary.
   */
  summary: string;
}

