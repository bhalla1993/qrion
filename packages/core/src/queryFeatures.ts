import type { QraQueryInput } from "./types";

export type PromptIntent = "code-change" | "repo-survey" | "out-of-scope";

export interface QueryFeatureSummary {
  length: number;
  lineCount: number;
  wordCount: number;
  isVeryShort: boolean;
  isVeryLong: boolean;
  intent: PromptIntent;
  intentReasons: string[];
  vagueSignals: string[];
  multiStepSignals: string[];
  multiModuleSignals: string[];
  sensitiveSignals: string[];
  repoWideSignals: string[];
  codeActionSignals: string[];
  codeShapeSignals: string[];
  repoSurveySignals: string[];
  outOfScopeSignals: string[];
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

const CODE_ACTION_PATTERNS = [
  "fix",
  "update",
  "add",
  "implement",
  "refactor",
  "debug",
  "rename",
  "remove",
  "replace",
  "improve",
  "clean up",
  "optimize",
  "migrate",
  "test",
  "create",
  "patch",
  "adjust",
  "convert",
  "split",
  "merge",
  "document"
];

const REPO_SURVEY_PATTERNS = [
  "what is this repo",
  "what is the purpose",
  "what's the purpose",
  "what has been implemented",
  "what is implemented",
  "what remains",
  "what is left",
  "repo overview",
  "read through the repo",
  "walk me through this repo",
  "repo tour",
  "summarize the repo",
  "summarize this repo",
  "implemented so far",
  "what do i have here",
  "what should i read first",
  "what should i look at",
  "where is",
  "how does this repo work",
  "architecture"
];

type RegexSignalPattern = {
  pattern: RegExp;
  label: string;
};

const CODE_SHAPE_PATTERNS: RegexSignalPattern[] = [
  { pattern: /```[\s\S]*?```/, label: "code block" },
  { pattern: /\b[A-Za-z0-9_./-]+\.(ts|tsx|js|jsx|md|json|yml|yaml|py|go|rs)\b/i, label: "file name" },
  { pattern: /\b(src|lib|app|components|pages|packages)\//i, label: "path" },
  { pattern: /\bError:\b|\bTypeError:\b|\bReferenceError:\b|\bSyntaxError:\b/i, label: "error text" },
  { pattern: /^\s+at\s+/m, label: "stack trace" }
];

const OUT_OF_SCOPE_PATTERNS: RegexSignalPattern[] = [
  { pattern: /\bhi\b/i, label: "hi" },
  { pattern: /\bhello\b/i, label: "hello" },
  { pattern: /\bhey\b/i, label: "hey" },
  { pattern: /\bhow are you\b/i, label: "how are you" },
  { pattern: /\bhow's it going\b/i, label: "how's it going" },
  { pattern: /\bwhat'?s up\b/i, label: "what's up" },
  { pattern: /\bgood morning\b/i, label: "good morning" },
  { pattern: /\bgood afternoon\b/i, label: "good afternoon" },
  { pattern: /\bgood evening\b/i, label: "good evening" },
  { pattern: /\bwho are you\b/i, label: "who are you" },
  { pattern: /\bthank you\b/i, label: "thank you" },
  { pattern: /\bthanks\b/i, label: "thanks" },
  { pattern: /\btell me a joke\b/i, label: "tell me a joke" }
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

function collectRegexMatches(text: string, patterns: RegexSignalPattern[]): string[] {
  const hits: string[] = [];
  for (const { pattern, label } of patterns) {
    if (pattern.test(text)) {
      hits.push(label);
    }
  }
  return hits;
}

function uniqueSignals(signals: string[]): string[] {
  return Array.from(new Set(signals));
}

function formatSignalList(signals: string[], fallback: string): string {
  if (signals.length === 0) {
    return fallback;
  }
  if (signals.length === 1) {
    return signals[0];
  }
  if (signals.length === 2) {
    return `${signals[0]} and ${signals[1]}`;
  }
  return `${signals.slice(0, 2).join(", ")}, and more`;
}

function buildIntentReasons(params: {
  intent: PromptIntent;
  codeActionSignals: string[];
  codeShapeSignals: string[];
  repoSurveySignals: string[];
  outOfScopeSignals: string[];
  repoWideSignals: string[];
  vagueSignals: string[];
  multiModuleSignals: string[];
  sensitiveSignals: string[];
}): string[] {
  const {
    intent,
    codeActionSignals,
    codeShapeSignals,
    repoSurveySignals,
    outOfScopeSignals,
    repoWideSignals,
    vagueSignals,
    multiModuleSignals,
    sensitiveSignals
  } = params;

  if (intent === "repo-survey") {
    const signals = uniqueSignals([...repoSurveySignals, ...repoWideSignals]);
    return [`Matched repo-overview cues: ${formatSignalList(signals, "repo-overview language")}`];
  }

  if (intent === "out-of-scope") {
    return [`Matched conversational cues: ${formatSignalList(outOfScopeSignals, "small talk or general chat")}`];
  }

  const cues = uniqueSignals([
    ...codeActionSignals.slice(0, 3),
    ...codeShapeSignals.slice(0, 3),
    ...vagueSignals.slice(0, 2),
    ...multiModuleSignals.slice(0, 2),
    ...sensitiveSignals.slice(0, 2)
  ]);

  if (cues.length > 0) {
    return [`Matched code-change cues: ${formatSignalList(cues, "change-oriented language")}`];
  }

  return ["No repo-overview or conversational cues matched; defaulted to code-change."];
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
  const codeActionSignals = collectMatches(textLower, CODE_ACTION_PATTERNS);
  const repoSurveySignals = collectMatches(textLower, REPO_SURVEY_PATTERNS);
  const codeShapeSignals = collectRegexMatches(text, CODE_SHAPE_PATTERNS);
  const outOfScopeSignals = collectRegexMatches(text, OUT_OF_SCOPE_PATTERNS);

  const isVeryShort = wordCount < 5;
  const isVeryLong = wordCount > 400;

  const codeScore =
    codeActionSignals.length * 2 +
    codeShapeSignals.length * 3 +
    vagueSignals.length +
    multiStepSignals.length +
    multiModuleSignals.length +
    sensitiveSignals.length +
    repoWideSignals.length;

  const repoSurveyScore = repoSurveySignals.length * 4 + (repoWideSignals.length > 0 ? 1 : 0);
  const outOfScopeScore = outOfScopeSignals.length * 4;

  const intent: PromptIntent =
    repoSurveyScore > 0 && repoSurveyScore >= codeScore && repoSurveyScore >= outOfScopeScore
      ? "repo-survey"
      : outOfScopeScore > 0 && codeScore === 0 && repoSurveyScore === 0
        ? "out-of-scope"
        : "code-change";

  const intentReasons = buildIntentReasons({
    intent,
    codeActionSignals,
    codeShapeSignals,
    repoSurveySignals,
    outOfScopeSignals,
    repoWideSignals,
    vagueSignals,
    multiModuleSignals,
    sensitiveSignals
  });

  return {
    length,
    lineCount,
    wordCount,
    isVeryShort,
    isVeryLong,
    intent,
    intentReasons,
    vagueSignals,
    multiStepSignals,
    multiModuleSignals,
    sensitiveSignals,
    repoWideSignals,
    codeActionSignals,
    codeShapeSignals,
    repoSurveySignals,
    outOfScopeSignals
  };
}
