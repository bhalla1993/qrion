const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const CLI_PATH = path.join(__dirname, "..", "dist", "cli.js");

function runCli(args, options = {}) {
  if (!fs.existsSync(CLI_PATH)) {
    throw new Error(
      `Missing built CLI at ${CLI_PATH}. Run \`npm run build\` before \`npm test\`.`
    );
  }

  return execFileSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf8",
    cwd: path.join(__dirname, ".."),
    ...options
  });
}

test("prints the CLI version", () => {
  const output = runCli(["--version"]).trim();

  assert.match(output, /^qra v\d+\.\d+\.\d+$/);
});

test("shows help for analyze", () => {
  const output = runCli(["analyze", "--help"]);

  assert.match(output, /Query Risk & Scope Analyzer \(QRA\) CLI/);
  assert.match(output, /qra analyze --json "<query>"/);
});

test("analyze --json returns a parseable report", () => {
  const output = runCli(["analyze", "--json", "Update the README formatting."]);
  const report = JSON.parse(output);

  assert.strictEqual(report.input.text, "Update the README formatting.");
  assert.ok(typeof report.summary === "string" && report.summary.length > 0);
  assert.ok(["low", "medium", "high"].includes(report.risk.level));
  assert.ok(typeof report.model?.tier === "string");
  assert.ok(typeof report.nextAction === "string" && report.nextAction.length > 0);
  assert.ok(typeof report.refinedPrompt === "string" && report.refinedPrompt.length > 0);
  assert.match(report.refinedPrompt, /Please help with the following task\./);
});

test("analyze human-readable output highlights the action and prompt", () => {
  const output = runCli(["analyze", "Refactor the auth and billing flows across the repo."]);

  assert.match(output, /Next action:/);
  assert.match(output, /Refined prompt:/);
  assert.match(output, /Task:/);
});

test("analyze human-readable output adapts for repo-survey prompts", () => {
  const output = runCli([
    "analyze",
    "Read through the repo and tell me the purpose of the repo and what has been implemented so far and what left"
  ]);

  assert.match(output, /repository understanding task/i);
  assert.match(output, /purpose of the repo/i);
  assert.match(output, /remaining gaps/i);
});

test("analyze human-readable output seeds repo docs in a fresh workspace", () => {
  const tmpDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "qra-cli-survey-"));

  try {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "survey-cli-test", private: true }, null, 2)
    );
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Survey CLI test");
    fs.mkdirSync(path.join(tmpDir, "packages", "cli", "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "packages", "cli", "src", "cli.ts"),
      "export const cli = true;"
    );

    const output = runCli(
      [
        "analyze",
        "Read through the repo and tell me the purpose of the repo and what has been implemented so far and what left"
      ],
      { cwd: tmpDir }
    );

    assert.match(output, /README\.md/);
    assert.match(output, /package\.json/);
    assert.match(output, /package entry point/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
