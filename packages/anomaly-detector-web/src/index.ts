/**
 * @agentix-e/anomaly-detector-web
 *
 * Browser entry point for anomaly-detector.
 * Adds TimesFM foundation-model forecasting via ONNX Runtime Web.
 *
 * @example
 * ```typescript
 * import { createWebDetector } from '@agentix-e/anomaly-detector-web'
 *
 * const detector = createWebDetector({ forecaster: { type: 'timesfm' } })
 * const result = await detector.analyze(point, history)
 * ```
 *
 * @packageDocumentation
 */

export { createDetector } from '@agentix-e/anomaly-detector-core'
export type * from '@agentix-e/anomaly-detector-core'

/**
 * Create a browser-optimized anomaly detector.
 * Enables TimesFM support when @agentix-e/timesfm-web is installed.
 *
 * TODO(I4): Implement TimesfmWebAdapter + createWebDetector factory.
 */
export function createWebDetector() {
  throw new Error(
    'createWebDetector() not yet implemented (I4). ' +
    'Use createDetector() from @agentix-e/anomaly-detector-core instead.'
  )
}
