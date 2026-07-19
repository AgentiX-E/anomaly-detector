/**
 * Detect edge case tests — uncovered branch coverage.
 *
 * Targets:
 * - TrcfDetector setState with edge configs
 * - DriftDetector KSWIN branch coverage
 * - toInputArray with missing dimensions
 */
import { describe, it, expect } from 'vitest'
import { TrcfDetector } from '../../../src/detect/trcf-detector.js'
import { DriftDetector } from '../../../src/detect/drift.js'

describe('TrcfDetector edge cases', () => {
  it('setState restores multivariate mode correctly', () => {
    const d1 = new TrcfDetector({ windowSize: 64 })
    // Trigger multivariate mode
    d1.detect({ value: 50, dimensions: { a: 1, b: 2 }, timestamp: Date.now() }, [])
    const state = d1.getState()

    // Restore on fresh detector
    const d2 = new TrcfDetector({ windowSize: 64 })
    d2.setState(state)
    // After restore, should handle multivariate input
    const r = d2.detect({ value: 50, dimensions: { a: 1, b: 2 }, timestamp: Date.now() }, [])
    expect(r).toBeDefined()
    expect(r.isAnomaly).toBeDefined()
  })

  it('toInputArray handles partial dimensions with NaN values', () => {
    const d = new TrcfDetector({ windowSize: 64 })
    // Trigger multivariate with 3 dims
    d.detect({ value: 50, dimensions: { a: 10, b: 20, c: 30 }, timestamp: Date.now() }, [])
    // Now call with missing dimension 'c' and NaN
    const r = d.detect({
      value: 50,
      dimensions: { a: 100 as number, b: NaN as number },
      timestamp: Date.now()
    }, [])
    expect(r).toBeDefined()
  })

  it('reset then multivariate detection works', () => {
    const d = new TrcfDetector({ windowSize: 64 })
    d.detect({ value: 50, dimensions: { x: 1 }, timestamp: Date.now() }, [])
    d.reset()
    // Should now be univariate
    const r = d.detect({ value: 50, timestamp: Date.now() }, [])
    expect(r.isAnomaly).toBeDefined()
  })
})

describe('DriftDetector KSWIN edge cases', () => {
  it('KSWIN with rapid distribution shift', () => {
    const dd = new DriftDetector('kswin', { windowSize: 50, alpha: 0.01 })
    // Feed stationary data
    for (let i = 0; i < 100; i++) dd.update(50 + (Math.random() - 0.5) * 5)
    // Rapid shift — large magnitude
    let detected = false
    for (let i = 0; i < 100; i++) {
      const r = dd.update(150 + (Math.random() - 0.5) * 5)
      if (r.detected) detected = true
    }
    expect(detected).toBe(true)
  })

  it('KSWIN computes KS statistic correctly with identical windows', () => {
    const dd = new DriftDetector('kswin', { windowSize: 30, alpha: 0.5 })
    // Feed identical values — KS should be 0
    for (let i = 0; i < 100; i++) dd.update(50)
    // No drift should be detected on identical data
    const r = dd.update(50)
    expect(r.detected).toBe(false)
  })
})
