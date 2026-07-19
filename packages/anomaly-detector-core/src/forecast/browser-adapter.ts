/**
 * BrowserAnofoxForecaster — browser-native IForecaster.
 *
 * Uses native ES module import from @sipemu/anofox-forecast which
 * relies on fetch() for WASM loading. This is the correct path for
 * browsers — no createRequire(), no readFile(), no Node APIs.
 *
 * Singleton WASM init ensures multiple instances share the runtime.
 */
import type { DataPoint, ForecastResult, ForecasterType, IForecaster } from '../types.js'
import { AutoModelSelector } from './auto-select.js'

// Module-level init state
let _wasmInitPromise: Promise<Record<string, unknown>> | null = null
let _wasmMod: Record<string, unknown> | null = null

async function getWasmMod(): Promise<Record<string, unknown>> {
  if (_wasmMod) return _wasmMod
  if (!_wasmInitPromise) {
    _wasmInitPromise = (async () => {
      const mod = await import('@sipemu/anofox-forecast') as Record<string, unknown>
      await (mod.default as () => Promise<void>)()
      _wasmMod = mod
      return mod
    })()
  }
  return _wasmInitPromise
}

export class BrowserAnofoxForecaster implements IForecaster {
  private selector: AutoModelSelector
  private _modelName = 'AutoForecaster'
  readonly type: ForecasterType = 'anofox'
  get modelName(): string { return this._modelName }

  constructor(enableAutoSelect = true) {
    this.selector = new AutoModelSelector(enableAutoSelect)
  }

  async forecast(context: DataPoint[], horizon: number): Promise<ForecastResult> {
    const mod = await getWasmMod()
    const values = new Float64Array(context.map(p => p.value))
    const ts = new (mod.TimeSeries as new (d: Float64Array) => unknown)(values)
    const modelType = this.selector.select(context)
    const M = mod as Record<string, new () => Record<string, unknown>>
    const Mc = M[modelType] ?? (mod.AutoForecaster as new () => Record<string, unknown>)
    const model = new Mc()
    ;(model.fit as (t: unknown) => void)(ts)

    let predicted: number[]; let lower: number[]; let upper: number[]
    if (typeof model.predictWithIntervals === 'function') {
      const raw = (model).predictWithIntervals as (h: number, c: number) => { values: Float64Array; lower: Float64Array; upper: Float64Array }
      const r = raw.call(model, horizon, 0.90)
      predicted = Array.from(r.values); lower = Array.from(r.lower); upper = Array.from(r.upper)
    } else {
      const raw = (model).predict as (h: number) => Float64Array
      predicted = Array.from(raw.call(model, horizon))
    }
    this._modelName = modelType
    return { predicted, q10: lower, q90: upper, horizon, modelName: modelType, predictedAt: Date.now() }
  }
}
