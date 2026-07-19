/**
 * AnomalyGuidedCalibrator — marks contamination windows and refits.
 *
 * When sustained anomalies are detected, marks the window as contaminated
 * so that the forecast baseline is recalculated on clean data only.
 */
import type { ICalibrator, DetectionResult, ForecastResult, DataPoint, CalibrationResult, CalibrationMode } from '../types.js'
import { clamp } from './forecast-guided.js'

export class AnomalyGuidedCalibrator implements ICalibrator {
  readonly mode: CalibrationMode = 'anomaly-guided'
  private contaminated = false
  private consecutiveAnomalies = 0
  private readonly threshold = 3 // consecutive anomalies to trigger contamination

  calibrate(detection: DetectionResult, forecast: ForecastResult, currentPoint: DataPoint): CalibrationResult {
    const spread = (forecast.q90[0] ?? 0) - (forecast.q10[0] ?? 0)
    const predicted = forecast.predicted[0] ?? currentPoint.value
    const residual = spread > 1e-10
      ? Math.abs(currentPoint.value - predicted) / (spread / 2)
      : Math.abs(currentPoint.value - predicted)

    if (detection.isAnomaly) {
      this.consecutiveAnomalies++
    } else {
      this.consecutiveAnomalies = 0
      this.contaminated = false
    }

    if (this.consecutiveAnomalies >= this.threshold) {
      this.contaminated = true
    }

    // When contaminated, reduce confidence because baseline may be polluted
    const contaminationPenalty = this.contaminated ? 0.3 : 0
    const jointConfidence = clamp(detection.confidence - contaminationPenalty, 0, 1)

    return {
      mode: 'anomaly-guided',
      residual,
      jointConfidence,
      intervalBreached: residual > 1,
      isContaminated: this.contaminated,
    }
  }
}
