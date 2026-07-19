# @agentix-e/anomaly-detector-core

> Core anomaly detection engine for time-series — RRCF detection, multi-model forecasting, attribution, drift detection, and framework-agnostic visualization. Dual-runtime (Node.js + Browser).

[![npm](https://img.shields.io/npm/v/@agentix-e/anomaly-detector-core?color=blue)](https://www.npmjs.com/package/@agentix-e/anomaly-detector-core)
[![CI](https://github.com/AgentiX-E/anomaly-detector/actions/workflows/ci.yml/badge.svg)](https://github.com/AgentiX-E/anomaly-detector/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-report-blue)](https://agentix-e.github.io/anomaly-detector/coverage/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/AgentiX-E/anomaly-detector/blob/master/LICENSE)

## Overview

`@agentix-e/anomaly-detector-core` is the engine powering the anomaly-detector
ecosystem. It provides:

- **Streaming anomaly detection** via RRCF (`TrcfDetector`) — sub-millisecond per point
- **Multi-model forecasting** via anofox-forecast (40+ models: ARIMA, ETS, Theta, TBATS, GARCH, VAR)
- **Auto model selection** based on data characteristics (trend, seasonality, intermittency)
- **Three calibration modes**: Forecast-Guided, Anomaly-Guided, Joint Confidence
- **Leave-one-out Shapley attribution** for multivariate anomaly root cause analysis
- **Concept drift detection** via ADWIN / KSWIN with adaptive threshold adjustment
- **Framework-agnostic visualization** output (`ChartData`) compatible with any charting library
- **DI-ready architecture** — inject custom detectors, forecasters, or calibrators via `createDetector(config)`

All components are platform-agnostic. Platform-specific adapters (TimesFM for Node.js / Browser)
live in the corresponding entry packages.

## Installation

```bash
npm install @agentix-e/anomaly-detector-core
```

Requires **Node.js >= 22** or a modern browser with WebAssembly support.

## Quick Start

```ts
import { createDetector } from '@agentix-e/anomaly-detector-core'

// Zero-config startup — auto-selects the best forecaster
const detector = createDetector()

const history = [
  { value: 50, timestamp: Date.now() - 60000 },
  { value: 51, timestamp: Date.now() - 30000 },
]
const current = { value: 95, timestamp: Date.now() }

const result = await detector.analyze(current, history)

console.log(result.jointConfidence)  // 0.0–1.0
console.log(result.attribution)      // per-dimension contribution
console.log(result.drift)            // drift detection info
console.log(result.calibration)      // calibration details

if (result.jointConfidence > 0.95) {
  // Your alert logic — library outputs confidence, you decide the threshold
}
```

### With Custom Configuration

```ts
import { createDetector } from '@agentix-e/anomaly-detector-core'

const detector = createDetector({
  // Disable auto model selection, pin a specific forecaster
  forecaster: {
    type: 'theta',
    enableAutoSelect: false,
  },
  // Tune calibration weights
  calibration: {
    weights: { grade: 0.5, spread: 0.2, hitRate: 0.2, drift: 0.1 },
  },
  // Hook into analysis lifecycle
  hooks: {
    onAnomaly: (point) => console.warn('Anomaly detected:', point),
  },
})
```

### Multivariate Detection

```ts
const detector = createDetector()

// Data points with multiple dimensions
const point = {
  value: 100,
  timestamp: Date.now(),
  dimensions: { cpu: 90, memory: 85, disk_io: 40 },
}

const result = await detector.analyze(point, history)
// result.attribution → [{ dimension: 'cpu', contribution: 0.72 }, ...]
```

### Visualization Output

```ts
import { buildChartData } from '@agentix-e/anomaly-detector-core/visualize'
import { classifyByLevels } from '@agentix-e/anomaly-detector-core/utils'

// Produce framework-agnostic chart data
const chart = buildChartData(analyzedPoints)
// chart.series, chart.annotations, chart.axes — universal format
// Map to your preferred charting library (ECharts, Chart.js, D3, etc.)

// Map jointConfidence to severity levels
const { level } = classifyByLevels(result.jointConfidence, [
  [0.7, 'warning'],
  [0.9, 'critical'],
])
```

## API Documentation

### Key Exports

| Export | Kind | Description |
|--------|------|-------------|
| `createDetector(config?)` | function | Factory — returns an `IAnomalyDetector` instance |
| `TrcfDetector` | class | RRCF-based streaming anomaly detector |
| `AnofoxForecaster` | class | Node.js forecasting adapter (anofox-forecast WASM) |
| `BrowserAnofoxForecaster` | class | Browser forecasting adapter |
| `ForecastGuidedCalibrator` | class | Calibrates scores using forecast residuals |
| `AnomalyGuidedCalibrator` | class | Calibrates scores using detection confidence |
| `JointConfidenceCalibrator` | class | Bayesian fusion of detection + forecast signals |
| `DimensionAttributor` | class | Leave-one-out Shapley attribution |
| `DriftDetector` | class | ADWIN / KSWIN concept drift detection |
| `AutoModelSelector` | class | Selects best forecasting model from data characteristics |
| `buildChartData(points)` | function | Produces `ChartData` for any visualization library |
| `buildSparkline(result)` | function | Compact sparkline for dashboard cards |
| `classifyByLevels(confidence, levels)` | function | Maps `jointConfidence` to N-level severity |
| `suppressFlapping(history)` | function | Detects alert fatigue patterns |

### Subpath Exports

```
@agentix-e/anomaly-detector-core          → createDetector, types
@agentix-e/anomaly-detector-core/detect   → TrcfDetector, DimensionAttributor, DriftDetector
@agentix-e/anomaly-detector-core/forecast → AnofoxForecaster, AutoModelSelector
@agentix-e/anomaly-detector-core/calibrate → 3 calibrator implementations
@agentix-e/anomaly-detector-core/utils    → classifyByLevels, suppressFlapping
@agentix-e/anomaly-detector-core/visualize → buildChartData, buildSparkline
```

### Core Interfaces (DI Tokens)

```ts
interface IAnomalyDetector {
  analyze(point: DataPoint, context: DataPoint[]): Promise<AnalyzedPoint>
  getState(): AnalyzerState
  setState(state: AnalyzerState): void
  reset(): void
}

interface IDetector {
  detect(point: DataPoint, context: DataPoint[]): DetectionResult
}

interface IForecaster {
  forecast(context: DataPoint[], horizon?: number): Promise<ForecastResult>
}

interface ICalibrator {
  readonly mode: CalibrationMode
  calibrate(detection: DetectionResult, forecast: ForecastResult, currentPoint: DataPoint): CalibrationResult
}
```

Inject custom implementations via `createDetector({ _customForecaster, calibration })`.

## License

MIT
