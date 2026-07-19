/**
 * @agentix-e/anomaly-detector-node
 *
 * Node.js entry point for anomaly-detector.
 * Adds TimesFM foundation-model forecasting via ONNX Runtime.
 *
 * @example
 * ```typescript
 * import { createNodeDetector } from '@agentix-e/anomaly-detector-node'
 *
 * const detector = createNodeDetector({ forecaster: { type: 'timesfm' } })
 * const result = await detector.analyze(point, history)
 * ```
 *
 * @packageDocumentation
 */

export { createDetector } from '@agentix-e/anomaly-detector-core'
export type * from '@agentix-e/anomaly-detector-core'

/**
 * Create a Node.js-optimized anomaly detector.
 * Enables TimesFM support when @agentix-e/timesfm-node is installed.
 *
 * TODO(I4): Implement TimesfmNodeAdapter + createNodeDetector factory.
 */
export function createNodeDetector() {
  throw new Error(
    'createNodeDetector() not yet implemented (I4). ' +
    'Use createDetector() from @agentix-e/anomaly-detector-core instead.'
  )
}
