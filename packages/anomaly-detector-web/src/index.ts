export { createDetector } from '@agentix-e/anomaly-detector-core'
export { TimesfmWebAdapter } from './adapter.js'
export type { TimesfmWebConfig } from './adapter.js'
export type * from '@agentix-e/anomaly-detector-core'

import { createDetector } from '@agentix-e/anomaly-detector-core'
import { TimesfmWebAdapter } from './adapter.js'
import type { IAnomalyDetector, DetectorConfig, ForecasterType } from '@agentix-e/anomaly-detector-core'

export function createWebDetector(
  config?: DetectorConfig & { forecaster?: { type?: ForecasterType; timesfm?: { model?: string; contextWindow?: number; horizon?: number } } }
): IAnomalyDetector {
  if (config?.forecaster?.type === 'timesfm') {
    try {
      const adapter = new TimesfmWebAdapter(config?.forecaster?.timesfm)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(config as any)._customForecaster = adapter
      return createDetector(config)
    } catch {
      console.warn('TimesFM Web requested but not installed. Falling back to anofox-forecast.')
    }
  }
  return createDetector(config)
}
