/**
 * Scientific integration tests for TimesfmNodeAdapter — mocked engine.
 *
 * These tests mock the dynamic import of @agentix-e/timesfm-node with a
 * controlled fake engine. We verify:
 *   - Correct delegation to the engine (parameters, context, horizon)
 *   - Result transformation (pointForecast → Array, quantile extraction)
 *   - Edge cases: missing quantiles, null pointForecast, partial arrays
 *   - Engine caching (second call reuses cached engine)
 *   - Error propagation for non-module-not-found errors
 *   - Horizon parameter handling (explicit vs default)
 *
 * Each test targets a real behavior that, if broken, would corrupt
 * forecast data passed to the calibration pipeline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock the optional dependency ──────────────────────────

const mockEngineForecast = vi.fn()

vi.mock('@agentix-e/timesfm-node', () => ({
  TimesFMNodeEngine: vi.fn(function (this: Record<string, unknown>, cfg: Record<string, unknown>) {
    this._config = cfg
    this.forecast = mockEngineForecast
  }),
}))

import { TimesfmNodeAdapter } from '../src/adapter.js'
import type { DataPoint, ForecastResult } from '@agentix-e/anomaly-detector-core'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockedModule = await import('@agentix-e/timesfm-node')
const MockEngine = mockedModule.TimesFMNodeEngine as ReturnType<typeof vi.fn>

function makeData(n: number, fn: (i: number) => number): DataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    value: fn(i), timestamp: Date.now() - (n - i) * 60_000,
  }))
}

describe('TimesfmNodeAdapter — mocked engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Forecast: normal path ──────────────────────────────

  it('delegates to engine with correct parameters', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([100, 101, 102]),
      quantileForecast: null,
    })
    const adapter = new TimesfmNodeAdapter({ model: 'test', contextWindow: 512, horizon: 10 })
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
    const adapter = new TimesfmNodeAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 3)

    expect(result.predicted).toEqual([10, 20, 30])
    expect(result.horizon).toBe(3)
    expect(result.modelName).toBe(adapter.modelName)
    expect(typeof result.predictedAt).toBe('number')
  })

  // ── Forecast: quantile extraction ──────────────────────

  it('extracts q10 and q90 from quantile forecast', async () => {
    // 10 quantile arrays: indices 0-9 (d0-d9)
    const quantiles = Array.from({ length: 10 }, (_, qi) =>
      new Float64Array(Array.from({ length: 3 }, (_, i) => 50 + qi * 5 + i))
    )
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([70, 71, 72]),
      quantileForecast: quantiles,
    })
    const adapter = new TimesfmNodeAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 3)

    // Index 2 = q10 extraction, Index 8 = q90 extraction
    expect(result.q10).toEqual(Array.from(quantiles[2]!))
    expect(result.q90).toEqual(Array.from(quantiles[8]!))
  })

  it('handles missing quantile at index (partial quantile array)', async () => {
    // Only 5 quantile arrays; index 8 is out of bounds
    const quantiles = Array.from({ length: 5 }, (_, qi) =>
      new Float64Array([100 + qi])
    )
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([105]),
      quantileForecast: quantiles,
    })
    const adapter = new TimesfmNodeAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 1)

    // Index 2 exists (5 ≥ 3), index 8 is missing → falls back to []
    expect(result.q10).toEqual([102])
    expect(result.q90).toEqual([])
  })

  it('handles null at quantile index (?? [] fallback)', async () => {
    // quantileForecast has a gap at index 2
    const quantiles: (Float64Array | null)[] = [new Float64Array([1]), new Float64Array([2]), null, new Float64Array([4])]
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([50]),
      quantileForecast: quantiles,
    })
    const adapter = new TimesfmNodeAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 1)

    // Index 2 is null → ?? [] → []
    expect(result.q10).toEqual([])
  })

  it('falls back to empty array when quantileForecast is null', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([50]),
      quantileForecast: null,
    })
    const adapter = new TimesfmNodeAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 1)

    expect(result.q10).toEqual([])
    expect(result.q90).toEqual([])
  })

  it('falls back to empty predicted when pointForecast is null', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: null,
      quantileForecast: null,
    })
    const adapter = new TimesfmNodeAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 1)

    expect(result.predicted).toEqual([])
  })

  it('uses default horizon from config when undefined passed', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([50]),
    })
    const adapter = new TimesfmNodeAdapter({ horizon: 24 })
    const result = await (adapter.forecast as unknown as (
      c: DataPoint[], h?: number
    ) => Promise<ForecastResult>)(makeData(5, i => i), undefined as unknown as number)

    expect(result.horizon).toBe(24)
    expect(mockEngineForecast).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ horizon: 24 })
    )
  })

  // ── Engine caching ─────────────────────────────────────

  it('caches engine — second forecast reuses same instance', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([1]),
    })
    const adapter = new TimesfmNodeAdapter()

    await adapter.forecast(makeData(5, i => i), 1)
    await adapter.forecast(makeData(5, i => i), 1)

    // Constructor called only once (engine cached after first load)
    expect(MockEngine).toHaveBeenCalledTimes(1)
    // forecast method called twice (once per forecast call)
    expect(mockEngineForecast).toHaveBeenCalledTimes(2)
  })

  // ── Error handling ─────────────────────────────────────

  it('propagates non-module-not-found errors', async () => {
    // First clear mock so ensureEngine fails with a different error
    MockEngine.mockImplementationOnce(() => {
      throw new Error('ONNX Runtime initialization failed')
    })
    const adapter = new TimesfmNodeAdapter()

    await expect(adapter.forecast(makeData(5, i => i), 1)).rejects.toThrow(
      'ONNX Runtime initialization failed'
    )
  })

  it('engine construction error does NOT get swallowed as module-not-found', async () => {
    MockEngine.mockImplementationOnce(() => {
      throw new Error('CUDA driver not found')
    })
    const adapter = new TimesfmNodeAdapter()

    try {
      await adapter.forecast(makeData(5, i => i), 1)
      expect.fail('Should have thrown')
    } catch (e) {
      const msg = (e as Error).message
      // Should NOT contain install instructions — it's a real error, not missing dep
      expect(msg).not.toContain('npm install')
      expect(msg).toContain('CUDA driver not found')
    }
  })

  // ── Result metadata ────────────────────────────────────

  it('modelName reflects config in forecast result', async () => {
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([50]),
    })
    const adapter = new TimesfmNodeAdapter({ model: 'timesfm-2.0' })
    const result = await adapter.forecast(makeData(5, i => i), 1)

    expect(result.modelName).toContain('timesfm-2.0')
  })

  it('predictedAt is set to current timestamp', async () => {
    const before = Date.now()
    mockEngineForecast.mockResolvedValue({
      pointForecast: new Float64Array([50]),
    })
    const adapter = new TimesfmNodeAdapter()
    const result = await adapter.forecast(makeData(5, i => i), 1)

    expect(result.predictedAt).toBeGreaterThanOrEqual(before)
    expect(result.predictedAt).toBeLessThanOrEqual(Date.now())
  })
})
