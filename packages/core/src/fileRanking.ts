import * as path from "node:path";
import type { QraFileIndexEntry, RelevantFile } from "./types";
import type { PromptIntent } from "./queryFeatures";

export interface FileRankingContext {
  repoFiles: QraFileIndexEntry[];
  /**
   * Maximum number of ranked files to return. Defaults to 50 and is
   * typically sourced from `QraConfig.maxFilesPerQuery`.
   */
  maxResults?: number;
  intent?: PromptIntent;
}

function addReason(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function scoreRepoSurveyFile(file: QraFileIndexEntry): RelevantFile | null {
  const lowerPath = file.path.toLowerCase();
  const baseName = path.basename(lowerPath);
  const reasons: string[] = [];
  let score = 0;

  if (/^readme(\.[^.]+)?$/.test(baseName)) {
    score += 100;
    addReason(reasons, "repo overview / entry doc");
  }

  if (lowerPath === "package.json") {
    score += 95;
    addReason(reasons, "root package manifest");
  }

  if (baseName.startsWith("tsconfig") && baseName.endsWith(".json")) {
    score += 85;
    addReason(reasons, "TypeScript workspace config");
  }

  if (baseName === ".qraignore" || baseName === ".gitignore") {
    score += 80;
    addReason(reasons, "ignore rules");
  }

  if (lowerPath.startsWith("packages/") && baseName === "package.json") {
    score += 70;
    addReason(reasons, "workspace package manifest");
  }

  if (lowerPath.startsWith("packages/") && /\/src\/(index|cli|extension|panel|commands|settings)\.(ts|tsx|js|jsx)$/.test(lowerPath)) {
    score += 65;
    addReason(reasons, "package entry point");
  }

  if (lowerPath.startsWith("docs/")) {
    if (baseName === "index.html") {
      score += 60;
      addReason(reasons, "docs home page");
    } else if (baseName === "404.html") {
      score += 55;
      addReason(reasons, "docs fallback page");
    } else if (baseName === "styles.css") {
      score += 50;
      addReason(reasons, "docs styling");
    }
  }

  if (lowerPath.startsWith(".github/workflows/") && /\.(yml|yaml)$/.test(baseName)) {
    score += 45;
    addReason(reasons, "CI workflow");
  }

  if (lowerPath === "mvp1.md" || lowerPath === "roadmap.md" || lowerPath === "plan.md") {
    score += 90;
    addReason(reasons, "product roadmap");
  }

  if (score <= 0) {
    return null;
  }

  return {
    path: file.path,
    score,
    reasons,
    approxTokens: file.approxTokens
  };
}

export function buildRepoSurveyFiles(
  repoFiles: QraFileIndexEntry[],
  maxResults = 12
): RelevantFile[] {
  const results = repoFiles
    .map((file) => scoreRepoSurveyFile(file))
    .filter((file): file is RelevantFile => file !== null)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  return results.slice(0, maxResults);
}

export function rankFiles(
  queryText: string,
  context: FileRankingContext
): RelevantFile[] {
  if (context.intent === "repo-survey") {
    return buildRepoSurveyFiles(context.repoFiles, context.maxResults ?? 50);
  }

  const tokens = queryText
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .filter(Boolean);

  if (tokens.length === 0 || context.repoFiles.length === 0) {
    return [];
  }

  const tokenSet = new Set(tokens);

  const results: RelevantFile[] = [];

  for (const file of context.repoFiles) {
    let score = 0;
    const reasons: string[] = [];

    const folderMatches = file.folderTokens.filter((t) =>
      tokenSet.has(t.toLowerCase())
    );
    if (folderMatches.length > 0) {
      score += folderMatches.length * 3;
      reasons.push(`folder matches: ${folderMatches.join(", ")}`);
    }

    const fileMatches = file.fileTokens.filter((t) =>
      tokenSet.has(t.toLowerCase())
    );
    if (fileMatches.length > 0) {
      score += fileMatches.length * 4;
      reasons.push(`filename matches: ${fileMatches.join(", ")}`);
    }

    const importMatches = file.importTokens.filter((t) =>
      tokenSet.has(t.toLowerCase())
    );
    if (importMatches.length > 0) {
      score += importMatches.length * 2;
      reasons.push(`import matches: ${importMatches.join(", ")}`);
    }

    const symbolMatches = file.symbolTokens.filter((t) =>
      tokenSet.has(t.toLowerCase())
    );
    if (symbolMatches.length > 0) {
      score += symbolMatches.length * 2;
      reasons.push(`symbol matches: ${symbolMatches.join(", ")}`);
    }

    // Mild penalty for extremely generic names.
    if (file.fileTokens.length === 1) {
      const base = file.fileTokens[0].toLowerCase();
      if (["index", "main", "util", "utils"].includes(base)) {
        score -= 1;
        reasons.push("penalty: generic filename");
      }
    }

    if (score <= 0) {
      continue;
    }

    results.push({
      path: file.path,
      score,
      reasons,
      approxTokens: file.approxTokens
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, context.maxResults ?? 50);
}

