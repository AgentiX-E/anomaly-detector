/**
 * DriftDetector — concept drift detection for streaming data.
 *
 * Two algorithms:
 * - ADWIN (Adaptive Windowing): detects mean shifts by comparing
 *   sub-windows within an adaptive window.
 * - KSWIN (Kolmogorov-Smirnov Windowing): detects distribution
 *   changes using KS test on sliding windows.
 *
 * When drift is detected, the anomaly detection threshold can be
 * adjusted to reduce false positives during distribution transitions.
 *
 * @module detect/drift
 */

import type { DriftInfo } from '../types.js'

/** Result from drift detection update. */
export interface DriftUpdateResult {
  /** Whether drift was detected on this update. */
  detected: boolean
  /** Drift information if detected. */
  info?: DriftInfo
}

/** Configuration for DriftDetector. */
interface DriftConfig {
  /** Minimum window size before drift detection is active. */
  minWindowSize: number
  /** ADWIN delta (confidence bound). */
  delta: number
  /** KSWIN alpha (significance level). */
  alpha: number
  /** KSWIN window size for reference distribution. */
  windowSize: number
}

const DEFAULT_DRIFT_CONFIG: DriftConfig = {
  minWindowSize: 100,
  delta: 0.002,
  alpha: 0.005,
  windowSize: 100,
}

/**
 * DriftDetector — detects concept drift in streaming numerical data.
 *
 * @example
 * ```ts
 * const drift = new DriftDetector('adwin')
 * for (const value of stream) {
 *   const result = drift.update(value)
 *   if (result.detected) console.log('Drift at', result.info)
 * }
 * ```
 */
export class DriftDetector {
  private type: 'adwin' | 'kswin'
  private config: DriftConfig

  // ADWIN state
  private window: number[] = []
  private total = 0

  // KSWIN state
  private refWindow: number[] = []
  private testWindow: number[] = []
  private driftCount = 0

  // Shared state
  private preDriftMean = 0
  private postDriftMean = 0
  private lastDetectionAt = 0

  constructor(type: 'adwin' | 'kswin' = 'adwin', config?: Partial<DriftConfig>) {
    this.type = type
    this.config = { ...DEFAULT_DRIFT_CONFIG, ...config }
  }

  /**
   * Update the drift detector with a new value.
   * Returns whether drift was detected.
   */
  update(value: number): DriftUpdateResult {
    if (!Number.isFinite(value)) return { detected: false }

    if (this.type === 'adwin') return this.updateAdwin(value)
    return this.updateKswin(value)
  }

  /** Reset detector state. */
  reset(): void {
    this.window = []
    this.total = 0
    this.refWindow = []
    this.testWindow = []
    this.driftCount = 0
  }

  /** Export state for serialization. */
  getState(): Record<string, unknown> {
    return {
      type: this.type,
      config: this.config,
      preDriftMean: this.preDriftMean,
      postDriftMean: this.postDriftMean,
      lastDetectionAt: this.lastDetectionAt,
      driftCount: this.driftCount,
    }
  }

  /** Restore from serialized state. */
  static fromState(state: Record<string, unknown>): DriftDetector {
    const d = new DriftDetector(state.type as 'adwin' | 'kswin', state.config as Partial<DriftConfig>)
    d.preDriftMean = state.preDriftMean as number
    d.postDriftMean = state.postDriftMean as number
    d.lastDetectionAt = state.lastDetectionAt as number
    d.driftCount = state.driftCount as number
    return d
  }

  // ── ADWIN Implementation ──

  private updateAdwin(value: number): DriftUpdateResult {
    this.window.push(value)
    this.total += value

    const n = this.window.length
    if (n < this.config.minWindowSize) return { detected: false }

    // Check for optimal cut point
    const epsilon = Math.sqrt(
      (1 / (2 * Math.min(n, this.window.length))) *
      Math.log(2 / this.config.delta)
    )

    let bestCut = -1
    let bestDiff = 0
    let leftTotal = 0

    for (let i = 0; i < n - 1; i++) {
      leftTotal += this.window[i]!
      const leftMean = leftTotal / (i + 1)
      const rightMean = (this.total - leftTotal) / (n - i - 1)
      const diff = Math.abs(leftMean - rightMean)

      if (diff > epsilon && diff > bestDiff) {
        bestDiff = diff
        bestCut = i
      }
    }

    if (bestCut >= 0) {
      const oldMean = this.total / n
      const newTotal = this.total - this.window.slice(0, bestCut + 1).reduce((a, b) => a + b, 0)
      const newMean = newTotal / (n - bestCut - 1)

      this.preDriftMean = oldMean
      this.postDriftMean = newMean
      this.lastDetectionAt = Date.now()
      this.driftCount++

      // Drop old window portion
      this.window = this.window.slice(bestCut + 1)
      this.total = newTotal

      return {
        detected: true,
        info: {
          detector: 'adwin',
          detectedAt: this.lastDetectionAt,
          preDriftMean: oldMean,
          postDriftMean: newMean,
          magnitude: Math.abs(newMean - oldMean) / (Math.sqrt(variance(this.window)) || 1),
        },
      }
    }

    return { detected: false }
  }

  // ── KSWIN Implementation ──

  private updateKswin(value: number): DriftUpdateResult {
    this.testWindow.push(value)

    if (this.refWindow.length < this.config.windowSize) {
      this.refWindow.push(value)
      return { detected: false }
    }

    if (this.testWindow.length >= this.config.windowSize) {
      const ksStat = this.computeKS(this.refWindow, this.testWindow)
      const threshold = Math.sqrt(
        -0.5 * Math.log(this.config.alpha / 2)
      ) / Math.sqrt(this.config.windowSize)

      if (ksStat > threshold) {
        const oldMean = this.refWindow.reduce((a, b) => a + b, 0) / this.refWindow.length
        const newMean = this.testWindow.reduce((a, b) => a + b, 0) / this.testWindow.length

        this.preDriftMean = oldMean
        this.postDriftMean = newMean
        this.lastDetectionAt = Date.now()
        this.driftCount++

        // Shift: test window becomes new reference
        this.refWindow = [...this.testWindow]
        this.testWindow = []

        return {
          detected: true,
          info: {
            detector: 'kswin',
            detectedAt: this.lastDetectionAt,
            preDriftMean: oldMean,
            postDriftMean: newMean,
            magnitude: Math.abs(newMean - oldMean) / (Math.sqrt(variance(this.refWindow)) || 1),
          },
        }
      }

      // Slide windows
      this.refWindow.shift()
      this.refWindow.push(this.testWindow.shift()!)
    }

    return { detected: false }
  }

  private computeKS(a: number[], b: number[]): number {
    const sorted = [...a, ...b].sort((x, y) => x - y)
    const n = a.length
    const m = b.length
    let maxDiff = 0

    for (let i = 0; i < sorted.length; i++) {
      if (i < n) cdfA = (i + 1) / n
      if (i < m) cdfB = (i + 1) / m
      // Simplified: count how many from each set are ≤ current value
      let countA = 0, countB = 0
      for (const v of a) if (v <= sorted[i]!) countA++
      for (const v of b) if (v <= sorted[i]!) countB++
      const diff = Math.abs(countA / n - countB / m)
      if (diff > maxDiff) maxDiff = diff
    }

    return maxDiff
  }
}

/** Compute sample variance. */
function variance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
}
