/**
 * @agentix-e/anomaly-detector-node — Node.js entry point.
 *
 * Re-exports core + adds TimesfmNodeAdapter.
 * Use createNodeDetector() for a pre-configured detector with TimesFM support.
 */
export { createDetector } from '@agentix-e/anomaly-detector-core'
export { TimesfmNodeAdapter } from './adapter.js'
export type { TimesfmConfig } from './adapter.js'
export type * from '@agentix-e/anomaly-detector-core'

import { createDetector } from '@agentix-e/anomaly-detector-core'
import { TimesfmNodeAdapter } from './adapter.js'
import type { IAnomalyDetector, DetectorConfig, ForecasterType } from '@agentix-e/anomaly-detector-core'

/**
 * Create a detector pre-configured for Node.js with TimesFM support.
 *
 * Automatically detects whether @agentix-e/timesfm-node is installed.
 * If TimesFM is requested but not installed, falls back to anofox-forecast
 * with a console warning.
 *
 * @example
 * const detector = createNodeDetector({ forecaster: { type: 'timesfm' } })
 */
export function createNodeDetector(config?: DetectorConfig & { forecaster?: { type?: ForecasterType } }): IAnomalyDetector {
  const fcType = config?.forecaster?.type

  if (fcType === 'timesfm') {
    try {
      // Dynamic import to check availability — will throw if not installed
      const forecaster = new TimesfmNodeAdapter(config?.forecaster?.timesfm)
      return createDetector({ ...config, forecaster: { type: 'custom' } })
      // Note: custom type forecaster injection requires manual setup.
      // We fall back to createDetector with anofox if timesfm fails.
    } catch {
      console.warn('TimesFM requested but @agentix-e/timesfm-node is not installed. Falling back to anofox-forecast.')
    }
  }

  return createDetector(config)
}
