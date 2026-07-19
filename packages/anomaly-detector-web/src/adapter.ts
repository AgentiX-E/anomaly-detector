/**
 * TimesfmWebAdapter — browser-native IForecaster for @agentix-e/timesfm-web.
 *
 * Standalone module — zero dependencies on @agentix-e/anomaly-detector-core.
 * This ensures the adapter loads in browser contexts where Node.js modules
 * (node:fs, node:module) are unavailable.
 *
 * Uses dynamic import() for optional dependency loading.
 * Falls back to descriptive error when @agentix-e/timesfm-web is not installed.
 */

// ── Inline types (subset of @agentix-e/anomaly-detector-core) ──

/** A single data point. */
export interface DataPoint { value: number; timestamp: number; dimensions?: Record<string, number>; metadata?: Record<string, unknown> }

/** Forecast result. */
export interface ForecastResult { predicted: number[]; q10: number[]; q90: number[]; horizon: number; modelName: string; predictedAt: number; metadata?: Record<string, unknown> }

/** Forecaster backend type. */
export type ForecasterType = 'anofox' | 'timesfm' | 'custom'

/** Forecaster interface. */
export interface IForecaster { forecast(context: DataPoint[], horizon: number): Promise<ForecastResult>; readonly modelName: string; readonly type: ForecasterType }

// ── Implementation ──

export class TimesfmWebAdapter implements IForecaster {
  readonly type: ForecasterType = 'timesfm'
  private config: TimesfmWebConfig
  private engine: unknown = null

  constructor(config?: TimesfmWebConfig) {
    this.config = { model: 'timesfm-2.5-200m', contextWindow: 1024, horizon: 64, ...config }
  }

  get modelName(): string { return 'TimesFM-' + this.config.model }

  async forecast(context: DataPoint[], horizon: number): Promise<ForecastResult> {
    const engine = await this.ensureEngine()
    const result = await (engine as Record<string, unknown>).forecast(
      context.map(p => p.value),
      { contextLength: this.config.contextWindow, horizon: horizon ?? this.config.horizon }
    ) as { pointForecast?: Float64Array; quantileForecast?: number[][] }
    return {
      predicted: result.pointForecast ? Array.from(result.pointForecast) : [],
      q10: result.quantileForecast?.[2] ?? [],
      q90: result.quantileForecast?.[8] ?? [],
      horizon: horizon ?? this.config.horizon,
      modelName: this.modelName,
      predictedAt: Date.now(),
    }
  }

  private async ensureEngine(): Promise<unknown> {
    if (this.engine) return this.engine
    try {
      const mod = await import(/* @vite-ignore */ '@agentix-e/timesfm-web') as Record<string, unknown>
      this.engine = new (mod.TimesFMWebEngine as new (cfg: Record<string, unknown>) => unknown)({
        modelName: this.config.model,
        maxContext: this.config.contextWindow,
        maxHorizon: this.config.horizon,
      })
      return this.engine
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('Cannot find') || msg.includes('ERR_MODULE_NOT_FOUND')) {
        throw new Error(
          'TimesFM Web is not installed. Install it:\n' +
          '  npm install @agentix-e/timesfm-web\n' +
          'Or use anofox-forecast (default).'
        )
      }
      throw err
    }
  }
}

export interface TimesfmWebConfig {
  model?: string
  contextWindow?: number
  horizon?: number
}
