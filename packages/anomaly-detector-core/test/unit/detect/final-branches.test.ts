import { describe, it, expect } from 'vitest'
import { TrcfDetector } from '../../../src/detect/trcf-detector.js'
import { DriftDetector } from '../../../src/detect/drift.js'
import { DimensionAttributor } from '../../../src/detect/attribution.js'
import { ForecastGuidedCalibrator } from '../../../src/calibrate/forecast-guided.js'

describe('Final branch coverage', () => {
  it('setState with null driftState recreates default', () => {
    const d1 = new TrcfDetector({ windowSize: 64 })
    d1.detect({ value: 50, dimensions: { a: 1 }, timestamp: Date.now() }, [])
    const state = d1.getState()
    const parsed = JSON.parse(new TextDecoder().decode(state))
    parsed.driftState = null
    const d2 = new TrcfDetector({ windowSize: 64 })
    d2.setState(new TextEncoder().encode(JSON.stringify(parsed)))
    expect(d2.detect({ value: 50, timestamp: Date.now() }, [])).toBeDefined()
  })

  it('reset with attribution disabled', () => {
    const d = new TrcfDetector({ windowSize: 64, attributionEnabled: false })
    d.reset()
    expect(d.detect({ value: 50, timestamp: Date.now() }, [])).toBeDefined()
  })

  it('setState from pure univariate state', () => {
    const d1 = new TrcfDetector({ windowSize: 64, driftEnabled: false, attributionEnabled: false })
    for (let i = 0; i < 50; i++) d1.detect({ value: 50, timestamp: Date.now() + i * 60000 }, [])
    const d2 = new TrcfDetector({ windowSize: 64 })
    d2.setState(d1.getState())
    expect(d2.detect({ value: 200, timestamp: Date.now() + 50 * 60000 }, [])).toBeDefined()
  })

  it('fresh calibrator has zero history', () => {
    const cal = new ForecastGuidedCalibrator()
    const r = cal.calibrate(
      { isAnomaly: false, grade: 0, score: 0, threshold: 1, confidence: 0.3, attribution: [], driftDetected: false, detectedAt: Date.now() },
      { predicted: [50], q10: [45], q90: [55], horizon: 1, modelName: 't', predictedAt: Date.now() },
      { value: 50, timestamp: Date.now() }
    )
    expect(r.jointConfidence).toBeLessThan(0.5)
  })

  it('KSWIN below window size returns no drift', () => {
    const dd = new DriftDetector('kswin', { windowSize: 100, alpha: 0.01 })
    let detections = 0
    for (let i = 0; i < 50; i++) {
      if (dd.update(50 + (Math.random() - 0.5) * 10).detected) detections++
    }
    expect(detections).toBe(0)
  })

  it('attribution with no-dimension context', () => {
    const attr = new DimensionAttributor()
    const ctx = [{ value: 50, timestamp: Date.now() }, { value: 52, timestamp: Date.now() }]
    const result = attr.compute(
      { value: 200, dimensions: { cpu: 200, mem: 30 }, timestamp: Date.now() },
      ctx, [200, 30], 5,
      (arr) => (arr[0] as number) > 100 ? 5 : 1
    )
    expect(result).toHaveLength(2)
  })
})
