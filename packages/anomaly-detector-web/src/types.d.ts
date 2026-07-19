declare module '@agentix-e/timesfm-web' {
  export class TimesFMWebEngine {
    constructor(config: { modelName?: string; maxContext?: number; maxHorizon?: number })
    forecast(input: number[], opts: { contextLength: number; horizon: number }): Promise<{ pointForecast: Float64Array; quantileForecast: number[][] }>
  }
}
