import { describe, it, expect } from 'vitest'
import { TrcfDetector } from '../../../src/detect/trcf-detector.js'

describe('Push detect branch past 95%', () => {
  it('drift detection triggers info population (line 77)', () => {
    const d = new TrcfDetector({ windowSize: 64, driftEnabled: true, driftDetector: 'adwin', attributionEnabled: false })
    // Feed stationary
    for (let i = 0; i < 200; i++) d.detect({ value: 50 + (Math.random() - 0.5) * 10, timestamp: Date.now() + i * 60000 }, [])
    // Feed shifted data to trigger drift
    let driftTriggered = false
    for (let i = 0; i < 100; i++) {
      const r = d.detect({ value: 80 + (Math.random() - 0.5) * 10, timestamp: Date.now() + (200 + i) * 60000 }, [])
      if (r.driftDetected && r.driftDetails) driftTriggered = true
    }
    expect(driftTriggered).toBe(true)
  })

  it('setState with undefined isMultivariate and dimensionNames (lines 110-111)', () => {
    const d = new TrcfDetector({ windowSize: 64, driftEnabled: false, attributionEnabled: false })
    // Manually construct state without those fields
    const state = JSON.stringify({ config: d['config'] })
    d.setState(new TextEncoder().encode(state))
    // Should default to univariate — no crash
    const r = d.detect({ value: 50, timestamp: Date.now() }, [])
    expect(r).toBeDefined()
  })
})
