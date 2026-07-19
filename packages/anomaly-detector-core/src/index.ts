/**
 * @agentix-e/anomaly-detector-core
 *
 * Embedded time-series anomaly detection engine.
 * Dual-runtime: Node.js + Browser.
 *
 * @example
 * ```typescript
 * import { createDetector } from '@agentix-e/anomaly-detector-core'
 *
 * const detector = createDetector()
 * const result = await detector.analyze(point, history)
 * if (result.jointConfidence > 0.95) {
 *   // Handle anomaly — caller decides the threshold and action
 * }
 * ```
 *
 * @packageDocumentation
 */

// Re-export all types
export type {
  DataPoint,
  AnalyzedPoint,
  DetectionResult,
  ForecastResult,
  CalibrationResult,
  DimensionAttribution,
  DriftInfo,
  CalibrationMode,
  ForecasterType,
  AnalyzerState,
  DetectorConfig,
  DetectorHooks,
  AnalyzeEvent,
} from './types.js'

export type {
  IDetector,
  IForecaster,
  ICalibrator,
  IAnomalyDetector,
} from './types.js'

// Factory function (will be implemented in I1-I3)
export { createDetector } from './engine.js'
