import type { QraQueryInput } from "./types";

export interface QueryFeatureSummary {
  length: number;
  lineCount: number;
  wordCount: number;
  isVeryShort: boolean;
  isVeryLong: boolean;
  vagueSignals: string[];
  multiStepSignals: string[];
  multiModuleSignals: string[];
  sensitiveSignals: string[];
  repoWideSignals: string[];
}

const VAGUE_PATTERNS = [
  "fix everything",
  "clean up code",
  "optimize the whole project",
  "refactor the app",
  "improve the codebase",
  "all files",
  "entire project",
  "whole codebase",
  "repo-wide"
];

const MULTI_STEP_PATTERNS = [
  "first",
  "then",
  "next",
  "after that",
  "finally",
  "step 1",
  "step 2"
];

const MULTI_MODULE_TOKENS = [
  "frontend",
  "backend",
  "api",
  "auth",
  "payments",
  "billing",
  "database",
  "db",
  "schema",
  "migrations",
  "deployment",
  "deploy",
  "tests",
  "ci",
  "cd"
];

const SENSITIVE_TOKENS = [
  "auth",
  "authentication",
  "authorization",
  "oauth",
  "jwt",
  "payment",
  "payments",
  "billing",
  "stripe",
  "paypal",
  "secret",
  "secrets",
  "token",
  "access key",
  "api key",
  "prod",
  "production",
  "database",
  "schema",
  "migration",
  "migrations",
  "infra",
  "infrastructure",
  "kubernetes",
  "terraform"
];

const REPO_WIDE_PATTERNS = [
  "entire project",
  "whole project",
  "whole codebase",
  "all files",
  "every file",
  "repo-wide",
  "across the codebase"
];

function collectMatches(textLower: string, patterns: string[]): string[] {
  const hits: string[] = [];
  for (const pattern of patterns) {
    if (textLower.includes(pattern)) {
      hits.push(pattern);
    }
  }
  return hits;
}

export function extractQueryFeatures(input: QraQueryInput): QueryFeatureSummary {
  const text = input.text;
  const textLower = text.toLowerCase();
  const length = text.length;
  const lineCount = text.split(/\r?\n/).length;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const vagueSignals = collectMatches(textLower, VAGUE_PATTERNS);
  const multiStepSignals = collectMatches(textLower, MULTI_STEP_PATTERNS);
  const multiModuleSignals = collectMatches(textLower, MULTI_MODULE_TOKENS);
  const sensitiveSignals = collectMatches(textLower, SENSITIVE_TOKENS);
  const repoWideSignals = collectMatches(textLower, REPO_WIDE_PATTERNS);

  const isVeryShort = wordCount < 5;
  const isVeryLong = wordCount > 400;

  return {
    length,
    lineCount,
    wordCount,
    isVeryShort,
    isVeryLong,
    vagueSignals,
    multiStepSignals,
    multiModuleSignals,
    sensitiveSignals,
    repoWideSignals
  };
}

