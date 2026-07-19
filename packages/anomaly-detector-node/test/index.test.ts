import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the core createDetector
vi.mock('@agentix-e/anomaly-detector-core', () => ({
  createDetector: vi.fn((config?: unknown) => ({ config, _type: 'mock-detector' })),
}))

// Mock the adapter
vi.mock('../src/adapter.js', () => ({
  TimesfmNodeAdapter: vi.fn(function (this: Record<string,unknown>, config?: unknown) {
    this.type = 'timesfm'
    this.modelName = 'TimesFM-mock'
    this.config = config
  }),
}))

import { createDetector } from '@agentix-e/anomaly-detector-core'
import { TimesfmNodeAdapter } from '../src/adapter.js'
import { createNodeDetector } from '../src/index.js'

const mockCreateDetector = createDetector as ReturnType<typeof vi.fn>
const mockAdapter = TimesfmNodeAdapter as ReturnType<typeof vi.fn>

describe('createNodeDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to createDetector when forecaster type is not timesfm', () => {
    const result = createNodeDetector({ forecaster: { type: 'theta' } })
    expect(mockCreateDetector).toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it('delegates to createDetector with no config', () => {
    const result = createNodeDetector()
    expect(mockCreateDetector).toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it('creates TimesfmNodeAdapter when forecaster type is timesfm', () => {
    const config = { forecaster: { type: 'timesfm' as const, timesfm: { model: 'test-model' } } }
    createNodeDetector(config)
    expect(mockAdapter).toHaveBeenCalled()
    expect(mockCreateDetector).toHaveBeenCalled()
  })

  it('falls back when TimesfmNodeAdapter throws', () => {
    mockAdapter.mockImplementationOnce(() => { throw new Error('Boom') })
    const config = { forecaster: { type: 'timesfm' as const } }
    const result = createNodeDetector(config)
    expect(result).toBeDefined()
    expect(mockCreateDetector).toHaveBeenCalled()
  })

  it('returns IAnomalyDetector-compatible object', () => {
    const result = createNodeDetector()
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })
})
