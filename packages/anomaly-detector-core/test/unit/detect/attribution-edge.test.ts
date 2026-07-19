/**
 * Edge-case tests for DimensionAttributor — targets uncovered ?? fallback branches.
 *
 * These branches (means[i] ?? 0, normalized[i] ?? 0, means[i] ?? 1, sums[i] ?? 0)
 * are TypeScript-generated defensive checks. In normal API usage they are unreachable
 * due to strong typing. We use `as any` casts to simulate runtime edge cases.
 */
import { describe, it, expect } from 'vitest'
import { DimensionAttributor } from '../../../src/detect/attribution.js'
import type { DataPoint } from '../../../src/types.js'

function makePoint(value: number, dims?: Record<string, number>): DataPoint {
  return { value, timestamp: Date.now(), dimensions: dims }
}

describe('DimensionAttributor edge cases', () => {
  it('handles context points without dimensions (means[i] ?? 0 and sums[i] ?? 0)', () => {
    const attributor = new DimensionAttributor()
    // Context points have NO dimensions — computeMeans returns [0, 0]
    const context: DataPoint[] = [
      makePoint(50),
      makePoint(51),
      makePoint(52),
    ]
    const point = makePoint(55, { a: 10, b: 20 })
    const scoreFn = (arr: number[], _ts: number) => arr.reduce((s, v) => s + Math.abs(v), 0)

    const result = attributor.compute(point, context, [10, 20], 30, scoreFn)
    expect(result).toHaveLength(2)
    expect(result[0]!.dimension).toBe('a')
    expect(result[1]!.dimension).toBe('b')
  })

  it('handles context with mixed dimension presence (means[i] ?? 1 in confidence)', () => {
    const attributor = new DimensionAttributor()
    const context: DataPoint[] = [
      { value: 50, timestamp: 1, dimensions: { a: 5 } }, // only has 'a'
      { value: 51, timestamp: 2, dimensions: { b: 8 } }, // only has 'b'
    ]
    const point = makePoint(55, { a: 10, b: 20 })
    const scoreFn = (arr: number[], _ts: number) => arr.reduce((s, v) => s + Math.abs(v), 0)

    const result = attributor.compute(point, context, [10, 20], 30, scoreFn)
    expect(result).toHaveLength(2)
  })

  it('handles single dimension (baseline > 0 → contribution = 1)', () => {
    const attributor = new DimensionAttributor()
    const point = makePoint(55, { a: 10 })
    const context: DataPoint[] = [makePoint(50)]
    const scoreFn = (arr: number[], _ts: number) => arr[0]!

    const result = attributor.compute(point, context, [10], 5, scoreFn)
    expect(result).toHaveLength(1)
    expect(result[0]!.contribution).toBe(1)
    expect(result[0]!.confidence).toBe(1)
  })

  it('handles single dimension with baseline = 0', () => {
    const attributor = new DimensionAttributor()
    const point = makePoint(55, { a: 10 })
    const context: DataPoint[] = [makePoint(50)]
    const scoreFn = (_arr: number[], _ts: number) => 0

    const result = attributor.compute(point, context, [10], 0, scoreFn)
    expect(result).toHaveLength(1)
    expect(result[0]!.contribution).toBe(0)
  })

  it('handles point without dimensions', () => {
    const attributor = new DimensionAttributor()
    const point = makePoint(55) // no dimensions
    const context: DataPoint[] = [makePoint(50)]
    const scoreFn = (arr: number[], _ts: number) => arr[0]!

    const result = attributor.compute(point, context, [10], 5, scoreFn)
    expect(result).toEqual([])
  })

  it('handles zero-sum normalization (all contributions cancel)', () => {
    const attributor = new DimensionAttributor()
    const point = makePoint(55, { a: 10, b: 10 })
    const context: DataPoint[] = [
      makePoint(50, { a: 5, b: 5 }),
      makePoint(50, { a: 5, b: 5 }),
    ]
    // Score function that returns same score regardless of masking → all contributions = 0
    const scoreFn = (_arr: number[], _ts: number) => 30
    const result = attributor.compute(point, context, [10, 10], 30, scoreFn)
    expect(result).toHaveLength(2)
    // absSum = 0 → each normalized to 0
    for (const r of result) {
      expect(r.contribution).toBe(0)
    }
  })

  it('handles context points with NaN dimension values', () => {
    const attributor = new DimensionAttributor()
    const context: DataPoint[] = [
      { value: 50, timestamp: 1, dimensions: { a: NaN, b: 5 } },
      { value: 50, timestamp: 2, dimensions: { a: 10, b: NaN } },
    ]
    const point = makePoint(55, { a: 10, b: 20 })
    const scoreFn = (arr: number[], _ts: number) => arr.reduce((s, v) => s + Math.abs(v), 0)

    const result = attributor.compute(point, context, [10, 20], 30, scoreFn)
    expect(result).toHaveLength(2)
  })

  it('handles empty context array', () => {
    const attributor = new DimensionAttributor()
    const point = makePoint(55, { a: 10, b: 20 })
    const scoreFn = (arr: number[], _ts: number) => arr.reduce((s, v) => s + Math.abs(v), 0)

    const result = attributor.compute(point, [], [10, 20], 30, scoreFn)
    expect(result).toHaveLength(2)
    // means are all 0, so masking replaces with 0
  })
})
