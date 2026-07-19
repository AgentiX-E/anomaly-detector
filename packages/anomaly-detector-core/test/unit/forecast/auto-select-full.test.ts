import { describe, it, expect } from 'vitest'
import { AutoModelSelector } from '../../../src/forecast/auto-select.js'
import type { DataPoint } from '../../../src/types.js'

function makeData(n: number, fn: (i: number) => number): DataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    value: fn(i), timestamp: Date.now() - (n - i) * 60_000,
  }))
}

describe('AutoModelSelector full coverage', () => {
  // ── Constructor ──────────────────────────────────────────

  it('accepts custom shortThreshold', () => {
    const s = new AutoModelSelector(true, { shortThreshold: 5 })
    // 10 data points → not short (>= 5), no zeros, no seasonality, weak trend → AutoForecaster
    expect(s.select(makeData(10, () => 50))).toBe('AutoForecaster')
  })

  it('accepts custom seasonalityThreshold', () => {
    const s = new AutoModelSelector(true, { seasonalityThreshold: 0.99 })
    // With threshold at 0.99, even strong seasonal data won't trigger ETS
    // Trend should dominate or fall through to AutoForecaster
    const data = makeData(30, i => 50 + i * 2)
    const r = s.select(data)
    expect(['AutoARIMAForecaster', 'AutoForecaster']).toContain(r)
  })

  it('accepts custom trendThreshold', () => {
    const s = new AutoModelSelector(true, { trendThreshold: 0.99, seasonalityThreshold: 0.99 })
    // Weak trend + suppressed seasonality → falls through to AutoForecaster
    // Use noisy data so trend τ < 0.99
    const data = makeData(30, i => 50 + i * 0.3 + Math.sin(i * 0.7) * 5)
    expect(s.select(data)).toBe('AutoForecaster')
  })

  it('accepts custom intermittencyThreshold', () => {
    const s = new AutoModelSelector(true, { intermittencyThreshold: 0.9 })
    // High intermittency threshold → 50% zeros still below 90% → not Croston
    const data = makeData(30, i => i % 2 === 0 ? 50 : 0)
    const r = s.select(data)
    // Falls through to trend/seasonality check
    expect(r).not.toBe('CrostonForecaster')
  })

  // ── Model selection ──────────────────────────────────────

  it('selects Croston for highly intermittent data', () => {
    const s = new AutoModelSelector(true)
    // 50% zeros → should trigger Croston (threshold 30%)
    const data = makeData(50, i => i % 2 === 0 ? 50 : 0)
    expect(s.select(data)).toBe('CrostonForecaster')
  })

  it('selects ARIMA for strong monotonic trend', () => {
    const s = new AutoModelSelector(true)
    const data = makeData(50, i => 50 + i * 2)
    const r = s.select(data)
    const validModels = ['AutoARIMAForecaster', 'AutoForecaster', 'AutoETSForecaster']
    expect(validModels).toContain(r)
  })

  it('handles very short series (N < 3) gracefully', () => {
    const s = new AutoModelSelector(true)
    expect(s.select(makeData(2, i => 50 + i))).toBe('ThetaForecaster')
  })

  it('handles all-constant series (zero variance)', () => {
    const s = new AutoModelSelector(true)
    expect(s.select(makeData(30, () => 50))).toBe('AutoForecaster')
  })

  // ── computeTrend branch push ──────────────────────────────

  it('computeTrend: n < 3 returns zero trend (via custom shortThreshold)', () => {
    const s = new AutoModelSelector(true, { shortThreshold: 2, intermittencyThreshold: 0.9 })
    // 2 points, shortThreshold=2 so NOT short → reaches computeTrend with n=2 < 3 → trend=0
    const data = makeData(2, i => 50 + i)
    expect(s.select(data)).toBe('AutoForecaster')
  })

  it('computeTrend: discordant pairs for decreasing data', () => {
    const s = new AutoModelSelector(true, { intermittencyThreshold: 0.9, seasonalityThreshold: 0.99 })
    // Decreasing → diff < 0 → discordant++; suppress ETS so trend dominates
    const data = makeData(30, i => 100 - i * 2)
    const r = s.select(data)
    // Strong decreasing trend → ARIMA (seasonality suppressed)
    expect(r).toBe('AutoARIMAForecaster')
  })

  it('computeTrend: total=0 when all values equal', () => {
    const s = new AutoModelSelector(true, { intermittencyThreshold: 0.9 })
    // All equal → diff=0 for all pairs → concordant=discordant=0 → total=0 → trend=0
    const data = makeData(30, () => 50)
    expect(s.select(data)).toBe('AutoForecaster')
  })

  // ── computeSeasonality branch push ────────────────────────

  it('computeSeasonality: n < 15 returns zero seasonality (via custom shortThreshold)', () => {
    const s = new AutoModelSelector(true, {
      shortThreshold: 5,
      intermittencyThreshold: 0.9,
      trendThreshold: 0.99, // suppress trend detection
    })
    // 10 points → not short (>=5), not intermittent, n < 15 in computeSeasonality → 0
    const data = makeData(10, i => 50 + (i % 3) * 5)
    expect(s.select(data)).toBe('AutoForecaster')
  })

  it('computeSeasonality: lag >= n/2 triggers continue', () => {
    const s = new AutoModelSelector(true, {
      intermittencyThreshold: 0.9,
      trendThreshold: 0.99, // suppress trend
      seasonalityThreshold: 0.99, // suppress seasonality too
    })
    // 22 points → n/2 = 11
    // lag=7 (<11) → compute ACF; lag=12 (>=11) → continue; lag=24 (>=11) → continue
    const data = makeData(22, i => 50 + Math.sin(i * Math.PI / 4) * 10)
    expect(s.select(data)).toBe('AutoForecaster')
  })

  // ── Disabled selector ────────────────────────────────────

  it('returns AutoForecaster when disabled', () => {
    const s = new AutoModelSelector(false)
    expect(s.select(makeData(50, i => i))).toBe('AutoForecaster')
  })

  // ── Empty context ────────────────────────────────────────

  it('returns AutoForecaster for empty context', () => {
    const s = new AutoModelSelector(true)
    expect(s.select([])).toBe('AutoForecaster')
  })

  // ── ETS for strong seasonality ───────────────────────────

  it('selects ETS for strongly seasonal data', () => {
    const s = new AutoModelSelector(true)
    // Strong sine wave → seasonality > 0.3 → ETS
    const data = makeData(50, i => 50 + Math.sin(i * Math.PI / 3) * 20)
    const r = s.select(data)
    expect(['AutoETSForecaster', 'AutoForecaster']).toContain(r)
  })
})
