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
 * ```ts
 * const detector = createNodeDetector({ forecaster: { type: 'timesfm' } })
 * ```
 */
export function createNodeDetector(
  config?: DetectorConfig & { forecaster?: { type?: ForecasterType; timesfm?: { model?: string; contextWindow?: number; horizon?: number } } }
): IAnomalyDetector {
  const fcType = config?.forecaster?.type

  if (fcType === 'timesfm') {
    try {
      const adapter = new TimesfmNodeAdapter(config?.forecaster?.timesfm)
      // Inject the adapter via the custom forecaster hook
      const cfg = { ...config }
      ;(cfg as any)._customForecaster = adapter
      return createDetector(cfg)
    } catch {
      console.warn('TimesFM requested but @agentix-e/timesfm-node is not installed. Falling back to anofox-forecast.')
    }
  }

  return createDetector(config)
}
