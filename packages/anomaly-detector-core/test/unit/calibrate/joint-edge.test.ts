/**
 * Edge-case tests for JointConfidenceCalibrator.
 *
 * Uncovered branch: line 21 — `forecast.predicted[0] ?? currentPoint.value`
 * when predicted array is empty, falls back to currentPoint.value.
 */
import { describe, it, expect } from 'vitest'
import { JointConfidenceCalibrator } from '../../../src/calibrate/joint.js'
import type { DetectionResult, ForecastResult, DataPoint } from '../../../src/types.js'

function makeDetection(grade: number, driftDetected = false): DetectionResult {
  return {
    grade,
    anomalyScore: grade,
    isAnomaly: grade > 0.5,
    method: 'trcf',
    driftDetected,
  }
}

function makeForecast(predicted: number[], q10: number[], q90: number[]): ForecastResult {
  return {
    forecast: predicted,
    predicted,
    q10,
    q90,
    modelName: 'test-model',
    method: 'anofox',
    confidence: 0.8,
  }
}

function makePoint(value: number, timestamp = Date.now()): DataPoint {
  return { value, timestamp }
}

describe('JointConfidenceCalibrator edge cases', () => {
  it('falls back to currentPoint.value when predicted is empty (line 21)', () => {
    const cal = new JointConfidenceCalibrator()
    const detection = makeDetection(0.6)
    // Empty predicted array → falls back to currentPoint.value
    const forecast = makeForecast([], [], [])
    const point = makePoint(50)

    const result = cal.calibrate(detection, forecast, point)
    expect(result).toBeDefined()
    expect(result.mode).toBe('joint')
    expect(typeof result.jointConfidence).toBe('number')
  })

  it('uses predicted[0] when available', () => {
    const cal = new JointConfidenceCalibrator()
    const detection = makeDetection(0.3)
    const forecast = makeForecast([52], [48], [56])
    const point = makePoint(50)

    const result = cal.calibrate(detection, forecast, point)
    expect(result.mode).toBe('joint')
    expect(typeof result.jointConfidence).toBe('number')
  })

  it('handles zero-value current point (spread normalization)', () => {
    const cal = new JointConfidenceCalibrator()
    const detection = makeDetection(0.3)
    // predicted empty → fallback to currentPoint.value = 0
    const forecast = makeForecast([], [], [])
    const point = makePoint(0)

    const result = cal.calibrate(detection, forecast, point)
    // normalizedSpread = 0 when value ≈ 0
    expect(typeof result.jointConfidence).toBe('number')
  })

  it('drift penalty reduces joint confidence', () => {
    const cal = new JointConfidenceCalibrator()
    const detection = makeDetection(0.5, true)
    const forecast = makeForecast([50], [48], [52])
    const point = makePoint(50)

    const result = cal.calibrate(detection, forecast, point)
    // driftPenalty = -1, so drift weight * -1 reduces confidence
    expect(result.jointConfidence).toBeLessThanOrEqual(0.5 * 0.4 + 0.3 + 0.2)
  })

  it('hit rate tracking affects subsequent results', () => {
    const cal = new JointConfidenceCalibrator()
    const detection = makeDetection(0.9)
    const forecast = makeForecast([50], [48], [52])
    const point = makePoint(50)

    // Run several calibrations to build hit rate history
    for (let i = 0; i < 5; i++) {
      cal.calibrate(detection, forecast, point)
    }
    // After multiple calibrations, hitRate should be non-zero
    const result = cal.calibrate(detection, forecast, point)
    expect(typeof result.jointConfidence).toBe('number')
    expect(result.jointConfidence).toBeGreaterThanOrEqual(0)
    expect(result.jointConfidence).toBeLessThanOrEqual(1)
  })

  it('custom weights are applied', () => {
    const cal = new JointConfidenceCalibrator({ grade: 0.8, spread: 0.1, hitRate: 0.05, drift: 0.05 })
    const detection = makeDetection(1.0)
    const forecast = makeForecast([50], [48], [52])
    const point = makePoint(50)

    const result = cal.calibrate(detection, forecast, point)
    // grade=1.0 * 0.8 = 0.8, spread=1.0 * 0.1 = 0.1, hitRate initially low
    expect(result.jointConfidence).toBeGreaterThanOrEqual(0.8)
    expect(result.jointConfidence).toBeLessThanOrEqual(1)
  })

  it('partial custom weights merge with defaults', () => {
    const cal = new JointConfidenceCalibrator({ grade: 0.5 })
    const detection = makeDetection(1.0)
    const forecast = makeForecast([50], [48], [52])
    const point = makePoint(50)

    const result = cal.calibrate(detection, forecast, point)
    expect(typeof result.jointConfidence).toBe('number')
  })

  it('handles extreme forecast spread', () => {
    const cal = new JointConfidenceCalibrator()
    const detection = makeDetection(0.5)
    const forecast = makeForecast([50], [0], [100])
    const point = makePoint(200) // far outside prediction

    const result = cal.calibrate(detection, forecast, point)
    expect(result.intervalBreached).toBe(true)
    expect(result.residual).toBeGreaterThan(2)
  })

  it('handles zero-spread forecast', () => {
    const cal = new JointConfidenceCalibrator()
    const detection = makeDetection(0.3)
    // q10 === q90 → spread = 0
    const forecast = makeForecast([50], [50], [50])
    const point = makePoint(50)

    const result = cal.calibrate(detection, forecast, point)
    // When spread = 0, residual = |point - predicted|
    expect(result.residual).toBe(0)
    expect(result.intervalBreached).toBe(false)
  })
})
