/**
 * TimesfmWebAdapter — IForecaster implementation using @agentix-e/timesfm-web.
 *
 * Browser-compatible via onnxruntime-web (WASM/WebGPU).
 * Uses dynamic import for optional dependency loading.
 */
import type { IForecaster, DataPoint, ForecastResult, ForecasterType } from '@agentix-e/anomaly-detector-core'

export class TimesfmWebAdapter implements IForecaster {
  readonly type: ForecasterType = 'timesfm'
  private config: TimesfmWebConfig
  private engine: unknown = null

  constructor(config?: TimesfmWebConfig) {
    this.config = { model: 'timesfm-2.5-200m', contextWindow: 1024, horizon: 64, ...config }
  }

  get modelName(): string { return `TimesFM-${this.config.model}` }

  async forecast(context: DataPoint[], horizon: number): Promise<ForecastResult> {
    const engine = await this.ensureEngine()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (engine as any).forecast(
      context.map(p => p.value),
      { contextLength: this.config.contextWindow, horizon: horizon ?? this.config.horizon }
    )
    return {
      predicted: result.pointForecast ? Array.from(result.pointForecast) as number[] : [],
      q10: result.quantileForecast ? (result.quantileForecast as number[][])[2] ?? [] : [],
      q90: result.quantileForecast ? (result.quantileForecast as number[][])[8] ?? [] : [],
      horizon: horizon ?? this.config.horizon,
      modelName: this.modelName,
      predictedAt: Date.now(),
    }
  }

  private async ensureEngine(): Promise<unknown> {
    if (this.engine) return this.engine
    try {
      const mod = await import('@agentix-e/timesfm-web')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.engine = new (mod as any).TimesFMWebEngine({
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
