const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert");
const {
  analyzeQuery,
  extractQueryFeatures,
  computeRiskScore,
  computeContextRisk,
  rankFiles,
  estimateTokenUsage,
  buildRepoIndex
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
  assert.notStrictEqual(
    report.risk.level,
    "low",
    "expected a vague, repo-wide query to escape the LOW risk bucket"
  );
});

test("query stacking repo-wide, vague, multi-step, multi-module, and sensitive signals reaches HIGH risk", () => {
  const report = analyzeQuery({
    query: {
      source: "manual",
      text:
        "Please fix everything across the entire project. First refactor the whole " +
        "codebase, then touch auth, payments, billing, database, schema, migrations, " +
        "infra, kubernetes, terraform, secrets, api key, and production deployment, " +
        "across frontend, backend, api, ci, and cd, in one massive change touching all files.",
      cwd: process.cwd()
    }
  });

  assert.strictEqual(
    report.risk.level,
    "high",
    `expected worst-case query to score HIGH risk, got ${report.risk.level} (${report.risk.overall})`
  );
  assert.match(report.nextAction, /rewrite before sending/i);
  assert.match(report.refinedPrompt, /Please help with the following task\./);
  assert.match(report.refinedPrompt, /Guidance:/);
  assert.match(report.refinedPrompt, /Return:/);
});

test("short, narrow, unambiguous query stays LOW risk", () => {
  const report = analyzeQuery({
    query: {
      source: "manual",
      text: "Update the README formatting to fix a broken markdown table in the intro section.",
      cwd: process.cwd()
    }
  });

  assert.strictEqual(report.risk.level, "low");
  assert.match(report.nextAction, /send as-is/i);
  assert.match(report.refinedPrompt, /Keep the change focused/);
});

test("repo-survey prompt gets repo-understanding guidance", () => {
  const report = analyzeQuery({
    query: {
      source: "manual",
      text: "Read through the repo and tell me the purpose of the repo and what has been implemented so far and what left",
      cwd: process.cwd()
    }
  });

  assert.strictEqual(report.queryFeatures.intent, "repo-survey");
  assert.match(report.nextAction, /repository understanding task/i);
  assert.match(report.refinedPrompt, /inspect this repository and summarize/i);
  assert.match(report.refinedPrompt, /purpose of the repo/i);
  assert.match(report.refinedPrompt, /remaining gaps/i);
  assert.deepStrictEqual(report.rewrites, []);
  assert.deepStrictEqual(report.splits, []);
});

test("general chat prompt is marked out of scope", () => {
  const report = analyzeQuery({
    query: {
      source: "manual",
      text: "Hi, how are you doing?",
      cwd: process.cwd()
    }
  });

  assert.strictEqual(report.queryFeatures.intent, "out-of-scope");
  assert.match(report.nextAction, /outside Qrion's scope/i);
  assert.match(report.refinedPrompt, /Qrion is for code-change and repository understanding prompts/i);
  assert.deepStrictEqual(report.rewrites, []);
  assert.deepStrictEqual(report.splits, []);
});

test("repo-survey prompt seeds the repo map in a fresh workspace", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qra-survey-test-"));

  try {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "survey-test", private: true }, null, 2)
    );
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Survey test");
    fs.writeFileSync(path.join(tmpDir, "MVP1.md"), "MVP1 checklist");
    fs.mkdirSync(path.join(tmpDir, "packages", "core", "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "packages", "core", "src", "index.ts"),
      "export const core = true;"
    );
    fs.mkdirSync(path.join(tmpDir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "docs", "index.html"), "<!doctype html>");

    const report = analyzeQuery({
      query: {
        source: "manual",
        text: "Read through the repo and tell me the purpose of the repo and what has been implemented so far and what left",
        cwd: tmpDir
      }
    });

    const paths = report.relevantFiles.map((file) => file.path);

    assert.ok(paths.includes("README.md"), "expected README.md to be surfaced");
    assert.ok(paths.includes("package.json"), "expected package.json to be surfaced");
    assert.ok(paths.includes("MVP1.md"), "expected MVP1.md to be surfaced");
    assert.ok(
      paths.includes(path.join("packages", "core", "src", "index.ts")),
      "expected core package entry point to be surfaced"
    );
    assert.ok(paths.includes(path.join("docs", "index.html")), "expected docs index to be surfaced");
    assert.match(report.summary, /Likely relevant files: [1-9]/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
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

test(".qraignore excludes matching directories and file extensions from the repo index", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qra-ignore-test-"));

  try {
    fs.writeFileSync(
      path.join(tmpDir, ".qraignore"),
      ["generated", "*.gen.ts", "# a comment", ""].join("\n")
    );

    fs.mkdirSync(path.join(tmpDir, "generated"));
    fs.writeFileSync(path.join(tmpDir, "generated", "should-be-ignored.ts"), "export const x = 1;");

    fs.writeFileSync(path.join(tmpDir, "kept.ts"), "export const y = 2;");
    fs.writeFileSync(path.join(tmpDir, "types.gen.ts"), "export const z = 3;");

    const { files } = buildRepoIndex({ cwd: tmpDir });
    const paths = files.map((f) => f.path);

    assert.ok(paths.includes("kept.ts"), "expected non-ignored file to be indexed");
    assert.ok(
      !paths.some((p) => p.includes("generated")),
      "expected .qraignore directory rule to exclude the folder"
    );
    assert.ok(
      !paths.includes("types.gen.ts"),
      "expected .qraignore extension-style rule to exclude matching files"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("repo index ignores common tool cache directories", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qra-cache-test-"));

  try {
    fs.mkdirSync(path.join(tmpDir, ".pytest_cache"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".pytest_cache", "README.md"), "# Cache noise");
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Real repo README");

    const { files } = buildRepoIndex({ cwd: tmpDir });
    const paths = files.map((f) => f.path);

    assert.ok(paths.includes("README.md"), "expected the real README to be indexed");
    assert.ok(
      !paths.some((p) => p.startsWith(".pytest_cache")),
      "expected pytest cache files to be ignored"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

