/**
 * Browser integration tests — REAL Chromium execution.
 *
 * Tests modules that are genuinely browser-compatible:
 * - TrcfDetector (pure JS, no Node APIs)
 * - Calibrators (pure JS)
 * - classifyByLevels / suppressFlapping (pure functions)
 *
 * The forecaster (anofox-adapter) uses Node-specific APIs
 * (createRequire, readFile) and is tested separately in Node.
 */
import { describe, it, expect } from 'vitest'
import { TrcfDetector } from '../../src/detect/trcf-detector.js'
import { ForecastGuidedCalibrator } from '../../src/calibrate/forecast-guided.js'
import { JointConfidenceCalibrator } from '../../src/calibrate/joint.js'
import { classifyByLevels, suppressFlapping } from '../../src/utils/index.js'
import type { DataPoint, DetectionResult, ForecastResult } from '../../src/types.js'

function fakeForecast(predicted: number[], q10?: number[], q90?: number[]): ForecastResult {
  return {
    predicted,
    q10: q10 ?? predicted.map(v => v - 2),
    q90: q90 ?? predicted.map(v => v + 2),
    horizon: predicted.length,
    modelName: 'test',
    predictedAt: Date.now(),
  }
}

describe('Browser-compatible modules in real Chromium', () => {
  it('TrcfDetector creates and detects without Node APIs', () => {
    const d = new TrcfDetector({ windowSize: 64, attributionEnabled: false, driftEnabled: false })
    for (let i = 0; i < 100; i++) {
      d.detect({ value: 50 + (Math.random() - 0.5) * 10, timestamp: Date.now() + i * 60000 }, [])
    }
    const r = d.detect({ value: 200, timestamp: Date.now() + 100 * 60000 }, [])
    expect(r.isAnomaly).toBe(true)
    expect(r.grade).toBeGreaterThan(0.5)
  })

  it('ForecastGuidedCalibrator works in browser', () => {
    const cal = new ForecastGuidedCalibrator()
    const detection: DetectionResult = {
      isAnomaly: true, grade: 0.9, score: 5, threshold: 2,
      confidence: 0.95, attribution: [], driftDetected: false, detectedAt: Date.now(),
    }
    const r = cal.calibrate(detection, fakeForecast([50], [45], [55]), { value: 200, timestamp: Date.now() })
    expect(r.jointConfidence).toBeGreaterThan(0)
    expect(r.jointConfidence).toBeLessThanOrEqual(1)
  })

  it('JointConfidenceCalibrator works in browser', () => {
    const cal = new JointConfidenceCalibrator()
    const detection: DetectionResult = {
      isAnomaly: true, grade: 0.9, score: 5, threshold: 2,
      confidence: 0.95, attribution: [], driftDetected: false, detectedAt: Date.now(),
    }
    const r = cal.calibrate(detection, fakeForecast([50], [48], [52]), { value: 50, timestamp: Date.now() })
    expect(r.jointConfidence).toBeGreaterThan(0)
  })

  it('classifyByLevels works in browser', () => {
    expect(classifyByLevels(0.93, { critical: 0.95, warning: 0.85 })).toBe('warning')
  })

  it('suppressFlapping works in browser', () => {
    const h = [
      { confidence: 0.9, timestamp: Date.now() - 1000 },
      { confidence: 0.85, timestamp: Date.now() - 2000 },
      { confidence: 0.88, timestamp: Date.now() - 3000 },
    ]
    expect(suppressFlapping(h, { window: 5, maxInWindow: 3 })).toBe(true)
  })

  it('TrcfDetector state round-trips in browser', () => {
    const d = new TrcfDetector({ windowSize: 64, attributionEnabled: false, driftEnabled: false })
    const state = d.getState()
    expect(state).toBeInstanceOf(Uint8Array)
    d.setState(state)
    expect(() => d.detect({ value: 50, timestamp: Date.now() }, [])).not.toThrow()
  })
})
