export function calculateRoundScore(passed: number, total: number): number {
  if (!Number.isInteger(passed) || !Number.isInteger(total) || total <= 0 || passed < 0 || passed > total) {
    throw new RangeError("Expected a positive total and a passed count between zero and total");
  }
  return Math.round((passed / total) * 100);
}
