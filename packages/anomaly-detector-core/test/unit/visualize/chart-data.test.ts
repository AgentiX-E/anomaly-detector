import { describe, it, expect } from 'vitest'
import { buildChartData, buildSparkline } from '../../../src/visualize/index.js'
import type { AnalyzedPoint, DataPoint } from '../../../src/types.js'

function basePoint(overrides?: Partial<AnalyzedPoint>): AnalyzedPoint {
  return {
    isAnomaly: false, grade: 0, score: 0, threshold: 1, detectionConfidence: 0.5,
    attribution: [], driftDetected: false,
    predicted: [52, 53, 54], q10: [49, 50, 51], q90: [55, 56, 57], horizon: 3,
    jointConfidence: 0.5, residual: 0, intervalBreached: false,
    calibrationMode: 'forecast-guided',
    analyzedAt: Date.now(), forecasterUsed: 'AutoForecaster', metadata: {},
    ...overrides,
  }
}

function baseContext(n: number): DataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    value: 50 + i * 0.5,
    timestamp: Date.now() - (n - i) * 60_000,
  }))
}

describe('buildChartData', () => {
  it('actual series from context', () => {
    const chart = buildChartData(basePoint(), baseContext(10))
    const a = chart.series.find(s => s.id === 'actual')
    expect(a).toBeDefined()
    expect(a!.data).toHaveLength(10)
    expect(a!.type).toBe('line')
  })

  it('predicted timestamps after context', () => {
    const ctx = baseContext(30)
    const chart = buildChartData(basePoint({ predicted: [52, 53, 54] }), ctx)
    const p = chart.series.find(s => s.id === 'predicted')
    expect(p).toBeDefined()
    expect(p!.data).toHaveLength(3)
    expect(p!.data[0]!.t).toBeGreaterThan(ctx[ctx.length - 1]!.timestamp)
  })

  it('confidence band with companion IDs', () => {
    const chart = buildChartData(basePoint({ q10: [48, 49, 50], q90: [55, 56, 57] }), baseContext(30))
    const q10 = chart.series.find(s => s.id === 'q10')
    const q90 = chart.series.find(s => s.id === 'q90')
    expect(q10).toBeDefined()
    expect(q90).toBeDefined()
    expect(q10!.companionId).toBe('q90')
  })

  it('skips band when q10/q90 empty', () => {
    const chart = buildChartData(basePoint({ q10: [], q90: [], predicted: [52] }), baseContext(30))
    expect(chart.series.find(s => s.id === 'q10')).toBeUndefined()
  })

  it('annotation for anomaly', () => {
    const chart = buildChartData(
      basePoint({ isAnomaly: true, jointConfidence: 0.95, attribution: [{ dimension: 'cpu', contribution: 0.8, confidence: 0.9 }] }),
      baseContext(30)
    )
    expect(chart.annotations).toHaveLength(1)
    expect(chart.annotations[0]!.label).toContain('95')
    expect(chart.annotations[0]!.color).toBe('#DC2626')
  })

  it('no annotation for normal', () => {
    expect(buildChartData(basePoint({ isAnomaly: false }), baseContext(30)).annotations).toHaveLength(0)
  })

  it('y-axis covers predicted values', () => {
    const chart = buildChartData(basePoint({ predicted: [60, 61, 62] }), baseContext(30))
    expect(chart.axes.y.max!).toBeGreaterThanOrEqual(62)
    expect(chart.axes.y.max!).toBeGreaterThan(chart.axes.y.min!)
  })

  it('empty context handled', () => {
    const chart = buildChartData(basePoint(), [])
    expect(chart.series.length).toBeGreaterThanOrEqual(0)
  })

  it('metadata passed through', () => {
    const chart = buildChartData(basePoint({ forecasterUsed: 'ThetaForecaster', calibrationMode: 'joint' }), baseContext(10))
    expect(chart.metadata.forecasterUsed).toBe('ThetaForecaster')
    expect(chart.metadata.calibrationMode).toBe('joint')
  })
})

describe('buildSparkline', () => {
  it('caps at 60 points', () => {
    expect(buildSparkline(basePoint(), baseContext(100)).points.length).toBeLessThanOrEqual(60)
  })

  it('detects upward trend', () => {
    const point = basePoint()
    point.value = 100
    const spark = buildSparkline(point, baseContext(20))
    expect(spark.trend).toBe('up')
    expect(spark.trendPercent).toBeGreaterThan(0)
  })

  it('status from jointConfidence', () => {
    expect(buildSparkline(basePoint({ jointConfidence: 0.3 }), baseContext(10)).status).toBe('normal')
    expect(buildSparkline(basePoint({ jointConfidence: 0.85 }), baseContext(10)).status).toBe('warning')
    expect(buildSparkline(basePoint({ jointConfidence: 0.95 }), baseContext(10)).status).toBe('critical')
  })

  it('currentValue matches input', () => {
    const point = basePoint()
    point.value = 75.5
    expect(buildSparkline(point, baseContext(10)).currentValue).toBe(75.5)
  })
})
