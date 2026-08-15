import type { QraFileIndexEntry, RelevantFile } from "./types";

export interface FileRankingContext {
  repoFiles: QraFileIndexEntry[];
}

export function rankFiles(
  queryText: string,
  context: FileRankingContext
): RelevantFile[] {
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
  return results.slice(0, 50);
}

