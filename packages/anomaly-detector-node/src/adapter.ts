/**
 * TimesfmNodeAdapter — IForecaster implementation using @agentix-e/timesfm-node.
 *
 * Uses dynamic import to load the optional dependency at runtime.
 * If @agentix-e/timesfm-node is not installed, forecast() throws a
 * descriptive error with installation instructions.
 */
import type { IForecaster, DataPoint, ForecastResult, ForecasterType } from '@agentix-e/anomaly-detector-core'

export class TimesfmNodeAdapter implements IForecaster {
  readonly type: ForecasterType = 'timesfm'
  private config: TimesfmConfig
  private engine: unknown = null

  constructor(config?: TimesfmConfig) {
    this.config = { model: 'timesfm-2.5-200m', contextWindow: 1024, horizon: 64, ...config }
  }

  get modelName(): string { return `TimesFM-${this.config.model}` }

  async forecast(context: DataPoint[], horizon: number): Promise<ForecastResult> {
    const engine = await this.ensureEngine()
    const result = await (engine as any).forecast(
      context.map(p => p.value),
      { contextLength: this.config.contextWindow, horizon: horizon ?? this.config.horizon }
    )
    return {
      predicted: result.pointForecast ? Array.from(result.pointForecast) : [],
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
      const mod = await import('@agentix-e/timesfm-node')
       
      this.engine = new (mod).TimesFMNodeEngine({
        modelName: this.config.model,
        maxContext: this.config.contextWindow,
        maxHorizon: this.config.horizon,
      })
      return this.engine
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('Cannot find') || msg.includes('ERR_MODULE_NOT_FOUND')) {
        throw new Error(
          'TimesFM is not installed. Install it as an optional dependency:\n' +
          '  npm install @agentix-e/timesfm-node\n' +
          'Or use anofox-forecast (default): createDetector({ forecaster: { type: "anofox" } })'
        )
      }
      throw err
    }
  }
}

export interface TimesfmConfig {
  model?: string
  contextWindow?: number
  horizon?: number
}
