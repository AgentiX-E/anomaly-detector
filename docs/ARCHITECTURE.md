# Architecture

## Pipeline

```
DataPoint + Context
  │
  ├──→ IDetector ──→ DetectionResult { isAnomaly, grade, attribution, drift }
  │
  ├──→ IForecaster ──→ ForecastResult { predicted, q10, q90 }
  │
  └──→ ICalibrator ──→ AnalyzedPoint { jointConfidence, residual, ... }
```

All three components are DI tokens — replaceable via `createDetector(config)`.

## Runtime Detection

`createDetector()` auto-detects the runtime and selects the correct forecaster:
- **Browser** → `BrowserAnofoxForecaster` — fetches WASM via `import('@sipemu/anofox-forecast')` + `init()`
- **Node.js** → `AnofoxForecaster` — loads WASM via `createRequire()` + `readFile()`

Detect/calibrate/utils are pure JS with zero platform dependencies — tested in real Chromium.

## Modules

```
core/src/
├── detect/          TrcfDetector + Attribution + Drift
├── forecast/        AnofoxForecaster (Node) + BrowserAnofoxForecaster + AutoSelect
├── calibrate/       ForecastGuided | AnomalyGuided | JointConfidence
├── visualize/       Framework-agnostic ChartData + SparklineData
├── utils/           classifyByLevels() + suppressFlapping()
├── engine.ts        createDetector() factory — DI wiring
└── types.ts         All interfaces (IDetector, IForecaster, ICalibrator, IAnomalyDetector)
```

## Calibration Modes

| Mode | Strategy | Best for |
|------|----------|----------|
| `forecast-guided` (default) | Measures deviation from prediction interval | Trending metrics (CPU, memory) |
| `anomaly-guided` | Marks contamination windows, refits on clean data | Sparse spike anomalies |
| `joint` | Bayesian fusion: grade + spread + hitRate + drift | Production auto-decision |

All modes output a single `jointConfidence` [0, 1] — the library's only boundary output
for caller decision-making.

## Testing

- **Node**: 88 tests across 3 packages, zero mocks
- **Browser**: 10 tests in real Chromium (Playwright), covering detect + calibrate + utils + TimesFM Web adapter
- **Coverage**: statements 98.21%, branches 80.53%, functions 100% (detect + calibrate + utils)
