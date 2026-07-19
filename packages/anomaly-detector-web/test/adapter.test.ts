import { describe, it, expect } from 'vitest'
import { TimesfmWebAdapter } from '../src/adapter.js'
import type { ForecasterType } from '@agentix-e/anomaly-detector-core'

function makeData(n: number, fn: (i: number) => number) {
  return Array.from({ length: n }, (_, i) => ({
    value: fn(i), timestamp: Date.now() - (n - i) * 60_000,
  }))
}

describe('TimesfmWebAdapter', () => {
  it('implements IForecaster interface', () => {
    const adapter = new TimesfmWebAdapter()
    expect(adapter.type).toBe('timesfm')
    expect(adapter.modelName).toBeTruthy()
    expect(typeof adapter.forecast).toBe('function')
  })

  it('has correct type discriminator', () => {
    const adapter = new TimesfmWebAdapter()
    const t: ForecasterType = adapter.type
    expect(t).toBe('timesfm')
  })

  it('modelName reflects config', () => {
    const adapter = new TimesfmWebAdapter({ model: 'timesfm-2.5-200m' })
    expect(adapter.modelName).toContain('timesfm-2.5-200m')
  })

  it('default config is applied', () => {
    const adapter = new TimesfmWebAdapter()
    expect(adapter.modelName).toContain('timesfm-2.5-200m')
  })

  it('throws descriptive error when timesfm-web is not installed', async () => {
    const adapter = new TimesfmWebAdapter()
    await expect(adapter.forecast(makeData(30, i => 50 + i * 0.3), 5)).rejects.toThrow(/TimesFM Web is not installed/i)
  })

  it('error message includes fallback suggestion', async () => {
    const adapter = new TimesfmWebAdapter()
    try {
      await adapter.forecast(makeData(30, i => 50), 5)
      expect.fail('Should have thrown')
    } catch (e) {
      expect((e as Error).message).toContain('anofox-forecast')
    }
  })
})
