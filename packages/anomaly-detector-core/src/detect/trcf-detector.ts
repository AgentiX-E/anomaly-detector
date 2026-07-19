/**
 * TrcfDetector — wraps @beshu-tech/trcf-ts with attribution and drift detection.
 *
 * Supports both univariate and multivariate scenarios. Multivariate mode is
 * auto-detected when DataPoint.dimensions is present AND non-empty.
 *
 * @module detect/trcf-detector
 */

import {
  createTimeSeriesDetector,
  createMultiVariateDetector,
} from '@beshu-tech/trcf-ts'
import type { AnomalyDetector } from '@beshu-tech/trcf-ts'
import type {
  DataPoint,
  DetectionResult,
  DimensionAttribution,
  IDetector,
} from '../types.js'
import { DimensionAttributor } from './attribution.js'
import { DriftDetector } from './drift.js'

export interface TrcfDetectorConfig {
  windowSize: number
  anomalyRate: number
  numberOfTrees: number
  normalize: boolean
  attributionEnabled: boolean
  driftEnabled: boolean
  driftDetector: 'adwin' | 'kswin'
}

const DEFAULT_CONFIG: TrcfDetectorConfig = {
  windowSize: 256,
  anomalyRate: 0.005,
  numberOfTrees: 30,
  normalize: true,
  attributionEnabled: true,
  driftEnabled: true,
  driftDetector: 'adwin',
}

export class TrcfDetector implements IDetector {
  private detector: AnomalyDetector
  private config: TrcfDetectorConfig
  private attributor: DimensionAttributor | null
  private driftDetector: DriftDetector | null
  private dimensionNames: string[] = []
  private isMultivariate = false

  constructor(config?: Partial<TrcfDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    const trcfConfig = {
      anomalyRate: this.config.anomalyRate,
      windowSize: this.config.windowSize,
      numberOfTrees: this.config.numberOfTrees,
      normalize: this.config.normalize,
    }
    this.detector = createTimeSeriesDetector(trcfConfig)
    this.attributor = this.config.attributionEnabled ? new DimensionAttributor() : null
    this.driftDetector = this.config.driftEnabled
      ? new DriftDetector(this.config.driftDetector)
      : null
  }

  detect(point: DataPoint, _context: DataPoint[]): DetectionResult {
    this.ensureDetectorType(point)
    const inputArray = this.toInputArray(point)
    const raw = this.detector.detect(inputArray, point.timestamp)

    let driftDetected = false
    let driftDetails = undefined
    if (this.driftDetector) {
      const driftResult = this.driftDetector.update(point.value)
      driftDetected = driftResult.detected
      driftDetails = driftResult.detected ? driftResult.info : undefined
    }

    // Compute attribution for multivariate only
    const attribution = this.computeAttribution(point, inputArray, raw.score)

    return {
      isAnomaly: raw.isAnomaly,
      grade: raw.grade,
      score: raw.score,
      threshold: raw.threshold,
      confidence: raw.confidence,
      attribution,
      driftDetected,
      driftDetails,
      detectedAt: Date.now(),
    }
  }

  getState(): Uint8Array {
    const state = {
      config: this.config,
      isMultivariate: this.isMultivariate,
      dimensionNames: this.dimensionNames,
      trcfState: this.detector.getState(),
      driftState: this.driftDetector?.getState() ?? null,
    }
    return new TextEncoder().encode(JSON.stringify(state))
  }

  setState(state: Uint8Array): void {
    const parsed = JSON.parse(new TextDecoder().decode(state))
    this.config = { ...DEFAULT_CONFIG, ...parsed.config }
    this.isMultivariate = parsed.isMultivariate ?? false
    this.dimensionNames = parsed.dimensionNames ?? []
    this.attributor = this.config.attributionEnabled ? new DimensionAttributor() : null
    this.recreateDetector()
    this.driftDetector = this.config.driftEnabled
      ? (parsed.driftState ? DriftDetector.fromState(parsed.driftState) : new DriftDetector(this.config.driftDetector))
      : null
  }

  reset(): void {
    this.isMultivariate = false
    this.dimensionNames = []
    this.recreateDetector()
    this.driftDetector?.reset()
    this.attributor = this.config.attributionEnabled ? new DimensionAttributor() : null
  }

  private recreateDetector(): void {
    const tc = {
      anomalyRate: this.config.anomalyRate,
      windowSize: this.config.windowSize,
      numberOfTrees: this.config.numberOfTrees,
      normalize: this.config.normalize,
    }
    if (this.isMultivariate && this.dimensionNames.length > 0) {
      this.detector = createMultiVariateDetector({ ...tc, dimensions: this.dimensionNames.length })
    } else {
      this.detector = createTimeSeriesDetector(tc)
    }
  }

  private ensureDetectorType(point: DataPoint): void {
    const dims = point.dimensions
    const hasDims = dims !== undefined && Object.keys(dims).length > 0
    if (hasDims && !this.isMultivariate) {
      this.dimensionNames = Object.keys(dims)
      this.isMultivariate = true
      this.recreateDetector()
    }
  }

  private toInputArray(point: DataPoint): number[] {
    if (!this.isMultivariate || this.dimensionNames.length === 0) return [point.value]
    return this.dimensionNames.map((name) => {
      const val = point.dimensions?.[name]
      return typeof val === 'number' && Number.isFinite(val) ? val : 0
    })
  }

  private computeAttribution(
    point: DataPoint,
    inputArray: number[],
    baselineScore: number
  ): DimensionAttribution[] {
    if (!this.attributor || !this.isMultivariate) return []
    return this.attributor.compute(
      point,
      [] as DataPoint[],
      inputArray,
      baselineScore,
      (arr, ts) => this.detector.detect(arr, ts).score
    )
  }
}
