/**
 * ForecastGuidedCalibrator — default calibration mode.
 *
 * Measures how far the actual value deviates from the prediction interval.
 * Residual > 1 means the value is outside the interval.
 * jointConfidence amplifies TRCF confidence when the residual confirms the anomaly.
 */
import type { ICalibrator, DetectionResult, ForecastResult, DataPoint, CalibrationResult, CalibrationMode } from '../types.js'

export class ForecastGuidedCalibrator implements ICalibrator {
  readonly mode: CalibrationMode = 'forecast-guided'
  private hitRateTracker = new HitRateTracker()

  calibrate(detection: DetectionResult, forecast: ForecastResult, currentPoint: DataPoint): CalibrationResult {
    const predicted = forecast.predicted[0] ?? currentPoint.value
    const q10 = forecast.q10[0] ?? predicted
    const q90 = forecast.q90[0] ?? predicted
    const spread = q90 - q10

    const residual = spread > 1e-10
      ? Math.abs(currentPoint.value - predicted) / (spread / 2)
      : Math.abs(currentPoint.value - predicted)

    const intervalBreached = currentPoint.value < q10 || currentPoint.value > q90

    // TRCF confidence amplified by residual — residual > 3 saturates the bonus
    const residualBonus = Math.min(residual / 3, 1)
    const jointConfidence = clamp(detection.confidence * (1 + residualBonus * 0.5), 0, 1)

    // Track hit rate for future calibration rounds
    this.hitRateTracker.record(jointConfidence > 0.7, jointConfidence)

    return { mode: 'forecast-guided', residual, jointConfidence, intervalBreached }
  }
}

/** Rolling hit-rate tracker for calibration feedback. */
class HitRateTracker {
  private history: { hit: boolean; score: number }[] = []
  private maxSize = 100

  record(isHit: boolean, score: number): void {
    this.history.push({ hit: isHit, score })
    if (this.history.length > this.maxSize) this.history.shift()
  }

  getHitRate(): number {
    if (this.history.length === 0) return 0.5
    const hits = this.history.filter((h) => h.hit).length
    return hits / this.history.length
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// Re-export for other calibrators
export { HitRateTracker, clamp }
