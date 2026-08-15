#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { analyzeQuery, buildRepoIndex } from "@qra/core";
import type { AnalyzeInput, AnalyzeReport, PromptIntent } from "@qra/core";
import { formatCompactCount, formatTokenCount, formatTokenRange } from "@qra/core";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  green: "\u001b[32m",
  cyan: "\u001b[36m",
  magenta: "\u001b[35m",
  gray: "\u001b[90m"
} as const;

type ColorMode = "auto" | "always" | "never";

let colorMode: ColorMode = "auto";

function setColorMode(mode: ColorMode): void {
  colorMode = mode;
}

function shouldUseColor(): boolean {
  if (colorMode === "always") {
    return true;
  }
  if (colorMode === "never") {
    return false;
  }

  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") {
    return true;
  }
  if (process.env.NO_COLOR) {
    return false;
  }
  return Boolean(process.stdout.isTTY);
}

function paint(text: string, code: string): string {
  return shouldUseColor() ? `${code}${text}${ANSI.reset}` : text;
}

function bold(text: string): string {
  return paint(text, ANSI.bold);
}

function dim(text: string): string {
  return paint(text, ANSI.dim);
}

function colorRisk(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "low":
      return paint(level.toUpperCase(), ANSI.green);
    case "medium":
      return paint(level.toUpperCase(), ANSI.yellow);
    case "high":
      return paint(level.toUpperCase(), ANSI.red);
  }
}

function colorModelTier(tier: "cheap" | "balanced" | "strong"): string {
  switch (tier) {
    case "cheap":
      return paint(tier.toUpperCase(), ANSI.green);
    case "balanced":
      return paint(tier.toUpperCase(), ANSI.yellow);
    case "strong":
      return paint(tier.toUpperCase(), ANSI.red);
  }
}

function colorIntent(intent: PromptIntent): string {
  switch (intent) {
    case "code-change":
      return paint(intent, ANSI.cyan);
    case "repo-survey":
      return paint(intent, ANSI.magenta);
    case "out-of-scope":
      return paint(intent, ANSI.gray);
  }
}

function getVersion(): string {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      "Query Risk & Scope Analyzer (QRA) CLI",
      "",
      "Usage:",
      "  qra analyze \"<query>\"",
      "  qra analyze --file path/to/prompt.txt",
      "  qra analyze --json \"<query>\"",
      "  qra index",
      "",
      "Options:",
      "  --file <path>   Read query text from a file.",
      "  --json          Print full analysis as JSON.",
      "  --verbose, -V   Print the full human-readable report.",
      "  --color         Force color output.",
      "  --no-color      Disable color output.",
      "  --help, -h      Show this help message.",
      "  --version, -v   Print the CLI version.",
      "",
      "Examples:",
      "  qra analyze \"Refactor the auth and billing flows\"",
      "  qra analyze --file prompt.txt",
      "  qra analyze --color \"Refactor the auth and billing flows\"",
      "  qra analyze --verbose \"Refactor the auth and billing flows\"",
      "  qra analyze --json \"Refactor the auth and billing flows\"",
      "  qra index",
      ""
    ].join("\n")
  );
}

interface AnalyzeCliArgs {
  queryText?: string;
  filePath?: string;
  json: boolean;
  verbose: boolean;
  colorMode: ColorMode;
  invalidFlag?: string;
  missingFilePath?: boolean;
}

function parseAnalyzeArgs(args: string[]): AnalyzeCliArgs {
  let queryText: string | undefined;
  let filePath: string | undefined;
  let json = false;
  let verbose = false;
  let colorMode: ColorMode = "auto";
  let invalidFlag: string | undefined;
  let missingFilePath = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--verbose" || arg === "-V") {
      verbose = true;
    } else if (arg === "--color") {
      colorMode = "always";
    } else if (arg === "--no-color") {
      colorMode = "never";
    } else if (arg === "--file") {
      filePath = args[i + 1];
      if (!filePath || filePath.startsWith("-")) {
        missingFilePath = true;
        filePath = undefined;
      }
      i += 1;
    } else if (arg.startsWith("-")) {
      invalidFlag = arg;
    } else if (!queryText && !arg.startsWith("-")) {
      queryText = arg;
    }
  }

  return { queryText, filePath, json, verbose, colorMode, invalidFlag, missingFilePath };
}

function loadQueryTextFromFile(filePath: string): string {
  const abs = path.resolve(process.cwd(), filePath);
  try {
    return fs.readFileSync(abs, "utf8");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to read file: ${abs}`);
    if (error instanceof Error) {
      // eslint-disable-next-line no-console
      console.error(error.message);
    }
    process.exitCode = 1;
    return "";
  }
}

function formatReasons(reasons: string[]): string {
  return reasons.length > 0 ? reasons.slice(0, 3).join(" | ") : "None";
}

function indentBlock(text: string, indent = "  "): string {
  return text
    .split(/\r?\n/)
    .map((line) => `${indent}${line}`)
    .join("\n");
}

function printFiles(files: AnalyzeReport["relevantFiles"], limit = 5): void {
  if (files.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`  ${dim("No strong file matches yet.")}`);
    return;
  }

  for (const file of files.slice(0, limit)) {
    const reasons = file.reasons.slice(0, 2).join(" | ");
    // eslint-disable-next-line no-console
    console.log(
      `  - ${paint(file.path, ANSI.cyan)} ${dim(`(score ${file.score}, ~${formatCompactCount(file.approxTokens)} tokens)`)}${reasons ? ` ${dim(`- ${reasons}`)}` : ""}`
    );
  }
}

function printVerboseDetails(report: AnalyzeReport): void {
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(`${bold("Summary:")} ${report.summary}`);
  // eslint-disable-next-line no-console
  console.log("");

  // eslint-disable-next-line no-console
  console.log(`${bold("Risk:")} ${colorRisk(report.risk.level)} ${dim(`(${report.risk.overall}/100)`)}`);
  // eslint-disable-next-line no-console
  console.log(`  ${dim("Reasons:")} ${report.risk.reasons.length > 0 ? report.risk.reasons.slice(0, 3).join(" | ") : "None"}`);
  // eslint-disable-next-line no-console
  console.log(`${bold("Tokens:")} query ~${formatTokenCount(report.tokenEstimate.queryTokens)}`);
  // eslint-disable-next-line no-console
  console.log(
    `  ${dim("files")} ${formatTokenRange(report.tokenEstimate.fileTokensLow, report.tokenEstimate.fileTokensHigh)}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  ${dim("total")} ${formatTokenRange(report.tokenEstimate.totalTokensLow, report.tokenEstimate.totalTokensHigh)}`
  );
  // eslint-disable-next-line no-console
  console.log(`${bold("Context risk:")} ${colorRisk(report.contextRisk.level)} ` + dim(`against ~${formatCompactCount(report.contextRisk.contextWindowTokens)} token window`));
  // eslint-disable-next-line no-console
  console.log(`  ${dim("headroom:")} ${formatCompactCount(report.contextRisk.headroomTokens)} tokens`);

  // eslint-disable-next-line no-console
  console.log(`${bold("Model tier:")} ${colorModelTier(report.model.tier)}`);
  if (report.model.reasons.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`  ${dim("Reasons:")} ${report.model.reasons.slice(0, 3).join(" | ")}`);
  }

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(bold("Rewrite suggestions:"));
  if (report.rewrites.length > 0) {
    for (const s of report.rewrites.slice(0, 3)) {
      // eslint-disable-next-line no-console
      console.log(`  - ${s.title}`);
      if (s.detail) {
        // eslint-disable-next-line no-console
        console.log(`      ${s.detail}`);
      }
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(`  ${dim("None.")}`);
  }

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(bold("Split suggestions:"));
  if (report.splits.length > 0) {
    for (const s of report.splits.slice(0, 3)) {
      // eslint-disable-next-line no-console
      console.log(`  - ${s.title}`);
      if (s.detail) {
        // eslint-disable-next-line no-console
        console.log(`      ${s.detail}`);
      }
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(`  ${dim("None.")}`);
  }

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(`${bold("Confidence:")} ${colorRisk(report.confidence.level)}`);
  // eslint-disable-next-line no-console
  console.log(`  ${dim("Reasons:")} ${report.confidence.reasons.length > 0 ? report.confidence.reasons.join(" | ") : "None"}`);
  // eslint-disable-next-line no-console
  console.log("");
}

function printHumanReadable(report: AnalyzeReport, verbose = false): void {
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log("=== Query Risk & Scope Analyzer (QRA) ===");
  // eslint-disable-next-line no-console
  console.log(`${bold("Query:")} ${report.input.text}`);
  // eslint-disable-next-line no-console
  console.log("");

  // eslint-disable-next-line no-console
  console.log(`${bold("Verdict:")} ${colorRisk(report.risk.level)} ${dim(`risk (${report.risk.overall}/100)`)}`);
  // eslint-disable-next-line no-console
  console.log(`${bold("Intent:")} ${colorIntent(report.queryFeatures.intent)}`);
  // eslint-disable-next-line no-console
  console.log("");

  // eslint-disable-next-line no-console
  console.log(`${bold("Next action:")} ${report.nextAction}`);
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(bold("Refined prompt:"));
  // eslint-disable-next-line no-console
  console.log(indentBlock(report.refinedPrompt));
  // eslint-disable-next-line no-console
  console.log("");

  // eslint-disable-next-line no-console
  console.log(bold("Top files:"));
  printFiles(report.relevantFiles, 5);

  if (verbose) {
    printVerboseDetails(report);
  }
}

function runAnalyze(
  queryText: string,
  source: "manual" | "file",
  json: boolean,
  verbose: boolean
): void {
  const input: AnalyzeInput = {
    query: {
      source,
      text: queryText,
      cwd: process.cwd()
    },
    options: {
      contextWindowTokens: 128_000,
      includeFileRanking: true,
      includeTokenEstimate: true,
      includeRiskScore: true,
      includeSuggestions: true
    }
  };

  const report: AnalyzeReport = analyzeQuery(input);

  if (json) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printHumanReadable(report, verbose);
}

function printIndexSummary(): void {
  const index = buildRepoIndex({ cwd: process.cwd() });
  const fileCount = index.files.length;
  const totalTokens = index.files.reduce((sum, file) => sum + file.approxTokens, 0);

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(bold("=== QRA Repo Index ==="));
  // eslint-disable-next-line no-console
  console.log(`${bold("Workspace:")} ${process.cwd()}`);
  // eslint-disable-next-line no-console
  console.log(`${bold("Indexed files:")} ${fileCount}`);
  // eslint-disable-next-line no-console
  console.log(`${bold("Approx tokens in indexed files:")} ~${formatCompactCount(totalTokens)}`);
  // eslint-disable-next-line no-console
  console.log("");
}

async function main(argv: string[]): Promise<void> {
  const [, , command, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    // eslint-disable-next-line no-console
    console.log(`qra v${getVersion()}`);
    return;
  }

  if (command === "index") {
    if (rest.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`Unknown option(s) for qra index: ${rest.join(" ")}`);
      printHelp();
      process.exitCode = 1;
      return;
    }

    printIndexSummary();
    return;
  }

  if (command !== "analyze") {
    // eslint-disable-next-line no-console
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (rest.includes("--help") || rest.includes("-h")) {
    printHelp();
    return;
  }

  const { queryText, filePath, json, verbose, colorMode, invalidFlag, missingFilePath } = parseAnalyzeArgs(rest);

  if (invalidFlag) {
    // eslint-disable-next-line no-console
    console.error(`Unknown option: ${invalidFlag}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (missingFilePath) {
    // eslint-disable-next-line no-console
    console.error("Missing file path after --file.");
    printHelp();
    process.exitCode = 1;
    return;
  }

  setColorMode(colorMode);

  let text = queryText;

  if (filePath) {
    if (queryText) {
      // eslint-disable-next-line no-console
      console.error("Pass either a query string or --file, not both.");
      process.exitCode = 1;
      return;
    }
    text = loadQueryTextFromFile(filePath);
  }

  if (!text || !text.trim()) {
    // eslint-disable-next-line no-console
    console.error(
      "No query text provided. Pass a string or use --file <path>."
    );
    printHelp();
    process.exitCode = 1;
    return;
  }

  runAnalyze(text, filePath ? "file" : "manual", json, verbose);
}

void main(process.argv);

