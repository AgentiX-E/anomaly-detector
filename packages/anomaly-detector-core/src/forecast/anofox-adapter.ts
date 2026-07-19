import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import type { IForecaster, DataPoint, ForecastResult, ForecasterType } from '../types.js'
import { AutoModelSelector } from './auto-select.js'

const req = createRequire(import.meta.url)
let _wasmMod: Record<string, unknown> | null = null
let _wasmInitPromise: Promise<Record<string, unknown>> | null = null

async function getWasmMod(): Promise<Record<string, unknown>> {
  if (_wasmMod) return _wasmMod
  if (!_wasmInitPromise) {
    _wasmInitPromise = (async () => {
      const mod = req('@sipemu/anofox-forecast') as Record<string, unknown>
      const jsPath = req.resolve('@sipemu/anofox-forecast')
      const wasmPath = jsPath.replace(/\.js$/, '_bg.wasm')
      const bytes = await readFile(wasmPath)
      await (mod.default as (b: Uint8Array) => Promise<void>)(bytes)
      _wasmMod = mod
      return mod
    })()
  }
  return _wasmInitPromise
}

export class AnofoxForecaster implements IForecaster {
  private selector = new AutoModelSelector(true)
  private _modelName = 'AutoForecaster'
  readonly type: ForecasterType = 'anofox'
  get modelName(): string { return this._modelName }

  async forecast(context: DataPoint[], horizon: number): Promise<ForecastResult> {
    const mod = await getWasmMod()
    const values = new Float64Array(context.map(p => p.value))
    const ts = new (mod.TimeSeries as new (d: Float64Array) => unknown)(values)
    const modelType = this.selector.select(context)
    const M = mod as Record<string, new () => unknown>
    const Mc = M[modelType] ?? mod.AutoForecaster
    const model = new (Mc as new () => Record<string, unknown>)() as Record<string, unknown>
    ;(model.fit as (t: unknown) => void)(ts)

    let predicted: number[] = []
    let lower: number[] = []
    let upper: number[] = []
    if (typeof model.predictWithIntervals === 'function') {
      const raw = (model.predictWithIntervals as (h: number, c: number) => { values: Float64Array; lower: Float64Array; upper: Float64Array })(horizon, 0.90)
      predicted = Array.from(raw.values); lower = Array.from(raw.lower); upper = Array.from(raw.upper)
    } else {
      const raw = (model.predict as (h: number) => Float64Array)(horizon)
      predicted = Array.from(raw)
    }
    this._modelName = modelType
    return { predicted, q10: lower, q90: upper, horizon, modelName: modelType, predictedAt: Date.now() }
  }
}
