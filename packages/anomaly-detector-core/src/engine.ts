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
import { AnofoxForecaster } from './forecast/anofox-adapter.js'
import { ForecastGuidedCalibrator } from './calibrate/forecast-guided.js'
import { JointConfidenceCalibrator } from './calibrate/joint.js'
import { AnomalyGuidedCalibrator } from './calibrate/anomaly-guided.js'
import type {
  IAnomalyDetector,
  IForecaster,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customForecaster = (config as any)?._customForecaster as IForecaster | undefined
  const forecaster = customForecaster ?? new AnofoxForecaster(config?.forecaster?.anofox?.autoSelect ?? true)
  const calibrator = createCalibrator(config?.calibrator?.mode ?? 'forecast-guided', config?.calibrator?.jointWeights)

  const DEFAULT_HORIZON = 10

  return {
    async analyze(
      point: DataPoint,
      context: DataPoint[],
      opts?: { signal?: AbortSignal }
    ): Promise<AnalyzedPoint> {
      const t0 = Date.now()
      const dResult = detector.detect(point, context)
      const t1 = Date.now()

      const h = context.length > 0 ? Math.min(32, Math.floor(context.length / 4)) : DEFAULT_HORIZON
      const fResult = await forecaster.forecast(context, h)
      const t2 = Date.now()

      const t3_0 = Date.now()
      const calResult = calibrator.calibrate(dResult, fResult, point)
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
        jointConfidence: calResult.jointConfidence,
        residual: calResult.residual,
        intervalBreached: calResult.intervalBreached,
        calibrationMode: calResult.mode,
        analyzedAt: Date.now(),
        forecasterUsed: fResult.modelName,
        metadata: point.metadata ?? {},
      }

      hooks?.onAnalyze?.({
        input: { point, contextLength: context.length },
        output: result,
        duration: { detect: t1 - t0, forecast: t2 - t1, calibrate: t3 - t3_0, total: Date.now() - t0 },
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

    async forecast(context: DataPoint[], horizon: number): Promise<ForecastResult> {
      return forecaster.forecast(context, horizon)
    },

    async warmup(): Promise<number> {
      const t0 = Date.now()
      detector.detect({ value: 0, timestamp: Date.now() }, [])
      // Also warm up the forecaster WASM
      await forecaster.forecast([{ value: 0, timestamp: Date.now() }], 1)
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

function createCalibrator(mode: string, weights?: { grade?: number; spread?: number; hitRate?: number; drift?: number }) {
  switch (mode) {
    case 'joint': return new JointConfidenceCalibrator(weights)
    case 'anomaly-guided': return new AnomalyGuidedCalibrator()
    default: return new ForecastGuidedCalibrator()
  }
}
