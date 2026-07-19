/**
 * Integration tests for calibrators + utility functions.
 *
 * Uses REAL TrcfDetector (no mocks) — tests actual detect→forecast→calibrate pipeline.
 * Tests classifyByLevels and suppressFlapping as pure functions with realistic inputs.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { TrcfDetector } from '../../../src/detect/trcf-detector.js'
import { ForecastGuidedCalibrator } from '../../../src/calibrate/forecast-guided.js'
import { AnomalyGuidedCalibrator } from '../../../src/calibrate/anomaly-guided.js'
import { JointConfidenceCalibrator } from '../../../src/calibrate/joint.js'
import { classifyByLevels, suppressFlapping } from '../../../src/utils/index.js'
import type { DataPoint, DetectionResult, ForecastResult } from '../../../src/types.js'

function genStationary(n: number, mean = 50, std = 5): DataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    value: mean + (Math.random() - 0.5) * 2 * std,
    timestamp: Date.now() - (n - i) * 60_000,
  }))
}

function detectMany(d: TrcfDetector, points: DataPoint[]): DetectionResult[] {
  return points.map(p => d.detect(p, []))
}

function fakeForecast(predicted: number[], q10?: number[], q90?: number[]): ForecastResult {
  return {
    predicted,
    q10: q10 ?? predicted.map(v => v - 2),
    q90: q90 ?? predicted.map(v => v + 2),
    horizon: predicted.length,
    modelName: 'fake',
    predictedAt: Date.now(),
  }
}

describe('ForecastGuidedCalibrator', () => {
  let detector: TrcfDetector

  beforeAll(() => {
    detector = new TrcfDetector({ windowSize: 64, attributionEnabled: false, driftEnabled: false })
    // Warm up
    for (let i = 0; i < 128; i++) detector.detect({ value: 50 + (Math.random() - 0.5) * 10, timestamp: Date.now() + i * 60000 }, [])
  })

  it('jointConfidence ∈ [0, 1] for all calibration results', () => {
    const cal = new ForecastGuidedCalibrator()
    const data = genStationary(100)
    const results = detectMany(detector, data)
    for (const r of results) {
      const fc = fakeForecast([r.grade > 0.5 ? 100 : 50])
      const c = cal.calibrate(r, fc, { value: 50, timestamp: Date.now() })
      expect(c.jointConfidence).toBeGreaterThanOrEqual(0)
      expect(c.jointConfidence).toBeLessThanOrEqual(1)
    }
  })

  it('high residual when value far outside prediction interval', () => {
    const cal = new ForecastGuidedCalibrator()
    const detection: DetectionResult = { isAnomaly: false, grade: 0, score: 0, threshold: 1, confidence: 0, attribution: [], driftDetected: false, detectedAt: Date.now() }
    const forecast = fakeForecast([50], [45], [55])
    const r = cal.calibrate(detection, forecast, { value: 100, timestamp: Date.now() })
    expect(r.residual).toBeGreaterThan(5)
    expect(r.intervalBreached).toBe(true)
  })

  it('near-zero residual when value near prediction', () => {
    const cal = new ForecastGuidedCalibrator()
    const detection: DetectionResult = { isAnomaly: false, grade: 0, score: 0, threshold: 1, confidence: 0.5, attribution: [], driftDetected: false, detectedAt: Date.now() }
    const forecast = fakeForecast([50], [40], [60])
    const r = cal.calibrate(detection, forecast, { value: 50, timestamp: Date.now() })
    expect(r.residual).toBeLessThan(0.2)
    expect(r.intervalBreached).toBe(false)
    expect(r.jointConfidence).toBe(0.5) // No amplification
  })

  it('trcf confidence amplified when residual confirms anomaly', () => {
    const cal = new ForecastGuidedCalibrator()
    const detection: DetectionResult = { isAnomaly: true, grade: 0.8, score: 5, threshold: 2, confidence: 0.9, attribution: [], driftDetected: false, detectedAt: Date.now() }
    const forecast = fakeForecast([50], [45], [55])
    const r = cal.calibrate(detection, forecast, { value: 200, timestamp: Date.now() })
    expect(r.jointConfidence).toBeGreaterThan(0.9)
    expect(r.intervalBreached).toBe(true)
    // jointConfidence should be >= raw confidence (amplification)
    expect(r.jointConfidence).toBeGreaterThanOrEqual(detection.confidence)
  })
})

describe('AnomalyGuidedCalibrator', () => {
  it('non-contaminated by default', () => {
    const cal = new AnomalyGuidedCalibrator()
    const detection: DetectionResult = { isAnomaly: false, grade: 0, score: 0, threshold: 1, confidence: 0.5, attribution: [], driftDetected: false, detectedAt: Date.now() }
    const r = cal.calibrate(detection, fakeForecast([50]), { value: 50, timestamp: Date.now() })
    expect(r.isContaminated).toBe(false)
  })

  it('marks contaminated after sustained anomalies', () => {
    const cal = new AnomalyGuidedCalibrator()
    const anomalyDetection: DetectionResult = { isAnomaly: true, grade: 0.9, score: 5, threshold: 2, confidence: 0.95, attribution: [], driftDetected: false, detectedAt: Date.now() }
    const forecast = fakeForecast([50])
    // 3 consecutive anomalies → contaminated
    for (let i = 0; i < 3; i++) cal.calibrate(anomalyDetection, forecast, { value: 200, timestamp: Date.now() })
    const r = cal.calibrate(anomalyDetection, forecast, { value: 200, timestamp: Date.now() })
    expect(r.isContaminated).toBe(true)
    // Contamination penalty reduces confidence
    expect(r.jointConfidence).toBeLessThan(0.95)
  })

  it('clears contamination after normal point', () => {
    const cal = new AnomalyGuidedCalibrator()
    const anomaly: DetectionResult = { isAnomaly: true, grade: 0.9, score: 5, threshold: 2, confidence: 0.95, attribution: [], driftDetected: false, detectedAt: Date.now() }
    const normal: DetectionResult = { isAnomaly: false, grade: 0, score: 0, threshold: 2, confidence: 0.1, attribution: [], driftDetected: false, detectedAt: Date.now() }
    const forecast = fakeForecast([50])
    for (let i = 0; i < 3; i++) cal.calibrate(anomaly, forecast, { value: 200, timestamp: Date.now() })
    cal.calibrate(normal, forecast, { value: 50, timestamp: Date.now() })
    const r = cal.calibrate(anomaly, forecast, { value: 200, timestamp: Date.now() })
    expect(r.isContaminated).toBe(false)
  })
})

describe('JointConfidenceCalibrator', () => {
  it('grade dominates with narrow spread', () => {
    const cal = new JointConfidenceCalibrator({ grade: 0.4, spread: 0.3, hitRate: 0.2, drift: 0.1 })
    const detection: DetectionResult = { isAnomaly: true, grade: 0.9, score: 5, threshold: 2, confidence: 0.95, attribution: [], driftDetected: false, detectedAt: Date.now() }
    const forecast = fakeForecast([50], [49.5], [50.5])  // Very narrow spread
    const r = cal.calibrate(detection, forecast, { value: 50, timestamp: Date.now() })
    expect(r.jointConfidence).toBeGreaterThan(0.5)
  })

  it('drift penalty reduces confidence', () => {
    const cal = new JointConfidenceCalibrator({ grade: 0.4, spread: 0.3, hitRate: 0.2, drift: 0.1 })
    const detection: DetectionResult = { isAnomaly: false, grade: 0.9, score: 5, threshold: 2, confidence: 0.95, attribution: [], driftDetected: true, detectedAt: Date.now() }
    const forecast = fakeForecast([50], [48], [52])
    const r = cal.calibrate(detection, forecast, { value: 50, timestamp: Date.now() })
    expect(r.jointConfidence).toBeLessThan(0.9)
  })

  it('custom weights are applied', () => {
    const cal = new JointConfidenceCalibrator({ grade: 0.9, spread: 0.05, hitRate: 0.03, drift: 0.02 })
    const detection: DetectionResult = { isAnomaly: true, grade: 0.5, score: 3, threshold: 2, confidence: 0.7, attribution: [], driftDetected: false, detectedAt: Date.now() }
    const r = cal.calibrate(detection, fakeForecast([50], [49], [51]), { value: 50, timestamp: Date.now() })
    // With 0.9 * 0.5 = 0.45 from grade, plus small amounts from others
    expect(r.jointConfidence).toBeGreaterThan(0.4)
    expect(r.jointConfidence).toBeLessThan(0.7)
  })
})

describe('classifyByLevels (utility)', () => {
  it('classifies correctly with custom levels', () => {
    const levels = { critical: 0.95, warning: 0.85, info: 0.70 }
    expect(classifyByLevels(0.96, levels)).toBe('critical')
    expect(classifyByLevels(0.88, levels)).toBe('warning')
    expect(classifyByLevels(0.72, levels)).toBe('info')
    expect(classifyByLevels(0.50, levels)).toBeNull()
  })

  it('works with arbitrary level names and counts', () => {
    expect(classifyByLevels(0.93, { sev1: 0.95, sev2: 0.85, sev3: 0.70, sev4: 0.50 })).toBe('sev2')
    expect(classifyByLevels(0.30, { high: 0.8, low: 0.4 })).toBeNull()
  })

  it('handles empty levels', () => {
    expect(classifyByLevels(0.90, {})).toBeNull()
  })
})

describe('suppressFlapping (utility)', () => {
  it('does not suppress when below threshold', () => {
    const history = [
      { confidence: 0.9, timestamp: Date.now() - 30000 },
      { confidence: 0.85, timestamp: Date.now() - 60000 },
    ]
    expect(suppressFlapping(history, { window: 5, maxInWindow: 3 })).toBe(false)
  })

  it('suppresses when above threshold', () => {
    const history = [
      { confidence: 0.9, timestamp: Date.now() - 10000 },
      { confidence: 0.85, timestamp: Date.now() - 20000 },
      { confidence: 0.88, timestamp: Date.now() - 30000 },
    ]
    expect(suppressFlapping(history, { window: 5, maxInWindow: 3 })).toBe(true)
  })

  it('expired entries do not count toward threshold', () => {
    const history = [
      { confidence: 0.9, timestamp: Date.now() - 500000 },  // 8+ minutes ago
    ]
    expect(suppressFlapping(history, { window: 5, maxInWindow: 2 })).toBe(false)
  })

  it('empty history returns false', () => {
    expect(suppressFlapping([], { window: 5, maxInWindow: 3 })).toBe(false)
  })
})
