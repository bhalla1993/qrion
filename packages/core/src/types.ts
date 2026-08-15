export type QraQuerySource = "selection" | "clipboard" | "manual" | "file";

export type RiskLevel = "low" | "medium" | "high";

export type ConfidenceLevel = "low" | "medium" | "high";

export type ModelTier = "cheap" | "balanced" | "strong";

export interface QraQueryInput {
  source: QraQuerySource;
  text: string;
  /**
   * Optional language identifier, e.g. from an editor.
   */
  languageId?: string;
  /**
   * Working directory used for repo indexing.
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
  query: QraQueryInput;
  options?: QraAnalysisOptions;
}

export interface AnalyzeReport {
  input: QraQueryInput;
  options: QraAnalysisOptions;
  /**
   * Heuristically indexed repository files.
   */
  index: QraFileIndexEntry[];
  /**
   * Ranked subset of relevant files.
   */
  relevantFiles: RelevantFile[];
  tokenEstimate: TokenEstimate;
  contextRisk: ContextRisk;
  risk: RiskScore;
  model: ModelAdvice;
  rewrites: RewriteSuggestion[];
  splits: SplitSuggestion[];
  confidence: {
    level: ConfidenceLevel;
    reasons: string[];
  };
  summary: string;
}

