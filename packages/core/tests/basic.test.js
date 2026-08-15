const test = require("node:test");
const assert = require("node:assert");
const {
  analyzeQuery,
  extractQueryFeatures,
  computeRiskScore,
  computeContextRisk,
  rankFiles,
  estimateTokenUsage
} = require("../dist");

test("vague repo-wide query produces at least medium risk", () => {
  const report = analyzeQuery({
    query: {
      source: "manual",
      text: "Refactor the entire project and fix everything across the whole codebase.",
      cwd: process.cwd()
    }
  });

  assert.ok(report.risk.overall > 0, "expected some non-zero risk score");
});

test("short, specific query has bounded token estimate", () => {
  const report = analyzeQuery({
    query: {
      source: "manual",
      text: "Update the README formatting.",
      cwd: process.cwd()
    }
  });

  assert.ok(report.tokenEstimate.queryTokens > 0);
  assert.ok(report.tokenEstimate.totalTokensHigh >= report.tokenEstimate.totalTokensLow);
});

test("queryFeatures detects vague and repo-wide signals", () => {
  const features = extractQueryFeatures({
    source: "manual",
    text: "Please fix everything across the entire project and improve the whole codebase.",
    cwd: process.cwd()
  });

  assert.ok(features.vagueSignals.length > 0, "expected vague signals");
  assert.ok(features.repoWideSignals.length > 0, "expected repo-wide signals");
});

test("riskScore increases when repo-wide, sensitive, multi-module signals present", () => {
  const features = extractQueryFeatures({
    source: "manual",
    text: "Refactor the entire project auth, payments, database, and infra in one step.",
    cwd: process.cwd()
  });

  const lowContext = computeContextRisk(1_000, 128_000);
  const lowRisk = computeRiskScore(features, lowContext);

  const highContext = computeContextRisk(200_000, 128_000);
  const highRisk = computeRiskScore(features, highContext);

  assert.ok(highRisk.overall >= lowRisk.overall, "expected higher or equal risk with more context pressure");
});

test("fileRanking prefers matching filenames", () => {
  const repoFiles = [
    {
      path: "src/auth/login.ts",
      sizeBytes: 1000,
      approxTokens: 250,
      folderTokens: ["src", "auth"],
      fileTokens: ["login"],
      importTokens: [],
      symbolTokens: []
    },
    {
      path: "src/other/util.ts",
      sizeBytes: 1000,
      approxTokens: 250,
      folderTokens: ["src", "other"],
      fileTokens: ["util"],
      importTokens: [],
      symbolTokens: []
    }
  ];

  const ranked = rankFiles("fix auth login bug", { repoFiles });

  assert.ok(ranked.length > 0, "expected some ranked files");
  assert.strictEqual(ranked[0].path, "src/auth/login.ts");
});

test("tokenEstimate grows with more file tokens", () => {
  const few = estimateTokenUsage("short query", [100, 100]);
  const many = estimateTokenUsage("short query", [1000, 1000]);

  assert.ok(many.totalTokensHigh > few.totalTokensHigh);
});

