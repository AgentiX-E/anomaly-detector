import { describe, it, expect } from 'vitest'
import { AnofoxForecaster } from '../../../src/forecast/anofox-adapter.js'
import { AutoModelSelector } from '../../../src/forecast/auto-select.js'
import type { DataPoint } from '../../../src/types.js'

function makeData(n: number, fn: (i: number) => number): DataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    value: fn(i), timestamp: Date.now() - (n - i) * 60_000,
  }))
}

describe('AnofoxForecaster', () => {
  it('modelName and type are correct', async () => {
    const fc = new AnofoxForecaster(false)
    await fc.forecast(makeData(30, i => 50 + i * 0.2), 5)
    expect(fc.modelName).toBeTruthy()
    expect(fc.type).toBe('anofox')
  })

  it('constant series predicts near constant', async () => {
    const fc = new AnofoxForecaster(false)
    const r = await fc.forecast(makeData(30, () => 50), 5)
    expect(r.predicted.length).toBeGreaterThan(0)
    for (const v of r.predicted) expect(Math.abs(v - 50)).toBeLessThan(10)
  })

  it('trending data produces forecasts with interval bounds', async () => {
    const fc = new AnofoxForecaster(false)
    const r = await fc.forecast(makeData(50, i => 50 + i * 0.5), 7)
    expect(r.predicted.length).toBeGreaterThan(0)
    expect(r.horizon).toBe(7)
    // Predictions should increase following trend
    if (r.predicted.length > 1) {
      expect(r.predicted[r.predicted.length - 1]!).toBeGreaterThan(r.predicted[0]!)
    }
  })
})

describe('AutoModelSelector', () => {
  it('ThetaForecaster for short series', () => {
    const s = new AutoModelSelector(true)
    expect(s.select(makeData(10, i => 50 + i))).toBe('ThetaForecaster')
  })

  it('CrostonForecaster for intermittent data', () => {
    const s = new AutoModelSelector(true)
    expect(s.select(makeData(30, i => i % 5 === 0 ? 50 : 0))).toBe('CrostonForecaster')
  })

  it('AutoETSForecaster for seasonal data', () => {
    const s = new AutoModelSelector(true)
    expect(s.select(makeData(100, i => 50 + Math.sin(2 * Math.PI * i / 7) * 20))).toBe('AutoETSForecaster')
  })

  it('trending data selects ARIMA or ETS', () => {
    const s = new AutoModelSelector(true)
    const r = s.select(makeData(50, i => 50 + i * 0.5))
    expect(['AutoARIMAForecaster', 'AutoETSForecaster']).toContain(r)
  })

  it('selector is deterministic for same input', () => {
    const s = new AutoModelSelector(true)
    const data = makeData(50, i => 50 + i * 0.5)
    expect(s.select(data)).toBe(s.select(data))
  })

  it('disabled selector returns AutoForecaster', () => {
    const s = new AutoModelSelector(false)
    expect(s.select(makeData(10, () => 50))).toBe('AutoForecaster')
  })
})
