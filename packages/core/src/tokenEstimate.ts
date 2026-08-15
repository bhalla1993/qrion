import type { TokenEstimate } from "./types";

const APPROX_CHARS_PER_TOKEN = 4;

export function estimateTokenUsage(
  queryText: string,
  fileTokenSamples: number[]
): TokenEstimate {
  const queryTokens =
    queryText.trim().length === 0
      ? 0
      : Math.max(1, Math.round(queryText.length / APPROX_CHARS_PER_TOKEN));

  const totalFileTokens = fileTokenSamples.reduce(
    (sum, v) => sum + (Number.isFinite(v) ? v : 0),
    0
  );

  const fileTokensLow = Math.round(totalFileTokens * 0.7);
  const fileTokensHigh = Math.round(totalFileTokens * 1.3);
  const totalTokensLow = queryTokens + fileTokensLow;
  const totalTokensHigh = queryTokens + fileTokensHigh;

  return {
    queryTokens,
    fileTokensLow,
    fileTokensHigh,
    totalTokensLow,
    totalTokensHigh,
    method: "heuristic"
  };
}

