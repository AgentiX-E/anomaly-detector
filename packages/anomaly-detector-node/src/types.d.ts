declare module '@agentix-e/timesfm-node' {
  export class TimesFMNodeEngine {
    constructor(config: { modelName?: string; maxContext?: number; maxHorizon?: number })
    forecast(input: number[], opts: { contextLength: number; horizon: number }): Promise<{ pointForecast: Float64Array; quantileForecast: Float64Array[][] }>
  }
}
