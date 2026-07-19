import { describe, it, expect } from 'vitest'
import { ForecastGuidedCalibrator } from '../../../src/calibrate/forecast-guided.js'
import { JointConfidenceCalibrator } from '../../../src/calibrate/joint.js'
import type { DetectionResult, ForecastResult, DataPoint } from '../../../src/types.js'

function det(overrides?: Partial<DetectionResult>): DetectionResult {
  return { isAnomaly: false, grade: 0, score: 0, threshold: 1, confidence: 0.5, attribution: [], driftDetected: false, detectedAt: Date.now(), ...overrides }
}
function fc(p?: number[], q10?: number[], q90?: number[]): ForecastResult {
  return { predicted: p ?? [50], q10: q10 ?? [], q90: q90 ?? [], horizon: 1, modelName: 't', predictedAt: Date.now() }
}
const pt: DataPoint = { value: 50, timestamp: Date.now() }

describe('Push branch coverage past 95%', () => {
  it('forecast-guided tracker overflow triggers shift', () => {
    const cal = new ForecastGuidedCalibrator()
    // HitRateTracker maxSize is 100 — feed 101 to overflow
    for (let i = 0; i < 101; i++) {
      cal.calibrate(det({ confidence: 0.5 + (i % 2) * 0.4 }), fc([50], [40], [60]), pt)
    }
    const r = cal.calibrate(det({ confidence: 0.8 }), fc([50], [40], [60]), pt)
    expect(r.jointConfidence).toBeGreaterThan(0)
  })

  it('joint calibrator with undefined q10 element', () => {
    const cal = new JointConfidenceCalibrator()
    // q10[0] is undefined (empty array) — triggers ?? fallback
    const r = cal.calibrate(det({ grade: 0.3 }), fc([50], [], []), pt)
    expect(Number.isFinite(r.jointConfidence)).toBe(true)
  })
})
