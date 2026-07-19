/**
 * classifyByLevels — map confidence to caller-defined severity levels.
 *
 * Pure function. Not part of DI container. Caller defines level names
 * and thresholds. Thresholds are checked from highest to lowest.
 * Returns null if no threshold is met.
 *
 * @example
 * classifyByLevels(0.93, { critical: 0.95, warning: 0.85, info: 0.70 })
 * // → 'warning'
 */
export function classifyByLevels(
  confidence: number,
  levels: Record<string, number>
): string | null {
  const sorted = Object.entries(levels).sort((a, b) => b[1] - a[1])
  for (const [name, threshold] of sorted) {
    if (confidence >= threshold) return name
  }
  return null
}

/**
 * suppressFlapping — detect alert fatigue.
 *
 * Pure function. Returns true if the current alert should be suppressed
 * because too many alerts of similar confidence have fired within the window.
 *
 * @example
 * suppressFlapping(history, { window: 10, maxInWindow: 3 })
 * // → true if 4th alert in window of last 10
 */
export function suppressFlapping(
  history: { confidence: number; timestamp: number }[],
  options: { window: number; maxInWindow: number }
): boolean {
  if (history.length === 0) return false

  const now = Date.now()
  const windowMs = options.window * 60_000 // convert points to ms
  const cutoff = now - windowMs

  const recent = history.filter((h) => h.timestamp >= cutoff && h.confidence > 0)
  return recent.length >= options.maxInWindow
}
