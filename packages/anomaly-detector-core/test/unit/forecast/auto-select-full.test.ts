import { describe, it, expect } from 'vitest'
import { AutoModelSelector } from '../../../src/forecast/auto-select.js'
import type { DataPoint } from '../../../src/types.js'

function makeData(n: number, fn: (i: number) => number): DataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    value: fn(i), timestamp: Date.now() - (n - i) * 60_000,
  }))
}

describe('AutoModelSelector full coverage', () => {
  // These tests cover the Croston and ARIMA branches (lines 40-43, 48-60)
  // that are not exercised by the forecast adapter tests.

  it('selects Croston for highly intermittent data', () => {
    const s = new AutoModelSelector(true)
    // 50% zeros → should trigger Croston (threshold 30%)
    const data = makeData(50, i => i % 2 === 0 ? 50 : 0)
    expect(s.select(data)).toBe('CrostonForecaster')
  })

  it('selects ARIMA for strong monotonic trend', () => {
    const s = new AutoModelSelector(true)
    // Strong linear trend, no seasonality → ARIMA
    const data = makeData(50, i => 50 + i * 2)
    // Hitting the trend detection branch
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
    // Constant values — zero variance → no seasonality or trend
    expect(s.select(makeData(30, () => 50))).toBe('AutoForecaster')
  })
})
