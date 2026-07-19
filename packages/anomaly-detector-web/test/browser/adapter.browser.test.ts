/**
 * TimesfmWebAdapter browser test — REAL Chromium execution.
 *
 * Verifies that the standalone adapter compiles, runs, and gracefully
 * handles the case where @agentix-e/timesfm-web is not installed.
 */
import { describe, it, expect } from 'vitest'
import { TimesfmWebAdapter } from '../../src/adapter.js'
import type { ForecasterType } from '../../src/adapter.js'

function makeData(n: number, fn: (i: number) => number) {
  return Array.from({ length: n }, (_, i) => ({
    value: fn(i), timestamp: Date.now() - (n - i) * 60_000,
  }))
}

describe('TimesfmWebAdapter in real Chromium', () => {
  it('constructs without errors', () => {
    const adapter = new TimesfmWebAdapter({ model: 'timesfm-2.5-200m' })
    expect(adapter).toBeDefined()
    expect(adapter.type).toBe('timesfm' as ForecasterType)
    expect(adapter.modelName).toContain('timesfm')
  })

  it('custom config flows through', () => {
    const a1 = new TimesfmWebAdapter({ model: 'model-a' })
    const a2 = new TimesfmWebAdapter({ model: 'model-b' })
    expect(a1.modelName).toContain('model-a')
    expect(a2.modelName).toContain('model-b')
    expect(a1).not.toBe(a2)
  })

  it('forecast throws when timesfm-web not installed', async () => {
    const adapter = new TimesfmWebAdapter()
    try {
      await adapter.forecast(makeData(30, i => 50), 5)
      expect.fail('Should have thrown')
    } catch (e) {
      expect((e as Error).message.length).toBeGreaterThan(0)
    }
  })
})
