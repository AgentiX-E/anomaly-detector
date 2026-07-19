/**
 * @agentix-e/anomaly-detector-core — Core Type Definitions
 *
 * All interfaces follow the agentix-e DI pattern:
 * contracts are defined here, implementations are injected via the factory.
 *
 * Dual-runtime compatible (Node.js + Browser). Zero platform-specific dependencies.
 */

// ============================================================================
// Input
// ============================================================================

/** A single data point fed into the detector. */
export interface DataPoint {
  /** Primary metric value. For multivariate scenarios, this is the main variable. */
  value: number
  /** Unix timestamp in milliseconds. */
  timestamp: number
  /**
   * Multivariate dimension values.
   * Key = dimension name, value = dimension value.
   * Omitted for univariate scenarios.
   *
   * @example { cpu: 85.2, memory: 72.1, disk_io: 150 }
   */
  dimensions?: Record<string, number>
  /** Extension metadata (labels, source, metric name, etc.). */
  metadata?: Record<string, unknown>
}

// ============================================================================
// Primary Output
// ============================================================================

/**
 * The primary output of the detector.
 * All fields are analysis results — NOT business decisions.
 * The caller uses `jointConfidence` to make their own alerting choices.
 */
export interface AnalyzedPoint {
  // ── Detection ──
  /** Whether the current point is classified as anomalous. */
  isAnomaly: boolean
  /** TRCF anomaly grade [0, 1]. Higher = more severe. */
  grade: number
  /** Raw TRCF anomaly score. */
  score: number
  /** Current adaptive detection threshold. */
  threshold: number
  /** TRCF confidence [0, 1]. */
  detectionConfidence: number

  // ── Attribution ──
  /** Per-dimension contribution to the anomaly score. */
  attribution: DimensionAttribution[]

  // ── Drift ──
  /** Whether concept drift was detected. */
  driftDetected: boolean
  /** Drift details if detected. */
  driftDetails?: DriftInfo

  // ── Forecast ──
  /** Point forecasts for the next `horizon` steps. */
  predicted: number[]
  /** Lower 10th percentile forecast. */
  q10: number[]
  /** Upper 90th percentile forecast. */
  q90: number[]
  /** Forecast horizon length in steps. */
  horizon: number

  // ── Calibration ★ Core Output ──
  /**
   * Joint confidence [0, 1].
   * Fuses TRCF score + forecast spread + historical hit rate.
   * This is the single value callers use for their own alert thresholds.
   */
  jointConfidence: number
  /** Normalized residual: |actual - predicted| / (spread / 2). */
  residual: number
  /** Whether the actual value fell outside the prediction interval. */
  intervalBreached: boolean
  /** Which calibration mode produced this result. */
  calibrationMode: CalibrationMode

  // ── Metadata ──
  /** Timestamp when analysis was performed. */
  analyzedAt: number
  /** Which forecaster was used. */
  forecasterUsed: string
  /** Extension metadata — the only extension point. */
  metadata: Record<string, unknown>
}

// ============================================================================
// Intermediate Results
// ============================================================================

/** Result from the IDetector. */
export interface DetectionResult {
  isAnomaly: boolean
  grade: number
  score: number
  threshold: number
  confidence: number
  attribution: DimensionAttribution[]
  driftDetected: boolean
  driftDetails?: DriftInfo
  detectedAt: number
  metadata?: Record<string, unknown>
}

/** Result from the IForecaster. */
export interface ForecastResult {
  predicted: number[]
  q10: number[]
  q90: number[]
  horizon: number
  modelName: string
  predictedAt: number
  metadata?: Record<string, unknown>
}

/** Result from the ICalibrator. */
export interface CalibrationResult {
  mode: CalibrationMode
  residual: number
  jointConfidence: number
  intervalBreached: boolean
  isContaminated?: boolean
  metadata?: Record<string, unknown>
}

// ============================================================================
// Attribution & Drift
// ============================================================================

/** Per-dimension anomaly contribution. */
export interface DimensionAttribution {
  /** Dimension name. */
  dimension: string
  /** Contribution [-1, 1]. Positive = pushed anomaly score higher. */
  contribution: number
  /** Confidence [0, 1]. */
  confidence: number
}

/** Concept drift information. */
export interface DriftInfo {
  /** Which drift detector fired. */
  detector: 'adwin' | 'kswin'
  /** Timestamp when drift was detected. */
  detectedAt: number
  /** Mean before the drift point. */
  preDriftMean: number
  /** Mean after the drift point. */
  postDriftMean: number
  /** Drift magnitude in standard deviations. */
  magnitude: number
}

// ============================================================================
// Enums
// ============================================================================

/** Calibration mode. */
export type CalibrationMode = 'forecast-guided' | 'anomaly-guided' | 'joint'

/** Forecaster backend type. */
export type ForecasterType = 'anofox' | 'timesfm' | 'custom'

// ============================================================================
// DI Token Interfaces
// ============================================================================

/**
 * Detector interface — encapsulates anomaly detection.
 * Default implementation: TrcfDetector (wrapping trcf-ts).
 */
export interface IDetector {
  /**
   * Detect anomaly on a single data point.
   * @param point - Current data point
   * @param context - Historical context (recent N data points)
   */
  detect(point: DataPoint, context: DataPoint[]): DetectionResult
  /** Export detector state for serialization. */
  getState(): Uint8Array
  /** Restore detector from serialized state. */
  setState(state: Uint8Array): void
  /** Reset internal detector state. */
  reset(): void
}

/**
 * Forecaster interface — encapsulates time-series forecasting.
 * Default implementation: AnofoxForecaster (wrapping anofox-forecast, WASM).
 */
export interface IForecaster {
  /**
   * Generate forecast based on historical context.
   * @param context - Historical data points
   * @param horizon - Number of steps to predict
   */
  forecast(context: DataPoint[], horizon: number): Promise<ForecastResult>
  /** Name of the currently selected model. */
  readonly modelName: string
  /** Forecaster backend type. */
  readonly type: ForecasterType
}

/**
 * Calibrator interface — fuses detection and forecast into joint confidence.
 * Three built-in modes: forecast-guided, anomaly-guided, joint.
 */
export interface ICalibrator {
  /**
   * Calibrate — fuse detection and forecast results.
   * @param detection - Detection result from IDetector
   * @param forecast - Forecast result from IForecaster
   * @param currentPoint - The current data point being analyzed
   */
  calibrate(
    detection: DetectionResult,
    forecast: ForecastResult,
    currentPoint: DataPoint
  ): CalibrationResult
  /** Current calibration mode. */
  readonly mode: CalibrationMode
}

/**
 * Main anomaly detector orchestrator.
 * Coordinates detect → forecast → calibrate pipeline.
 */
export interface IAnomalyDetector {
  /**
   * One-shot analysis: full detect → forecast → calibrate pipeline.
   * @param point - Current data point
   * @param context - Historical context
   * @param opts - Options (AbortSignal for cancellation)
   */
  analyze(
    point: DataPoint,
    context: DataPoint[],
    opts?: { signal?: AbortSignal }
  ): Promise<AnalyzedPoint>
  /** Detection only (no forecast or calibration). */
  detect(point: DataPoint, context: DataPoint[]): DetectionResult
  /** Forecast only (no detection or calibration). */
  forecast(context: DataPoint[], horizon: number): Promise<ForecastResult>
  /** Preload WASM / ONNX runtime. Returns warmup duration in ms. */
  warmup(): Promise<number>
  /** Reset all internal state. */
  reset(): void
  /** Export engine state for persistence. */
  getState(): AnalyzerState
  /** Restore engine from persisted state. */
  setState(state: AnalyzerState): void
}

// ============================================================================
// State
// ============================================================================

/** Serializable engine state. */
export interface AnalyzerState {
  /** Schema version (increment on backward-compatible changes). */
  version: number
  /** ISO timestamp of state creation. */
  createdAt: number
  /** Raw detector state (trcf-ts getState() output). */
  detectorState: Uint8Array
  /** Dynamic calibration parameters (hit rate, etc.). */
  calibrationParams: Record<string, number>
}

// ============================================================================
// Configuration
// ============================================================================

/** Full detector configuration — every field is optional with sensible defaults. */
export interface DetectorConfig {
  detector?: {
    type: 'trcf'
    trcf?: {
      windowSize?: number
      anomalyRate?: number
      numberOfTrees?: number
      normalize?: boolean
    }
    attribution?: {
      enabled?: boolean
      method?: 'leave-one-out'
    }
    drift?: {
      enabled?: boolean
      detector?: 'adwin' | 'kswin'
    }
  }
  forecaster?: {
    type?: 'anofox' | 'timesfm' | 'custom'
    anofox?: {
      autoSelect?: boolean
      forceModel?: string
      seasonalPeriod?: number
    }
    timesfm?: {
      model?: string
      contextWindow?: number
      horizon?: number
      useContinuousQuantileHead?: boolean
    }
  }
  calibrator?: {
    mode?: CalibrationMode
    jointWeights?: {
      grade?: number
      spread?: number
      hitRate?: number
      drift?: number
    }
    contaminationThreshold?: number
  }
  /** Lifecycle hooks for observability. */
  hooks?: DetectorHooks
}

/** Lifecycle hooks — inject monitoring/logging without modifying the pipeline. */
export interface DetectorHooks {
  /** Fired after each analyze() completes. */
  onAnalyze?: (event: AnalyzeEvent) => void
  /** Fired when an anomaly is detected. */
  onAnomaly?: (result: AnalyzedPoint) => void
  /** Fired when concept drift is detected. */
  onDrift?: (info: DriftInfo) => void
  /** Fired on errors (caught, does not propagate). */
  onError?: (error: Error, context: Record<string, unknown>) => void
  /** Fired when WASM initialization completes. */
  onWasmReady?: (duration: number) => void
}

/** Event payload for onAnalyze hook. */
export interface AnalyzeEvent {
  input: { point: DataPoint; contextLength: number }
  output: AnalyzedPoint
  duration: { detect: number; forecast: number; calibrate: number; total: number }
  forecasterUsed: string
}
