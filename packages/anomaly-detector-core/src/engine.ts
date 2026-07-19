/**
 * Factory — creates an IAnomalyDetector with default implementations.
 *
 * Architecture:
 *   IDetector    → TrcfDetector (wrapping @beshu-tech/trcf-ts)
 *   IForecaster  → AnofoxForecaster (wrapping @sipemu/anofox-forecast) — I2
 *   ICalibrator  → ForecastGuidedCalibrator — I3
 *
 * All components are replaceable via DI through DetectorConfig.
 *
 * @module engine
 */

import { TrcfDetector } from './detect/trcf-detector.js'
import type {
  IAnomalyDetector,
  DetectorConfig,
  AnalyzedPoint,
  DataPoint,
  DetectionResult,
  ForecastResult,
  AnalyzerState,
} from './types.js'

/**
 * Create an anomaly detector with sensible defaults.
 *
 * Zero-config usage:
 * ```ts
 * import { createDetector } from '@agentix-e/anomaly-detector-core'
 * const detector = createDetector()
 * const result = await detector.analyze(point, history)
 * ```
 *
 * Full customization:
 * ```ts
 * const detector = createDetector({
 *   detector: { trcf: { windowSize: 512, anomalyRate: 0.01 } },
 *   drift: { detector: 'kswin' }
 * })
 * ```
 *
 * @param config - Optional detector configuration (all fields optional)
 * @returns A fully configured IAnomalyDetector
 */
export function createDetector(config?: DetectorConfig): IAnomalyDetector {
  const trcfConfig = config?.detector?.trcf
  const driftConfig = config?.detector?.drift
  const attributionConfig = config?.detector?.attribution

  const detector = new TrcfDetector({
    windowSize: trcfConfig?.windowSize ?? 256,
    anomalyRate: trcfConfig?.anomalyRate ?? 0.005,
    numberOfTrees: trcfConfig?.numberOfTrees ?? 30,
    normalize: trcfConfig?.normalize ?? true,
    attributionEnabled: attributionConfig?.enabled ?? true,
    driftEnabled: driftConfig?.enabled ?? true,
    driftDetector: driftConfig?.detector ?? 'adwin',
  })

  const hooks = config?.hooks

  return {
    async analyze(
      point: DataPoint,
      context: DataPoint[],
      opts?: { signal?: AbortSignal }
    ): Promise<AnalyzedPoint> {
      const t0 = Date.now()
      const dResult = detect(point, context)
      const t1 = Date.now()

      // TODO(I2): Replace with real forecast
      const fResult: ForecastResult = {
        predicted: [],
        q10: [],
        q90: [],
        horizon: 0,
        modelName: 'pending(I2)',
        predictedAt: Date.now(),
      }
      const t2 = Date.now()

      // TODO(I3): Replace with real calibration
      const t3 = Date.now()

      const result: AnalyzedPoint = {
        isAnomaly: dResult.isAnomaly,
        grade: dResult.grade,
        score: dResult.score,
        threshold: dResult.threshold,
        detectionConfidence: dResult.confidence,
        attribution: dResult.attribution,
        driftDetected: dResult.driftDetected,
        driftDetails: dResult.driftDetails,
        predicted: fResult.predicted,
        q10: fResult.q10,
        q90: fResult.q90,
        horizon: fResult.horizon,
        jointConfidence: dResult.confidence,
        residual: 0,
        intervalBreached: false,
        calibrationMode: 'forecast-guided',
        analyzedAt: Date.now(),
        forecasterUsed: 'pending(I2)',
        metadata: {},
      }

      hooks?.onAnalyze?.({
        input: { point, contextLength: context.length },
        output: result,
        duration: { detect: t1 - t0, forecast: t2 - t1, calibrate: t3 - t2, total: Date.now() - t0 },
        forecasterUsed: result.forecasterUsed,
      })

      if (result.isAnomaly) {
        hooks?.onAnomaly?.(result)
      }
      if (result.driftDetected && result.driftDetails) {
        hooks?.onDrift?.(result.driftDetails)
      }

      return result
    },

    detect(point: DataPoint, context: DataPoint[]): DetectionResult {
      return detector.detect(point, context)
    },

    async forecast(_context: DataPoint[], _horizon: number): Promise<ForecastResult> {
      throw new Error('forecast() not yet implemented. Scheduled for I2.')
    },

    async warmup(): Promise<number> {
      const t0 = Date.now()
      // Feed a dummy point to trigger TRCF warmup
      detector.detect({ value: 0, timestamp: Date.now() }, [])
      return Date.now() - t0
    },

    reset(): void {
      detector.reset()
    },

    getState(): AnalyzerState {
      return {
        version: 1,
        createdAt: Date.now(),
        detectorState: detector.getState(),
        calibrationParams: {},
      }
    },

    setState(state: AnalyzerState): void {
      detector.setState(state.detectorState)
    },
  }
}
