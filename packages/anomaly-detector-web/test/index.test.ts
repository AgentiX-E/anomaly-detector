import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the core createDetector
vi.mock('@agentix-e/anomaly-detector-core', () => ({
  createDetector: vi.fn((config?: unknown) => ({ config, _type: 'mock-detector' })),
}))

// Mock the web adapter
vi.mock('../src/adapter.js', () => ({
  TimesfmWebAdapter: vi.fn(function (this: Record<string,unknown>, config?: unknown) {
    this.type = 'timesfm'
    this.modelName = 'TimesFM-Web-mock'
    this.config = config
  }),
}))

import { createDetector } from '@agentix-e/anomaly-detector-core'
import { TimesfmWebAdapter } from '../src/adapter.js'
import { createWebDetector } from '../src/index.js'

const mockCreateDetector = createDetector as ReturnType<typeof vi.fn>
const mockAdapter = TimesfmWebAdapter as ReturnType<typeof vi.fn>

describe('createWebDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to createDetector when forecaster type is not timesfm', () => {
    const result = createWebDetector({ forecaster: { type: 'theta' } })
    expect(mockCreateDetector).toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it('delegates to createDetector with no config', () => {
    const result = createWebDetector()
    expect(mockCreateDetector).toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it('creates TimesfmWebAdapter when forecaster type is timesfm', () => {
    const config = { forecaster: { type: 'timesfm' as const, timesfm: { model: 'test-model' } } }
    createWebDetector(config)
    expect(mockAdapter).toHaveBeenCalled()
    expect(mockCreateDetector).toHaveBeenCalled()
  })

  it('falls back when TimesfmWebAdapter throws', () => {
    mockAdapter.mockImplementationOnce(() => { throw new Error('Boom') })
    const config = { forecaster: { type: 'timesfm' as const } }
    const result = createWebDetector(config)
    expect(result).toBeDefined()
    expect(mockCreateDetector).toHaveBeenCalled()
  })

  it('returns IAnomalyDetector-compatible object', () => {
    const result = createWebDetector()
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })

  it('passes timesfm config to adapter', () => {
    const timesfmConfig = { modelUrl: 'https://cdn.example.com/model.onnx', executionProvider: 'webgl' }
    createWebDetector({
      forecaster: { type: 'timesfm' as const, timesfm: timesfmConfig },
    })
    expect(mockAdapter).toHaveBeenCalledWith(timesfmConfig)
  })
})
