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
