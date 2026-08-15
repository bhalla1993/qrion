#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { analyzeQuery, buildRepoIndex } from "@qra/core";
import type { AnalyzeInput, AnalyzeReport } from "@qra/core";
import { formatCompactCount, formatTokenCount, formatTokenRange } from "@qra/core";

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
      "  --help, -h      Show this help message.",
      "  --version, -v   Print the CLI version.",
      "",
      "Examples:",
      "  qra analyze \"Refactor the auth and billing flows\"",
      "  qra analyze --file prompt.txt",
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
  invalidFlag?: string;
  missingFilePath?: boolean;
}

function parseAnalyzeArgs(args: string[]): AnalyzeCliArgs {
  let queryText: string | undefined;
  let filePath: string | undefined;
  let json = false;
  let invalidFlag: string | undefined;
  let missingFilePath = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") {
      json = true;
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

  return { queryText, filePath, json, invalidFlag, missingFilePath };
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

function printHumanReadable(report: AnalyzeReport): void {
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log("=== Query Risk & Scope Analyzer (QRA) ===");
  // eslint-disable-next-line no-console
  console.log(`Query: ${report.input.text}`);
  // eslint-disable-next-line no-console
  console.log("");

  // eslint-disable-next-line no-console
  console.log(`Summary: ${report.summary}`);
  // eslint-disable-next-line no-console
  console.log("");

  // eslint-disable-next-line no-console
  console.log(`Next action: ${report.nextAction}`);
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log("Refined prompt:");
  // eslint-disable-next-line no-console
  console.log(indentBlock(report.refinedPrompt));
  // eslint-disable-next-line no-console
  console.log("");

  // eslint-disable-next-line no-console
  console.log(`Risk: ${report.risk.level.toUpperCase()} (${report.risk.overall}/100)`);
  // eslint-disable-next-line no-console
  console.log(`  Reasons: ${formatReasons(report.risk.reasons)}`);
  // eslint-disable-next-line no-console
  console.log(`Tokens: query ~${formatTokenCount(report.tokenEstimate.queryTokens)}`);
  // eslint-disable-next-line no-console
  console.log(
    `  files ${formatTokenRange(report.tokenEstimate.fileTokensLow, report.tokenEstimate.fileTokensHigh)}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  total ${formatTokenRange(report.tokenEstimate.totalTokensLow, report.tokenEstimate.totalTokensHigh)}`
  );
  // eslint-disable-next-line no-console
  console.log(`Context risk: ${report.contextRisk.level.toUpperCase()}`);
  // eslint-disable-next-line no-console
  console.log(
    `  limit ~${formatCompactCount(report.contextRisk.contextWindowTokens)} tokens, headroom ~${formatCompactCount(report.contextRisk.headroomTokens)}`
  );

  // eslint-disable-next-line no-console
  console.log(`Model tier: ${report.model.tier.toUpperCase()}`);
  if (report.model.reasons.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`  Reasons: ${formatReasons(report.model.reasons)}`);
  }

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log("Relevant files:");
  if (report.relevantFiles.length > 0) {
    for (const file of report.relevantFiles.slice(0, 10)) {
      const reasons = file.reasons.slice(0, 2).join(" | ");
      // eslint-disable-next-line no-console
      console.log(
        `  - ${file.path} (score ${file.score}, ~${file.approxTokens} tokens)${reasons ? ` – ${reasons}` : ""}`
      );
    }
  } else {
    // eslint-disable-next-line no-console
    console.log("  No strongly relevant files detected.");
  }

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log("Rewrite suggestions:");
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
    console.log("  None.");
  }

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log("Split suggestions:");
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
    console.log("  None.");
  }

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(`Confidence: ${report.confidence.level.toUpperCase()}`);
  // eslint-disable-next-line no-console
  console.log(`  Reasons: ${formatReasons(report.confidence.reasons)}`);
  // eslint-disable-next-line no-console
  console.log("");
}

function runAnalyze(queryText: string, source: "manual" | "file", json: boolean): void {
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

  printHumanReadable(report);
}

function printIndexSummary(): void {
  const index = buildRepoIndex({ cwd: process.cwd() });
  const fileCount = index.files.length;
  const totalTokens = index.files.reduce((sum, file) => sum + file.approxTokens, 0);

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log("=== QRA Repo Index ===");
  // eslint-disable-next-line no-console
  console.log(`Workspace: ${process.cwd()}`);
  // eslint-disable-next-line no-console
  console.log(`Indexed files: ${fileCount}`);
  // eslint-disable-next-line no-console
  console.log(`Approx tokens in indexed files: ~${formatCompactCount(totalTokens)}`);
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

  const { queryText, filePath, json, invalidFlag, missingFilePath } = parseAnalyzeArgs(rest);

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

  runAnalyze(text, filePath ? "file" : "manual", json);
}

void main(process.argv);

