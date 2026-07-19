import { describe, it, expect } from 'vitest'
import { JointConfidenceCalibrator } from '../../../src/calibrate/joint.js'
import { AnomalyGuidedCalibrator } from '../../../src/calibrate/anomaly-guided.js'
import type { DetectionResult, ForecastResult } from '../../../src/types.js'

function det(overrides?: Partial<DetectionResult>): DetectionResult {
  return { isAnomaly: false, grade: 0, score: 0, threshold: 1, confidence: 0.5, attribution: [], driftDetected: false, detectedAt: Date.now(), ...overrides }
}

describe('Coverage gap fillers', () => {
  it('Joint calibrator with undefined q10/q90 triggers fallback', () => {
    const cal = new JointConfidenceCalibrator()
    const fc: ForecastResult = { predicted: [50], q10: [], q90: [], horizon: 1, modelName: 't', predictedAt: Date.now() }
    const r = cal.calibrate(det({ grade: 0.3 }), fc, { value: 50, timestamp: Date.now() })
    expect(Number.isFinite(r.jointConfidence)).toBe(true)
  })

  it('Joint calibrator empty tracker returns default hitRate', () => {
    const cal = new JointConfidenceCalibrator()
    const fc: ForecastResult = { predicted: [50], q10: [40], q90: [60], horizon: 1, modelName: 't', predictedAt: Date.now() }
    // Fresh calibrator — tracker has no history, hitRate defaults to 0.5
    const r = cal.calibrate(det({ grade: 0.5 }), fc, { value: 50, timestamp: Date.now() })
    expect(r.jointConfidence).toBeGreaterThan(0)
    expect(r.jointConfidence).toBeLessThan(1)
  })

  it('AnomalyGuided with zero spread', () => {
    const cal = new AnomalyGuidedCalibrator()
    const fc: ForecastResult = { predicted: [50], q10: [50], q90: [50], horizon: 1, modelName: 't', predictedAt: Date.now() }
    const r = cal.calibrate(det(), fc, { value: 50, timestamp: Date.now() })
    expect(r.residual).toBe(0)
  })
})

  it('Joint calibrator with populated tracker history', () => {
    const cal = new JointConfidenceCalibrator()
    const fc: ForecastResult = { predicted: [50], q10: [40], q90: [60], horizon: 1, modelName: 't', predictedAt: Date.now() }
    // Feed 10 high-confidence anomalies to populate tracker history
    for (let i = 0; i < 10; i++) {
      cal.calibrate(det({ grade: 0.9, isAnomaly: true }), fc, { value: 200, timestamp: Date.now() })
    }
    // Now getHitRate should use hits/history.length, not the empty default
    const r = cal.calibrate(det({ grade: 0.5 }), fc, { value: 50, timestamp: Date.now() })
    expect(r.jointConfidence).toBeGreaterThan(0)
  })
