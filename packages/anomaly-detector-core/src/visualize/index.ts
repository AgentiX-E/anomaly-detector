/**
 * Framework-agnostic chart data format.
 *
 * Instead of adapter-per-framework (toEChartsOption, toChartJSConfig, etc.),
 * we define ONE unified data format that any charting library can consume.
 *
 * Mapping to specific frameworks is trivial — the caller just reads
 * ChartData fields and maps them to their library's API.
 */

import type { AnalyzedPoint, DataPoint } from '../types.js'

// ── Unified Chart Types ──

/** A single data pair — the universal atom of all charting libraries. */
export interface ChartPoint {
  t: number
  v: number
}

/** A named series of data points. */
export interface ChartSeries {
  id: string
  label: string
  type: 'line' | 'area' | 'band' | 'scatter'
  data: ChartPoint[]
  color?: string
  dashPattern?: number[]
  fillOpacity?: number
  companionId?: string
}

/** An annotation marker on the chart. */
export interface ChartAnnotation {
  timestamp: number
  value: number
  label: string
  description?: string
  color: string
  severity?: number
}

/** Axis configuration hints. */
export interface ChartAxes {
  x: { label?: string; type: 'time' }
  y: { label?: string; min?: number; max?: number }
}

/** Framework-agnostic chart data — the single output format. */
export interface ChartData {
  title?: string
  series: ChartSeries[]
  annotations: ChartAnnotation[]
  axes: ChartAxes
  metadata: Record<string, unknown>
}

/** Sparkline data for dashboard cards. */
export interface SparklineData {
  name: string
  currentValue: number
  status: 'normal' | 'warning' | 'critical'
  trend: 'up' | 'down' | 'flat'
  trendPercent: number
  points: ChartPoint[]
  lastUpdatedAt: number
}

// ── Builders ──

function defaultAnomalyColors() {
  return { p0: '#DC2626', p1: '#F59E0B', p2: '#3B82F6' }
}

/**
 * Build ChartData from an AnalyzedPoint and its context.
 *
 * Produces a universal format that can be rendered by any chart library.
 * The caller maps ChartData fields to their framework's API — no
 * framework-specific adapter methods needed.
 */
export function buildChartData(
  point: AnalyzedPoint,
  context: DataPoint[],
  opts?: { metricName?: string; unit?: string }
): ChartData {
  const actualColor = '#5470C6'
  const predictedColor = '#91CC75'
  const bandColor = 'rgba(145, 204, 117, 0.15)'
  const colors = defaultAnomalyColors()

  const interval = context.length > 1
    ? context[context.length - 1]!.timestamp - context[context.length - 2]!.timestamp
    : 60_000

  const series: ChartSeries[] = []

  if (context.length > 0) {
    series.push({
      id: 'actual', label: 'Actual', type: 'line',
      data: context.map(p => ({ t: p.timestamp, v: p.value })),
      color: actualColor,
    })
  }

  if (point.predicted.length > 0) {
    const lastTs = context.length > 0 ? context[context.length - 1]!.timestamp : Date.now()
    series.push({
      id: 'predicted', label: 'Predicted', type: 'line',
      data: point.predicted.map((v, i) => ({ t: lastTs + (i + 1) * interval, v })),
      color: predictedColor, dashPattern: [5, 5],
    })

    if (point.q10.length > 0 && point.q90.length > 0) {
      series.push({
        id: 'q10', label: 'Lower (q10)', type: 'band',
        data: point.q10.map((v, i) => ({ t: lastTs + (i + 1) * interval, v })),
        color: bandColor, fillOpacity: 0.15, companionId: 'q90',
      })
      series.push({
        id: 'q90', label: 'Upper (q90)', type: 'band',
        data: point.q90.map((v, i) => ({ t: lastTs + (i + 1) * interval, v })),
        color: bandColor, fillOpacity: 0.15, companionId: 'q10',
      })
    }
  }

  const annotations: ChartAnnotation[] = []
  if (point.isAnomaly) {
    const sevColor = point.jointConfidence > 0.9 ? colors.p0
      : point.jointConfidence > 0.8 ? colors.p1 : colors.p2
    const lastVal = context.length > 0 ? context[context.length - 1]!.value : 0
    annotations.push({
      timestamp: point.analyzedAt, value: lastVal,
      label: 'Anomaly (' + (point.jointConfidence * 100).toFixed(0) + '%)',
      description: point.attribution
        .filter(a => Math.abs(a.contribution) > 0.1)
        .map(a => a.dimension + ': ' + (a.contribution * 100).toFixed(0) + '%')
        .join(', '),
      color: sevColor, severity: point.jointConfidence,
    })
  }

  const yValues = context.map(p => p.value).concat(point.predicted)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  const yPad = (yMax - yMin) * 0.1 || 1

  return {
    title: opts?.metricName,
    series, annotations,
    axes: {
      x: { type: 'time' },
      y: { label: opts?.unit ? (opts.metricName ?? 'Value') + ' (' + opts.unit + ')' : (opts?.metricName ?? 'Value'), min: yMin - yPad, max: yMax + yPad },
    },
    metadata: { forecasterUsed: point.forecasterUsed, calibrationMode: point.calibrationMode },
  }
}

/**
 * Build sparkline data — compact representation for dashboard cards.
 */
export function buildSparkline(
  point: AnalyzedPoint,
  context: DataPoint[],
  metricName = 'Metric'
): SparklineData {
  const recent = context.slice(-Math.min(context.length, 60))
  const points = recent.map(p => ({ t: p.timestamp, v: p.value }))
  const first = recent[0]?.value ?? 0
  const change = first > 0 ? ((point.value - first) / first) * 100 : 0

  return {
    name: metricName,
    currentValue: point.value,
    status: point.jointConfidence > 0.9 ? 'critical' : point.jointConfidence > 0.8 ? 'warning' : 'normal',
    trend: Math.abs(change) < 1 ? 'flat' : change > 0 ? 'up' : 'down',
    trendPercent: Math.round(change * 10) / 10,
    points, lastUpdatedAt: point.analyzedAt,
  }
}
