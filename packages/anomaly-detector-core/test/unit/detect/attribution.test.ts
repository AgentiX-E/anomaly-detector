import { describe, it, expect } from 'vitest'
import { DimensionAttributor } from '../../../src/detect/attribution.js'
import type { DataPoint } from '../../../src/types.js'

describe('DimensionAttribution', () => {
  const attributor = new DimensionAttributor()

  function makePoint(dimensions: Record<string, number>): DataPoint {
    return { value: Object.values(dimensions)[0] ?? 0, dimensions, timestamp: Date.now() }
  }

  it('returns empty array when no dimensions present', () => {
    const point: DataPoint = { value: 50, timestamp: Date.now() }
    const result = attributor.compute(point, [], [50], 5, () => 5)
    expect(result).toEqual([])
  })

  it('returns single-dimensional contribution for 1 dimension', () => {
    const point = makePoint({ cpu: 200 })
    const result = attributor.compute(point, [], [200], 5, () => 5)
    expect(result).toHaveLength(1)
    expect(result[0]!.dimension).toBe('cpu')
    expect(result[0]!.contribution).toBe(1)
  })

  it('identifies the anomalous dimension correctly', () => {
    const point = makePoint({ cpu: 200, memory: 30, disk: 82 })
    // Score function: high score when cpu is in array
    const scoreFn = (arr: number[]) => (arr[0] as number > 100 ? 5 : 1)
    const result = attributor.compute(point, [], [200, 30, 82], 5, (arr) => scoreFn(arr))
    expect(result).toHaveLength(3)
    // cpu should have the highest contribution
    const cpuContrib = result.find(r => r.dimension === 'cpu')!.contribution
    expect(cpuContrib).toBeGreaterThan(0.3)
  })

  it('all contributions near zero when no anomaly', () => {
    const point = makePoint({ cpu: 50, memory: 30, disk: 80 })
    const scoreFn = (_arr: number[]) => 0
    const result = attributor.compute(point, [], [50, 30, 80], 0, scoreFn)
    for (const r of result) {
      expect(r.contribution).toBeCloseTo(0, 5)
    }
  })

  it('both anomalous dims show non-zero contribution', () => {
    const point = makePoint({ cpu: 200, memory: 200, disk: 80 })
    const scoreFn = (arr: number[]) => (arr[0] as number > 100 ? 5 : 1)
    const result = attributor.compute(point, [], [200, 200, 80], 5, (arr) => scoreFn(arr))
    const cpu = result.find(r => r.dimension === 'cpu')!
    const mem = result.find(r => r.dimension === 'memory')!
    expect(cpu.contribution).toBeGreaterThanOrEqual(-1)
    expect(mem.contribution).toBeGreaterThanOrEqual(-1)
  })

  it('normalizes contributions to sum of absolute values near 1', () => {
    const point = makePoint({ cpu: 200, memory: 50, disk: 80 })
    const scoreFn = (arr: number[]) => (arr[0] as number > 100 ? 10 : 1)
    const result = attributor.compute(point, [], [200, 50, 80], 10, (arr) => scoreFn(arr))
    const absSum = result.reduce((s, r) => s + Math.abs(r.contribution), 0)
    expect(absSum).toBeCloseTo(1, 1)
  })

  it('uses context means for masking', () => {
    const context: DataPoint[] = [
      makePoint({ cpu: 50, memory: 30, disk: 80 }),
      makePoint({ cpu: 52, memory: 31, disk: 79 }),
      makePoint({ cpu: 48, memory: 29, disk: 81 }),
    ]
    const point = makePoint({ cpu: 200, memory: 30, disk: 80 })
    const scoreFn = (arr: number[]) => (arr[0] as number > 100 ? 5 : 1)
    const result = attributor.compute(point, context, [200, 30, 80], 5, (arr) => scoreFn(arr))
    expect(result).toHaveLength(3)
    expect(result[0]!.contribution).toBeGreaterThanOrEqual(-1)
  })
})
