/**
 * DimensionAttribution — leave-one-out Shapley approximation.
 *
 * For multivariate anomaly detection, identifies which dimension(s)
 * contributed most to an elevated anomaly score by masking each
 * dimension individually and measuring the score delta.
 *
 * Algorithm:
 *   1. Run detection with all dimensions → baselineScore
 *   2. For each dimension i:
 *      a. Mask dimension i (replace with its historical mean)
 *      b. Re-run detection → maskedScore_i
 *      c. contribution_i = baselineScore - maskedScore_i
 *   3. Normalize contributions to [-1, 1]
 *
 * @module detect/attribution
 */

import type { DataPoint, DimensionAttribution } from '../types.js'

/** Score function type — executes detection and returns the score. */
type ScoreFn = (inputArray: number[], timestamp: number) => number

/**
 * DimensionAttributor computes per-dimension anomaly contributions
 * using the leave-one-out Shapley approximation.
 */
export class DimensionAttributor {
  /**
   * Compute dimension contributions.
   *
   * @param point - Current data point with dimensions
   * @param context - Historical context (used to compute dimension means)
   * @param inputArray - Current input values (ordered by dimensionNames)
   * @param baselineScore - Score with all dimensions present
   * @param scoreFn - Function that takes (inputArray, timestamp) and returns score
   */
  compute(
    point: DataPoint,
    context: DataPoint[],
    inputArray: number[],
    baselineScore: number,
    scoreFn: ScoreFn
  ): DimensionAttribution[] {
    const dims = point.dimensions
    if (!dims) return []

    const names = Object.keys(dims)
    if (names.length <= 1) {
      return names.map((name) => ({
        dimension: name,
        contribution: baselineScore > 0 ? 1 : 0,
        confidence: 1,
      }))
    }

    // Compute historical means for each dimension
    const means = this.computeMeans(names, context)

    // Leave-one-out: mask each dimension and compute score delta
    const contributions: number[] = []
    for (let i = 0; i < names.length; i++) {
      const masked = [...inputArray]
      masked[i] = means[i] ?? 0
      const maskedScore = scoreFn(masked, point.timestamp)
      contributions.push(baselineScore - maskedScore)
    }

    // Normalize
    const absSum = contributions.reduce((s, c) => s + Math.abs(c), 0)
    const normalized = absSum > 0
      ? contributions.map((c) => c / absSum)
      : contributions.map(() => 0)

    return names.map((name, i) => ({
      dimension: name,
      contribution: clamp(normalized[i] ?? 0, -1, 1),
      confidence: Math.min(baselineScore / (Math.abs(means[i] ?? 1) + 1), 1),
    }))
  }

  /**
   * Compute per-dimension historical means from context.
   */
  private computeMeans(
    names: string[],
    context: DataPoint[]
  ): number[] {
    if (context.length === 0) return names.map(() => 0)

    const sums = new Array<number>(names.length).fill(0)
    let count = 0

    for (const dp of context) {
      if (!dp.dimensions) continue
      count++
      for (let i = 0; i < names.length; i++) {
        const name = names[i]!
        const val = dp.dimensions[name]
        if (typeof val === 'number' && Number.isFinite(val)) {
          sums[i] = (sums[i] ?? 0) + val
        }
      }
    }

    return count > 0
      ? sums.map((s) => s / count)
      : names.map(() => 0)
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
