/**
 * Factory function — creates an IAnomalyDetector with default implementations.
 * All components are replaceable via DI (DetectorConfig).
 *
 * TODO(I1): Implement detect module — TrcfDetector + Attribution + Drift
 * TODO(I2): Implement forecast module — AnofoxForecaster + AutoModelSelector
 * TODO(I3): Implement calibrate module — 3 calibrators + utility functions
 *
 * @file Stub file — all code replaced in I1-I3.
 */
/* eslint-disable @typescript-eslint/require-await */
import type { IAnomalyDetector, DetectorConfig, AnalyzedPoint, DataPoint, DetectionResult, ForecastResult, AnalyzerState } from './types.js'

/**
 * Create an anomaly detector with sensible defaults.
 *
 * @param _config - Optional detector configuration (all fields optional)
 * @returns A fully configured IAnomalyDetector
 */
export function createDetector(_config?: DetectorConfig): IAnomalyDetector {
  // TODO(I1-I3): Replace stub with full implementation
  return {
    async analyze(_point: DataPoint, _context: DataPoint[], _opts?: { signal?: AbortSignal }): Promise<AnalyzedPoint> {
      throw new Error(
        'analyze() not yet implemented. This stub will be replaced in I1-I3. ' +
        'See: https://github.com/AgentiX-E/anomaly-detector'
      )
    },

    detect(_point: DataPoint, _context: DataPoint[]): DetectionResult {
      throw new Error('detect() not yet implemented (I1).')
    },

    async forecast(_context: DataPoint[], _horizon: number): Promise<ForecastResult> {
      throw new Error('forecast() not yet implemented (I2).')
    },

    async warmup(): Promise<number> {
      throw new Error('warmup() not yet implemented.')
    },

    reset(): void {
      throw new Error('reset() not yet implemented.')
    },

    getState(): AnalyzerState {
      throw new Error('getState() not yet implemented.')
    },

    setState(_state: AnalyzerState): void {
      throw new Error('setState() not yet implemented.')
    },
  }
}
