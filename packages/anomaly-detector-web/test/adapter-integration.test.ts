/**
 * Scientific integration tests for TimesfmWebAdapter — mocked engine.
 *
 * These tests mock the dynamic import of @agentix-e/timesfm-web with a
 * controlled fake engine. We verify:
 *   - Correct delegation to the engine (parameters, context, horizon)
 *   - Result transformation (pointForecast → Array, quantile extraction)
 *   - Edge cases: missing quantiles, null pointForecast, partial arrays
 *   - Engine caching (second call reuses cached instance)
 *   - Error propagation for non-module-not-found errors
 *   - Horizon parameter handling (explicit vs default)
 *   - Variable-based import path (prevents Vite static analysis)
 *
 * Each test verifies behavior that directly impacts downstream calibration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock the optional dependency ──────────────────────────

const mockEngineForecast = vi.fn()

vi.mock('@agentix-e/timesfm-web', () => ({
  TimesFMWebEngine: vi.fn(function (this: Record<string, unknown>, cfg: Record<string, unknown>) {
    this._config = cfg
    this.forecast = mockEngineForecast
  }),
}))

import { TimesfmWebAdapter } from '../src/adapter.js'
import type { DataPoint } from '../src/adapter.js'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockedModule = await import('@agentix-e/timesfm-web')
const MockEngine = mockedModule.TimesFMWebEngine as ReturnType<typeof vi.fn>

function makeData(n: number, fn: (i: number) => number): DataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    value: fn(i), timestamp: Date.now() - (n - i) * 60_000,
  }))
}

describe('TimesfmWebAdapter — mocked engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Forecast: normal path ──────────────────────────────

  it('delegates to engine with correct parameters', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([100, 101, 102]),
      quantileForecast: null,
    })
    const adapter = new TimesfmWebAdapter({ model: 'test', contextWindow: 512, horizon: 10 })
    const data = makeData(30, i => 50 + i)

    await adapter.forecast(data, 5)

    expect(MockEngine).toHaveBeenCalledWith({
      modelName: 'test',
      maxContext: 512,
      maxHorizon: 10,
    })
    expect(mockEngineForecast).toHaveBeenCalledWith(
      data.map(p => p.value),
      { contextLength: 512, horizon: 5 }
    )
  })

  it('transforms point forecast from Float64Array to number[]', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([10, 20, 30]),
    })
    const adapter = new TimesfmWebAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 3)

    expect(result.predicted).toEqual([10, 20, 30])
    expect(result.horizon).toBe(3)
    expect(result.modelName).toBe(adapter.modelName)
    expect(typeof result.predictedAt).toBe('number')
  })

  // ── Forecast: quantile extraction ──────────────────────

  it('extracts q10 and q90 from quantile forecast', async () => {
    const quantiles = Array.from({ length: 10 }, (_, qi) =>
      Array.from({ length: 3 }, (_, i) => 50 + qi * 5 + i)
    )
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([70, 71, 72]),
      quantileForecast: quantiles,
    })
    const adapter = new TimesfmWebAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 3)

    expect(result.q10).toEqual(quantiles[2])
    expect(result.q90).toEqual(quantiles[8])
  })

  it('falls back to empty when quantileForecast is null/undefined', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([50]),
      quantileForecast: undefined,
    })
    const adapter = new TimesfmWebAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 1)

    expect(result.q10).toEqual([])
    expect(result.q90).toEqual([])
  })

  it('handles partial quantile array (missing indices)', async () => {
    const quantiles = [[100, 101], [102, 103], [104, 105]]
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([105, 106]),
      quantileForecast: quantiles,
    })
    const adapter = new TimesfmWebAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 2)

    // Index 2 exists, index 8 does not
    expect(result.q10).toEqual([104, 105])
    expect(result.q90).toEqual([])
  })

  it('falls back to empty predicted when pointForecast is null', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: null,
    })
    const adapter = new TimesfmWebAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 1)

    expect(result.predicted).toEqual([])
  })

  // ── Horizon handling ───────────────────────────────────

  it('uses default horizon from config when undefined passed', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([50]),
    })
    const adapter = new TimesfmWebAdapter({ horizon: 24 })

    // Call forecast with undefined horizon (simulating caller passing nothing)
    const result = await (adapter.forecast as Function)(makeData(5, i => i), undefined)

    expect(result.horizon).toBe(24)
    expect(mockEngineForecast).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ horizon: 24 })
    )
  })

  it('uses explicit horizon over config default', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([50]),
    })
    const adapter = new TimesfmWebAdapter({ horizon: 64 })
    const result = await adapter.forecast(makeData(5, i => i), 12)

    expect(result.horizon).toBe(12)
  })

  // ── Engine caching ─────────────────────────────────────

  it('caches engine — second forecast reuses same instance', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([1]),
    })
    const adapter = new TimesfmWebAdapter()

    await adapter.forecast(makeData(5, i => i), 1)
    await adapter.forecast(makeData(5, i => i), 1)

    // Engine constructor called only once
    expect(MockEngine).toHaveBeenCalledTimes(1)
    // forecast method called twice
    expect(mockEngineForecast).toHaveBeenCalledTimes(2)
  })

  it('engine caching survives config changes between instances', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([1]),
    })
    // Two different adapter instances — each should have its own engine
    const a1 = new TimesfmWebAdapter({ model: 'm1' })
    const a2 = new TimesfmWebAdapter({ model: 'm2' })

    await a1.forecast(makeData(5, i => i), 1)
    await a2.forecast(makeData(5, i => i), 1)

    expect(MockEngine).toHaveBeenCalledTimes(2)
  })

  // ── Error handling ─────────────────────────────────────

  it('propagates non-module-not-found errors', async () => {
    MockEngine.mockImplementationOnce(() => {
      throw new Error('WebGL context lost')
    })
    const adapter = new TimesfmWebAdapter()

    await expect(adapter.forecast(makeData(5, i => i), 1)).rejects.toThrow(
      'WebGL context lost'
    )
  })

  it('engine construction error does NOT get mistaken for missing dep', async () => {
    MockEngine.mockImplementationOnce(() => {
      throw new Error('Out of memory')
    })
    const adapter = new TimesfmWebAdapter()

    try {
      await adapter.forecast(makeData(5, i => i), 1)
      expect.fail('Should have thrown')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).not.toContain('npm install')
      expect(msg).toContain('Out of memory')
    }
  })

  // ── Config propagation ─────────────────────────────────

  it('config flows to engine constructor', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([50]),
    })
    const adapter = new TimesfmWebAdapter({
      model: 'timesfm-2.0',
      contextWindow: 2048,
      horizon: 128,
    })

    await adapter.forecast(makeData(5, i => i), 1)

    expect(MockEngine).toHaveBeenCalledWith({
      modelName: 'timesfm-2.0',
      maxContext: 2048,
      maxHorizon: 128,
    })
  })

  it('modelName reflects config', () => {
    const adapter = new TimesfmWebAdapter({ model: 'timesfm-2.5-200m' })
    expect(adapter.modelName).toBe('TimesFM-timesfm-2.5-200m')
  })
})
