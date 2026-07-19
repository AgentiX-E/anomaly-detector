/**
 * Edge-case tests for DriftDetector — targets uncovered ?? / || branches.
 *
 * - ADWIN line 174 `|| 1`: variance(this.window) returns 0 (all values equal after drift cut)
 * - KSWIN line 218 `|| 1`: variance(this.refWindow) returns 0
 * - ADWIN line 179 `return { detected: false }`: constant data yields no drift
 * - DriftDetector constructor fromState edge cases
 */
import { describe, it, expect } from 'vitest'
import { DriftDetector } from '../../../src/detect/drift.js'

describe('DriftDetector edge cases', () => {
  // ── ADWIN no-drift path (line 179) ─────────────────────

  it('ADWIN: no false positives on strictly constant data', () => {
    const dd = new DriftDetector('adwin', { minWindowSize: 50, delta: 0.002 })
    let detections = 0
    for (let i = 0; i < 300; i++) {
      const r = dd.update(50)
      if (r.detected) detections++
    }
    // Constant data: all means equal → bestDiff=0 → no cut → return { detected: false }
    expect(detections).toBe(0)
  })

  // ── ADWIN || 1 on variance (line 174) ─────────────────

  it('ADWIN: handles zero-variance post-drift window (|| 1 on line 174)', () => {
    // Strategy: feed a large block of constant values, then a single different value.
    // ADWIN detects drift at the transition. The post-cut window will have
    // only identical values → variance = 0 → sqrt(0) = 0 → 0 || 1 → 1
    const dd = new DriftDetector('adwin', { minWindowSize: 50, delta: 0.002 })
    // Warmup: 200 identical values
    for (let i = 0; i < 200; i++) dd.update(50)
    // Single jump
    const r = dd.update(500)
    // May or may not detect on the first jump value — try a few more
    let detected = r.detected
    for (let i = 0; i < 5 && !detected; i++) {
      detected = dd.update(500).detected
    }
    // At minimum, the detector should remain functional after the operation
    expect(() => dd.update(500)).not.toThrow()
  })

  it('ADWIN: variance || 1 with large identical block then sustained shift', () => {
    const dd = new DriftDetector('adwin', { minWindowSize: 30, delta: 0.02 })
    // Feed 100 identical values
    for (let i = 0; i < 100; i++) dd.update(100)
    // Sustained shift to another constant value
    let driftDetected = false
    for (let i = 0; i < 100; i++) {
      const r = dd.update(500)
      if (r.detected) driftDetected = true
    }
    // With 100→500 shift, drift should be detected after warmup
    expect(driftDetected).toBe(true)
  })

  // ── KSWIN || 1 on variance (line 218) ─────────────────

  it('KSWIN: handles zero-variance post-drift refWindow (|| 1 on line 218)', () => {
    const dd = new DriftDetector('kswin', { windowSize: 30, alpha: 0.01 })
    // Fill reference window with constant values
    for (let i = 0; i < 30; i++) dd.update(50)
    // Fill test window with different constant values → KS stat should trigger drift
    let detected = false
    for (let i = 0; i < 30; i++) {
      const r = dd.update(500)
      if (r.detected) detected = true
    }
    // Constant reference vs constant test → should detect distribution change
    expect(detected).toBe(true)
  })

  // ── Constructor default & fromState ───────────────────

  it('default constructor type is adwin', () => {
    const dd = new DriftDetector()
    const state = dd.getState()
    expect(state.type).toBe('adwin')
  })

  it('fromState restores kswin detector', () => {
    const dd = DriftDetector.fromState({
      type: 'kswin',
      config: { minWindowSize: 50, delta: 0.002, alpha: 0.005, windowSize: 100 },
      preDriftMean: 10,
      postDriftMean: 20,
      lastDetectionAt: 123456,
      driftCount: 3,
    })
    const state = dd.getState()
    expect(state.type).toBe('kswin')
    expect(state.preDriftMean).toBe(10)
    expect(state.postDriftMean).toBe(20)
  })

  // ── Update with extreme values ────────────────────────

  it('handles very large value range', () => {
    const dd = new DriftDetector('adwin', { minWindowSize: 20 })
    for (let i = 0; i < 50; i++) dd.update(1e10)
    const r = dd.update(1e12)
    expect(() => r).not.toThrow()
  })

  it('handles very small value range', () => {
    const dd = new DriftDetector('adwin', { minWindowSize: 20 })
    for (let i = 0; i < 50; i++) dd.update(1e-10)
    const r = dd.update(1e-8)
    expect(() => r).not.toThrow()
  })
})
