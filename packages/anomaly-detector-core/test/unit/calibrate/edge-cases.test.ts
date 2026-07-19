/**
 * Calibrator edge case tests — exercises uncovered branches with real scenarios.
 *
 * Each test targets a specific uncovered branch identified by coverage analysis:
 * - Zero/near-zero spread (degenerate prediction intervals)
 * - Near-zero actual values (Joint calibrator division protection)
 * - Empty forecast arrays (missing predicted/q10/q90)
 * - Empty context in attribution (computeMeans fallback)
 */

import { describe, it, expect } from 'vitest'
import { ForecastGuidedCalibrator } from '../../../src/calibrate/forecast-guided.js'
import { JointConfidenceCalibrator } from '../../../src/calibrate/joint.js'
import { AnomalyGuidedCalibrator } from '../../../src/calibrate/anomaly-guided.js'
import { DimensionAttributor } from '../../../src/detect/attribution.js'
import type { DetectionResult, ForecastResult } from '../../../src/types.js'

function makeDetection(overrides?: Partial<DetectionResult>): DetectionResult {
  return {
    isAnomaly: false, grade: 0, score: 0, threshold: 1,
    confidence: 0.5, attribution: [], driftDetected: false, detectedAt: Date.now(),
    ...overrides,
  }
}

function makeForecast(predicted: number[], q10?: number[], q90?: number[]): ForecastResult {
  return {
    predicted, q10: q10 ?? [], q90: q90 ?? [],
    horizon: predicted.length, modelName: 'test', predictedAt: Date.now(),
  }
}

describe('Calibrator edge cases — branch coverage', () => {
  describe('ForecastGuidedCalibrator', () => {
    it('degenerate spread (q10 === q90) uses absolute residual', () => {
      const cal = new ForecastGuidedCalibrator()
      const r = cal.calibrate(
        makeDetection({ confidence: 0.7 }),
        makeForecast([100], [100], [100]),  // zero spread
        { value: 150, timestamp: Date.now() }
      )
      // Should not divide by zero — residual uses absolute difference
      expect(r.residual).toBeGreaterThan(0)
      expect(Number.isFinite(r.residual)).toBe(true)
    })

    it('predicted[0] undefined falls back to currentPoint.value', () => {
      const cal = new ForecastGuidedCalibrator()
      const r = cal.calibrate(
        makeDetection(),
        makeForecast([]),  // empty predicted array
        { value: 50, timestamp: Date.now() }
      )
      expect(r.residual).toBe(0)
      expect(Number.isFinite(r.jointConfidence)).toBe(true)
    })

    it('hit rate is tracked across multiple calibrations', () => {
      const cal = new ForecastGuidedCalibrator()
      // Feed several high-confidence calibrations
      for (let i = 0; i < 10; i++) {
        cal.calibrate(
          makeDetection({ confidence: 0.9, isAnomaly: true }),
          makeForecast([50], [40], [60]),
          { value: 200, timestamp: Date.now() }
        )
      }
      // Hit rate should be high after repeated high-confidence anomalies
      const r = cal.calibrate(
        makeDetection({ confidence: 0.9 }),
        makeForecast([50], [40], [60]),
        { value: 200, timestamp: Date.now() }
      )
      expect(r.jointConfidence).toBeGreaterThan(0.8)
    })
  })

  describe('JointConfidenceCalibrator', () => {
    it('near-zero current value divides safely', () => {
      const cal = new JointConfidenceCalibrator()
      const r = cal.calibrate(
        makeDetection({ grade: 0.3 }),
        makeForecast([0.001], [0], [0.002]),
        { value: 0, timestamp: Date.now() }  // value ≈ 0
      )
      expect(Number.isFinite(r.jointConfidence)).toBe(true)
      expect(r.jointConfidence).toBeGreaterThanOrEqual(0)
    })

    it('zero spread falls back gracefully', () => {
      const cal = new JointConfidenceCalibrator()
      const r = cal.calibrate(
        makeDetection({ grade: 0.5 }),
        makeForecast([50], [50], [50]),  // q10 === q90 === predicted
        { value: 50, timestamp: Date.now() }
      )
      expect(r.residual).toBe(0)
      expect(Number.isFinite(r.jointConfidence)).toBe(true)
    })
  })

  describe('AnomalyGuidedCalibrator', () => {
    it('empty predicted fallback uses currentPoint.value', () => {
      const cal = new AnomalyGuidedCalibrator()
      const r = cal.calibrate(
        makeDetection(),
        makeForecast([]),  // empty array
        { value: 50, timestamp: Date.now() }
      )
      expect(r.isContaminated).toBe(false)
      expect(Number.isFinite(r.residual)).toBe(true)
    })
  })
})

describe('DimensionAttributor edge cases', () => {
  it('empty context uses zero means', () => {
    const attr = new DimensionAttributor()
    const point = { value: 200, dimensions: { cpu: 200, mem: 30 }, timestamp: Date.now() }
    const result = attr.compute(point, [], [200, 30], 5, (arr) => (arr[0] as number) > 100 ? 5 : 1)
    expect(result).toHaveLength(2)
    // With zero means, masking replaces value with 0
    // cpu contribution should be identified
    const cpu = result.find(r => r.dimension === 'cpu')
    expect(cpu).toBeDefined()
    expect(cpu!.contribution).toBeGreaterThan(0)
  })

  it('context with missing dimensions uses partial means', () => {
    const attr = new DimensionAttributor()
    const context = [
      { value: 50, dimensions: { cpu: 50 }, timestamp: Date.now() },  // only cpu
      { value: 52, dimensions: { cpu: 52, mem: 30 }, timestamp: Date.now() },
    ]
    const point = { value: 200, dimensions: { cpu: 200, mem: 30 }, timestamp: Date.now() }
    const result = attr.compute(point, context, [200, 30], 5, (arr) => (arr[0] as number) > 100 ? 5 : 1)
    expect(result).toHaveLength(2)
  })
})
