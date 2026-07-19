/**
 * @agentix-e/anomaly-detector-web — Browser entry point.
 *
 * Re-exports core + adds TimesfmWebAdapter.
 * Use createWebDetector() for a pre-configured browser detector.
 */
export { createDetector } from '@agentix-e/anomaly-detector-core'
export { TimesfmWebAdapter } from './adapter.js'
export type { TimesfmWebConfig } from './adapter.js'
export type * from '@agentix-e/anomaly-detector-core'

import { createDetector } from '@agentix-e/anomaly-detector-core'
import { TimesfmWebAdapter } from './adapter.js'
import type { IAnomalyDetector, DetectorConfig, ForecasterType } from '@agentix-e/anomaly-detector-core'

export function createWebDetector(config?: DetectorConfig & { forecaster?: { type?: ForecasterType } }): IAnomalyDetector {
  const fcType = config?.forecaster?.type

  if (fcType === 'timesfm') {
    try {
      new TimesfmWebAdapter(config?.forecaster?.timesfm)
      return createDetector({ ...config, forecaster: { type: 'custom' } })
    } catch {
      console.warn('TimesFM Web requested but not installed. Falling back to anofox-forecast.')
    }
  }

  return createDetector(config)
}
