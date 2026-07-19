/**
 * JointConfidenceCalibrator — Bayesian fusion of detection + forecast signals.
 *
 * jointConfidence = α·grade + β·(1 - spread) + γ·hitRate + δ·driftPenalty
 */
import type { ICalibrator, DetectionResult, ForecastResult, DataPoint, CalibrationResult, CalibrationMode } from '../types.js'
import { HitRateTracker, clamp } from './forecast-guided.js'

export interface JointWeights { grade: number; spread: number; hitRate: number; drift: number }

export class JointConfidenceCalibrator implements ICalibrator {
  readonly mode: CalibrationMode = 'joint'
  private weights: JointWeights
  private hitTracker = new HitRateTracker()

  constructor(weights?: Partial<JointWeights>) {
    this.weights = { grade: 0.4, spread: 0.3, hitRate: 0.2, drift: 0.1, ...weights }
  }

  calibrate(detection: DetectionResult, forecast: ForecastResult, currentPoint: DataPoint): CalibrationResult {
    const predicted = forecast.predicted[0] ?? currentPoint.value
    const q10 = forecast.q10[0] ?? predicted
    const q90 = forecast.q90[0] ?? predicted
    const spread = q90 - q10
    const normalizedSpread = Math.abs(currentPoint.value) > 1e-10
      ? Math.min(spread / Math.abs(currentPoint.value), 1)
      : 0

    const residual = spread > 1e-10
      ? Math.abs(currentPoint.value - predicted) / (spread / 2)
      : Math.abs(currentPoint.value - predicted)

    const hitRate = this.hitTracker.getHitRate()
    const driftPenalty = detection.driftDetected ? -1 : 0

    const joint =
      this.weights.grade * detection.grade +
      this.weights.spread * (1 - normalizedSpread) +
      this.weights.hitRate * hitRate +
      this.weights.drift * driftPenalty

    const jointConfidence = clamp(joint, 0, 1)
    this.hitTracker.record(jointConfidence > 0.7, jointConfidence)

    return {
      mode: 'joint',
      residual,
      jointConfidence,
      intervalBreached: residual > 1,
    }
  }
}
