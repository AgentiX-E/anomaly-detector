# @agentix-e/anomaly-detector

Embedded time-series anomaly detection engine. Dual-runtime (Node.js + Browser).
Zero-config startup — one line to production-grade anomaly detection with
forecast-enhanced calibration.

```ts
import { createDetector } from '@agentix-e/anomaly-detector-core'
const detector = createDetector()
const result = await detector.analyze(point, history)
// result.jointConfidence → 0.93  ← your decision threshold
```

## Packages

| Package | Runtime | Description |
|---------|---------|-------------|
| `@agentix-e/anomaly-detector-core` | Node + Browser | Detection, forecasting (anofox), calibration, utilities |
| `@agentix-e/anomaly-detector-node` | Node.js | Adds TimesFM foundation-model forecasting |
| `@agentix-e/anomaly-detector-web` | Browser | Adds TimesFM Web (onnxruntime-web) forecasting |

## Quick Start

```bash
npm install @agentix-e/anomaly-detector-core
```

```ts
import { createDetector } from '@agentix-e/anomaly-detector-core'

// Zero config
const detector = createDetector()

// Feed data points
for (const point of stream) {
  const result = await detector.analyze(point, history)
  if (result.jointConfidence > 0.95) {
    // Your alert logic here — the library outputs confidence, you decide
    fireAlert(result)
  }
}
```

## Capabilities

- **Streaming anomaly detection** — RRCF via trcf-ts, < 1ms per point
- **Multivariate attribution** — leave-one-out Shapley decomposition
- **Concept drift detection** — ADWIN / KSWIN with adaptive thresholds
- **40+ forecasting models** — ARIMA, ETS, Theta, TBATS, GARCH, VAR via anofox-forecast WASM
- **Three calibration modes** — Forecast-Guided, Anomaly-Guided, Joint Confidence
- **Framework-agnostic charts** — `ChartData` output compatible with any visualization library
- **TimesFM (optional)** — Google Research's foundation model for zero-shot forecasting
- **State persistence** — versioned serialization for hot-reload

## Philosophy

**The library outputs confidence — you decide.** No hardcoded alert levels.
No opinionated notification pipelines. Just a `jointConfidence` number and
rich diagnostic data (attribution, drift, predictions, residuals).

## Browser Support

```ts
// Same API, auto-detects browser runtime
import { createDetector } from '@agentix-e/anomaly-detector-core'
// Browser: uses BrowserAnofoxForecaster (fetch-based WASM)
// Node: uses AnofoxForecaster (filesystem WASM)
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Core API](./packages/anomaly-detector-core)
- [Node.js (TimesFM)](./packages/anomaly-detector-node)
- [Browser (TimesFM)](./packages/anomaly-detector-web)

## License

MIT
