export { createDetector } from '@agentix-e/anomaly-detector-core'
export { TimesfmNodeAdapter } from './adapter.js'
export type { TimesfmConfig } from './adapter.js'
export type * from '@agentix-e/anomaly-detector-core'

import { createDetector } from '@agentix-e/anomaly-detector-core'
import { TimesfmNodeAdapter } from './adapter.js'
import type { IAnomalyDetector, DetectorConfig } from '@agentix-e/anomaly-detector-core'

export function createNodeDetector(config?: DetectorConfig): IAnomalyDetector {
  if (config?.forecaster?.type === 'timesfm') {
    try {
      const adapter = new TimesfmNodeAdapter(config?.forecaster?.timesfm);
      (config as Record<string, unknown>)._customForecaster = adapter
      return createDetector(config)
    } catch {
      console.warn('TimesFM requested but not installed. Falling back to anofox-forecast.')
    }
  }
  return createDetector(config)
}
