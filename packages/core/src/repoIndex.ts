import * as fs from "node:fs";
import * as path from "node:path";
import type { QraFileIndexEntry } from "./types";

export interface RepoIndexOptions {
  cwd?: string;
  includeExtensions?: string[];
  excludeDirs?: string[];
  maxFiles?: number;
}

export interface RepoIndexResult {
  files: QraFileIndexEntry[];
}

const DEFAULT_EXCLUDE_DIRS = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  "out",
  ".next",
  ".turbo",
  ".vercel"
];

const DEFAULT_INCLUDE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mdx"
];

const APPROX_CHARS_PER_TOKEN = 4;

function shouldExcludeDir(name: string, excludeDirs: string[]): boolean {
  return excludeDirs.some((d) => name === d);
}

function shouldIncludeFile(filePath: string, includeExts: string[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) {
    return false;
  }
  return includeExts.includes(ext);
}

function tokenizePathSegments(p: string): { folderTokens: string[]; fileTokens: string[] } {
  const dir = path.dirname(p);
  const base = path.basename(p);
  const folderTokens = dir
    .split(path.sep)
    .filter(Boolean)
    .flatMap((segment) => segment.split(/[-_./]+/).filter(Boolean));
  const fileTokens = base.split(/[-_.]+/).filter(Boolean);
  return { folderTokens, fileTokens };
}

function readPrefixContent(filePath: string, byteLimit = 32_000): string {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.allocUnsafe(byteLimit);
    const bytesRead = fs.readSync(fd, buffer, 0, byteLimit, 0);
    fs.closeSync(fd);
    return buffer.toString("utf8", 0, bytesRead);
  } catch {
    return "";
  }
}

function extractImportsAndSymbols(content: string): {
  importTokens: string[];
  symbolTokens: string[];
} {
  const importTokens = new Set<string>();
  const symbolTokens = new Set<string>();

  const importRegex =
    /import\s+(?:[\w*{}\s,]+\s+from\s+)?["'`](.+?)["'`]|require\(["'`](.+?)["'`]\)/g;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = importRegex.exec(content))) {
    const spec = match[1] ?? match[2];
    if (spec) {
      importTokens.add(spec);
      spec
        .split(/[/\-_.]+/)
        .filter(Boolean)
        .forEach((t) => importTokens.add(t));
    }
  }

  const symbolRegex =
    /\b(class|interface|type|function|enum)\s+([A-Za-z0-9_$]+)/g;
  // eslint-disable-next-line no-cond-assign
  while ((match = symbolRegex.exec(content))) {
    const symbol = match[2];
    symbolTokens.add(symbol);
  }

  return {
    importTokens: Array.from(importTokens),
    symbolTokens: Array.from(symbolTokens)
  };
}

export function buildRepoIndex(options: RepoIndexOptions = {}): RepoIndexResult {
  const cwd = options.cwd ?? process.cwd();
  const includeExts = options.includeExtensions ?? DEFAULT_INCLUDE_EXTENSIONS;
  const excludeDirs = options.excludeDirs ?? DEFAULT_EXCLUDE_DIRS;
  const maxFiles = options.maxFiles ?? 2_000;

  const entries: QraFileIndexEntry[] = [];

  function walk(dir: string): void {
    if (entries.length >= maxFiles) {
      return;
    }

    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relPath = path.relative(cwd, fullPath) || item.name;

      if (item.isDirectory()) {
        if (shouldExcludeDir(item.name, excludeDirs)) {
          continue;
        }
        walk(fullPath);
      } else if (item.isFile()) {
        if (!shouldIncludeFile(fullPath, includeExts)) {
          continue;
        }

        let sizeBytes = 0;
        try {
          const stats = fs.statSync(fullPath);
          sizeBytes = stats.size;
        } catch {
          sizeBytes = 0;
        }

        const approxTokens = Math.max(
          1,
          Math.round(sizeBytes / APPROX_CHARS_PER_TOKEN)
        );
        const { folderTokens, fileTokens } = tokenizePathSegments(relPath);
        const content = readPrefixContent(fullPath);
        const { importTokens, symbolTokens } = extractImportsAndSymbols(content);

        entries.push({
          path: relPath,
          sizeBytes,
          approxTokens,
          folderTokens,
          fileTokens,
          importTokens,
          symbolTokens
        });

        if (entries.length >= maxFiles) {
          return;
        }
      }
    }
  }

  walk(cwd);

  return { files: entries };
}

