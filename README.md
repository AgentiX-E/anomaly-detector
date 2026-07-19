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

## What is @agentix-e/anomaly-detector?

`@agentix-e/anomaly-detector` is an **embedded time-series anomaly detection engine** that runs in both Node.js and the browser. It combines RRCF (Random Cut Forest) streaming detection, 40+ forecasting models (ARIMA, ETS, Theta, TBATS, GARCH, VAR), multivariate Shapley decomposition, concept drift detection, and optional TimesFM foundation-model forecasting — all behind a single `createDetector()` API.

### When should I use it?

- You need **real-time anomaly detection** on streaming time-series data (< 1ms per point)
- You want **forecast-enhanced calibration** that adapts thresholds to predicted values
- You need **multivariate attribution** to explain *why* a point is anomalous
- You're building **monitoring, observability, or AIOps** tooling that runs embedded (not as a separate service)
- You want the option of **zero-shot forecasting** via Google Research's TimesFM foundation model

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

## FAQ

### What makes this different from other anomaly detection libraries?
Most libraries focus on a single algorithm (e.g., Isolation Forest). anomaly-detector combines **streaming RRCF detection**, **40+ forecasting models**, **Shapley attribution**, and **concept drift detection** in one unified API with dual Node.js + Browser runtime support.

### Do I need TimesFM?
No. TimesFM is completely optional. The core detector (`@agentix-e/anomaly-detector-core`) includes 40+ traditional forecasting models via anofox-forecast WASM. TimesFM adds foundation-model zero-shot forecasting but requires `@agentix-e/timesfm-node` or `@agentix-e/timesfm-web` as a separate install.

### Can I use it for real-time streaming data?
Yes. RRCF-based detection processes each point in < 1ms. The engine is designed for online/streaming scenarios — feed points one at a time and get immediate results.

### How do I choose the calibration mode?
Three modes available:
- **Forecast-Guided** — thresholds adapt to predicted values (best for seasonal data)
- **Anomaly-Guided** — thresholds adapt to anomaly distribution (best for sparse anomalies)
- **Joint Confidence** — combines both (best general-purpose default)

## License

MIT
