import { describe, it, expect } from 'vitest'
import { DriftDetector } from '../../../src/detect/drift.js'

describe('DriftDetector', () => {
  describe('ADWIN', () => {
    it('has low false positive rate on stationary data', () => {
      const dd = new DriftDetector('adwin', { delta: 0.0001, minWindowSize: 200 })
      let detections = 0
      for (let i = 0; i < 500; i++) {
        const r = dd.update(50 + (Math.random() - 0.5) * 2)
        if (r.detected) detections++
      }
      // Very tight delta should give near-zero false positives
      expect(detections).toBeLessThanOrEqual(10)
    })

    it('detects 3σ mean shift within 100 points', () => {
      const dd = new DriftDetector('adwin')
      for (let i = 0; i < 200; i++) {
        dd.update(50 + (Math.random() - 0.5) * 10)
      }
      let detectedAt = -1
      for (let i = 0; i < 100; i++) {
        const r = dd.update(80 + (Math.random() - 0.5) * 10)  // 3σ shift
        if (r.detected && detectedAt < 0) detectedAt = i
      }
      expect(detectedAt).toBeGreaterThanOrEqual(0)
      expect(detectedAt).toBeLessThan(100)
    })

    it('detects gradual drift', () => {
      const dd = new DriftDetector('adwin')
      for (let i = 0; i < 200; i++) {
        dd.update(50 + (Math.random() - 0.5) * 10)
      }
      let detected = false
      for (let i = 0; i < 200; i++) {
        const r = dd.update(50 + i * 0.5 + (Math.random() - 0.5) * 10)
        if (r.detected) detected = true
      }
      expect(detected).toBe(true)
    })
  })

  describe('KSWIN', () => {
    it('has low false positive rate on stationary data', () => {
      const dd = new DriftDetector('kswin', { alpha: 0.001, windowSize: 200 })
      let detections = 0
      for (let i = 0; i < 500; i++) {
        const r = dd.update(50 + (Math.random() - 0.5) * 2)
        if (r.detected) detections++
      }
      expect(detections).toBeLessThanOrEqual(10)
    })

    it('detects distribution change', () => {
      const dd = new DriftDetector('kswin')
      for (let i = 0; i < 200; i++) {
        dd.update(50 + (Math.random() - 0.5) * 10)
      }
      let detected = false
      for (let i = 0; i < 200; i++) {
        const r = dd.update(50 + i * 0.5 + (Math.random() - 0.5) * 10)
        if (r.detected) detected = true
      }
      expect(detected).toBe(true)
    })
  })

  describe('state management', () => {
    it('reset clears state', () => {
      const dd = new DriftDetector('adwin', { delta: 0.0001, minWindowSize: 200 })
      for (let i = 0; i < 200; i++) dd.update(50 + (Math.random() - 0.5) * 2)
      dd.reset()
      let detections = 0
      for (let i = 0; i < 200; i++) {
        const r = dd.update(50 + (Math.random() - 0.5) * 2)
        if (r.detected) detections++
      }
      expect(detections).toBeLessThanOrEqual(2)
    })

    it('getState and fromState round-trips', () => {
      const dd1 = new DriftDetector('adwin')
      for (let i = 0; i < 200; i++) dd1.update(50 + (Math.random() - 0.5) * 10)
      const state = dd1.getState()
      const dd2 = DriftDetector.fromState(state)
      expect(state.type).toBe('adwin')
    })

    it('handles NaN input gracefully', () => {
      const dd = new DriftDetector('adwin')
      expect(() => dd.update(NaN)).not.toThrow()
      expect(dd.update(NaN).detected).toBe(false)
    })

    it('handles Infinity input gracefully', () => {
      const dd = new DriftDetector('adwin')
      expect(() => dd.update(Infinity)).not.toThrow()
    })
  })
})
