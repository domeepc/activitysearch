/**
 * Level curve: level L requires 100 * L XP to complete (L1: 0–99, L2: 100–299, …).
 * Cumulative XP to enter level N (1-based): 100 * (N-1) * N / 2
 */

export function xpToEnterLevel(level: number): bigint {
  if (level <= 1) return BigInt(0);
  const n = BigInt(level - 1);
  return (BigInt(100) * n * (n + BigInt(1))) / BigInt(2);
}

export function xpSpanForLevel(level: number): bigint {
  return BigInt(100 * Math.max(1, level));
}

export function levelFromTotalExp(totalExp: bigint): number {
  if (totalExp < BigInt(0)) return 1;
  let level = 1;
  while (true) {
    const nextStart = xpToEnterLevel(level + 1);
    if (totalExp < nextStart) return level;
    level += 1;
    if (level > 1_000_000) return level;
  }
}

export function progressionFromTotalExp(totalExp: bigint): {
  level: number;
  expIntoLevel: bigint;
  expForCurrentLevel: bigint;
  progressFraction: number;
} {
  const level = levelFromTotalExp(totalExp);
  const start = xpToEnterLevel(level);
  const span = xpSpanForLevel(level);
  const expIntoLevel = totalExp - start;
  const clampedInto =
    expIntoLevel < BigInt(0) ? BigInt(0) : expIntoLevel > span ? span : expIntoLevel;
  const progressFraction =
    span === BigInt(0) ? 0 : Number(clampedInto) / Number(span);
  return {
    level,
    expIntoLevel: clampedInto,
    expForCurrentLevel: span,
    progressFraction: Math.min(1, Math.max(0, progressFraction)),
  };
}

export const LOYALTY_POINTS_PER_LEVEL_UP = 10;
