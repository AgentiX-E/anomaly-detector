/**
 * AutoModelSelector — selects the best forecasting model based on data characteristics.
 *
 * Analyzes trend (Mann-Kendall τ), seasonality (ACF peak), length, and intermittency.
 * Thresholds derived from forecasting literature (Assimakopoulos 2010, Syntetos 2005).
 */
import type { DataPoint } from '../types.js'

export class AutoModelSelector {
  private enabled: boolean
  private shortThreshold: number
  private seasonalityThreshold: number
  private trendThreshold: number
  private intermittencyThreshold: number

  constructor(enabled = true, opts?: {
    shortThreshold?: number; seasonalityThreshold?: number
    trendThreshold?: number; intermittencyThreshold?: number
  }) {
    this.enabled = enabled
    this.shortThreshold = opts?.shortThreshold ?? 20
    this.seasonalityThreshold = opts?.seasonalityThreshold ?? 0.3
    this.trendThreshold = opts?.trendThreshold ?? 0.5
    this.intermittencyThreshold = opts?.intermittencyThreshold ?? 0.3
  }

  select(context: DataPoint[]): string {
    if (!this.enabled || context.length === 0) return 'AutoForecaster'
    const values = context.map(p => p.value)
    const n = values.length

    if (n < this.shortThreshold) return 'ThetaForecaster'

    const zeroRatio = values.filter(v => v === 0 || Math.abs(v) < 1e-10).length / n
    if (zeroRatio > this.intermittencyThreshold) return 'CrostonForecaster'

    const seasonality = this.computeSeasonality(values)
    if (seasonality > this.seasonalityThreshold) return 'AutoETSForecaster'

    const trend = this.computeTrend(values)
    if (Math.abs(trend) > this.trendThreshold) return 'AutoARIMAForecaster'

    return 'AutoForecaster'
  }

  /** Compute trend strength via Mann-Kendall τ simplified. */
  private computeTrend(values: number[]): number {
    const n = values.length
    if (n < 3) return 0
    let concordant = 0; let discordant = 0
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 20, n); j++) {
        const diff = values[j]! - values[i]!
        if (diff > 0) concordant++
        else if (diff < 0) discordant++
      }
    }
    const total = concordant + discordant
    return total > 0 ? (concordant - discordant) / total : 0
  }

  /** Compute seasonality strength via ACF at candidate lags. */
  private computeSeasonality(values: number[]): number {
    const n = values.length
    if (n < 15) return 0
    const mean = values.reduce((a, b) => a + b, 0) / n
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    if (variance < 1e-10) return 0

    let maxAcf = 0
    for (const lag of [7, 12, 24]) {
      if (lag >= n / 2) continue
      let acf = 0
      for (let i = 0; i < n - lag; i++) {
        acf += (values[i]! - mean) * (values[i + lag]! - mean)
      }
      acf /= (n - lag) * variance
      maxAcf = Math.max(maxAcf, Math.abs(acf))
    }
    return maxAcf
  }
}
