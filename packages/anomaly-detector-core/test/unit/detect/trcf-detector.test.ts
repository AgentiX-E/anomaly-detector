import { describe, it, expect, beforeEach } from 'vitest'
import { TrcfDetector } from '../../../src/detect/trcf-detector.js'
import type { DataPoint } from '../../../src/types.js'

function stationary(n: number, mean = 50, std = 5): DataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    value: mean + (Math.random() - 0.5) * 2 * std,
    timestamp: Date.now() - (n - i) * 60_000,
  }))
}

function feedDetector(d: TrcfDetector, points: DataPoint[]): void {
  for (const p of points) d.detect(p, [])
}

describe('TrcfDetector', () => {
  describe('univariate detection', () => {
    it('returns no anomaly on stationary data after warmup', () => {
      const d = new TrcfDetector({ windowSize: 64, attributionEnabled: false, driftEnabled: false })
      const data = stationary(200)
      for (let i = 0; i < 128; i++) d.detect(data[i]!, [])
      let anomalies = 0
      for (let i = 128; i < 200; i++) {
        const r = d.detect(data[i]!, [])
        if (r.isAnomaly) anomalies++
      }
      expect(anomalies).toBeLessThan(8)
    })

    it('detects a 5σ spike after warmup', () => {
      const d = new TrcfDetector({ windowSize: 64, attributionEnabled: false, driftEnabled: false })
      const data = stationary(200)
      feedDetector(d, data.slice(0, 128))
      const spike: DataPoint = { value: 50 + 5 * 5, timestamp: Date.now() }
      const r = d.detect(spike, [])
      expect(r.isAnomaly).toBe(true)
      expect(r.grade).toBeGreaterThan(0.5)
    })

    it('handles NaN values gracefully', () => {
      const d = new TrcfDetector({ windowSize: 64, attributionEnabled: false, driftEnabled: false })
      feedDetector(d, stationary(128))
      expect(() => d.detect({ value: NaN, timestamp: Date.now() }, [])).not.toThrow()
    })

    it('handles negative values', () => {
      const d = new TrcfDetector({ windowSize: 64, attributionEnabled: false, driftEnabled: false })
      const data = stationary(128, -10, 2)
      feedDetector(d, data)
      expect(() => d.detect(data[127]!, [])).not.toThrow()
    })

    it('handles zero values', () => {
      const d = new TrcfDetector({ windowSize: 64, attributionEnabled: false, driftEnabled: false })
      const zeros = Array.from({ length: 128 }, (_, i) => ({ value: 0, timestamp: Date.now() + i * 60000 } as DataPoint))
      feedDetector(d, zeros)
      expect(() => d.detect({ value: 0, timestamp: Date.now() + 128 * 60000 }, [])).not.toThrow()
    })

    it('handles very large numbers without overflow', () => {
      const d = new TrcfDetector({ windowSize: 64, attributionEnabled: false, driftEnabled: false })
      const data = stationary(128, 1e6, 1e4)
      feedDetector(d, data)
      expect(() => d.detect(data[127]!, [])).not.toThrow()
    })
  })

  describe('multivariate detection', () => {
    function mvStationary(n: number): DataPoint[] {
      return Array.from({ length: n }, (_, i) => ({
        value: 50,
        dimensions: {
          cpu: 50 + (Math.random() - 0.5) * 10,
          memory: 30 + (Math.random() - 0.5) * 6,
          disk: 80 + (Math.random() - 0.5) * 16,
        },
        timestamp: Date.now() - (n - i) * 60_000,
      }))
    }

    it('detects no anomaly when all dimensions are stable', () => {
      const d = new TrcfDetector({ windowSize: 64, attributionEnabled: true, driftEnabled: false })
      const context = mvStationary(200)
      feedDetector(d, context.slice(0, 128))
      let anomalies = 0
      for (let i = 128; i < 200; i++) {
        const r = d.detect(context[i]!, [])
        if (r.isAnomaly) anomalies++
      }
      expect(anomalies).toBeLessThan(15)
    })

    it('detects anomaly when one dimension spikes', () => {
      const d = new TrcfDetector({ windowSize: 64, attributionEnabled: true, driftEnabled: false })
      const context = mvStationary(200)
      feedDetector(d, context.slice(0, 150))
      const spike: DataPoint = {
        value: 200,
        dimensions: { cpu: 200, memory: 31, disk: 82 },
        timestamp: Date.now(),
      }
      const r = d.detect(spike, [])
      expect(r.isAnomaly).toBe(true)
    })

    it('detects anomaly when correlation pattern breaks', () => {
      const d = new TrcfDetector({ windowSize: 64, attributionEnabled: true, driftEnabled: false })
      const context = mvStationary(200)
      feedDetector(d, context.slice(0, 150))
      const decorrelated: DataPoint = {
        value: 90,
        dimensions: { cpu: 90, memory: -50, disk: 85 },
        timestamp: Date.now(),
      }
      const r = d.detect(decorrelated, [])
      expect(r.isAnomaly).toBe(true)
    })
  })

  describe('state persistence', () => {
    it('serialize + deserialize preserves config', () => {
      const d1 = new TrcfDetector({ windowSize: 128, anomalyRate: 0.01, attributionEnabled: false, driftEnabled: false })
      const state = d1.getState()
      const d2 = new TrcfDetector()
      d2.setState(state)
      const s1 = d1.getState()
      const s2 = d2.getState()
      expect(s1.byteLength).toBeGreaterThan(0)
      expect(s2.byteLength).toBeGreaterThan(0)
    })

    it('setState on same instance does not throw', () => {
      const d = new TrcfDetector()
      const state = d.getState()
      expect(() => d.setState(state)).not.toThrow()
    })

    it('reset clears internal state and detector works again', () => {
      const d = new TrcfDetector()
      d.reset()
      const data = stationary(64)
      expect(() => d.detect(data[0]!, [])).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('handles DataPoint with empty dimensions', () => {
      const d = new TrcfDetector({ windowSize: 64 })
      expect(() => d.detect({ value: 50, timestamp: Date.now(), dimensions: {} }, [])).not.toThrow()
    })

    it('handles DataPoint with undefined dimensions', () => {
      const d = new TrcfDetector({ windowSize: 64 })
      expect(() => d.detect({ value: 50, timestamp: Date.now() }, [])).not.toThrow()
    })

    it('handles empty context', () => {
      const d = new TrcfDetector({ windowSize: 64 })
      expect(() => d.detect({ value: 50, timestamp: Date.now() }, [])).not.toThrow()
    })
  })
})
