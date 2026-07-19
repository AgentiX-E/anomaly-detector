export { TimesfmWebAdapter } from './adapter.js'
export type { TimesfmWebConfig } from './adapter.js'
export type { DataPoint, ForecastResult, ForecasterType, IForecaster } from './adapter.js'

// Re-export core for convenience (callers who want createDetector etc.)
export { createDetector } from '@agentix-e/anomaly-detector-core'
export type { AnalyzedPoint, DetectionResult, CalibrationResult, DimensionAttribution, DriftInfo, DetectorConfig, IAnomalyDetector } from '@agentix-e/anomaly-detector-core'

import { createDetector } from '@agentix-e/anomaly-detector-core'
import { TimesfmWebAdapter } from './adapter.js'
import type { IAnomalyDetector, DetectorConfig, ForecasterType } from '@agentix-e/anomaly-detector-core'

export function createWebDetector(
  config?: DetectorConfig & { forecaster?: { type?: ForecasterType; timesfm?: TimesfmWebConfig } }
): IAnomalyDetector {
  if (config?.forecaster?.type === 'timesfm') {
    try {
      const adapter = new TimesfmWebAdapter(config?.forecaster?.timesfm);
      (config as Record<string, unknown>)._customForecaster = adapter
      return createDetector(config)
    } catch {
      console.warn('TimesFM Web requested but not installed. Falling back to anofox-forecast.')
    }
  }
  return createDetector(config)
}
