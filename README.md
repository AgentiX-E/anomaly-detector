# @agentix-e/anomaly-detector

[![CI](https://github.com/AgentiX-E/anomaly-detector/actions/workflows/ci.yml/badge.svg)](https://github.com/AgentiX-E/anomaly-detector/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-green)](https://nodejs.org/)

Embedded time-series anomaly detection engine. Dual-runtime (Node.js + Browser).
Zero-config startup — one line to production-grade anomaly detection with
forecast-enhanced calibration.

## Packages

| Package | npm | Runtime | Description |
|---------|-----|---------|-------------|
| `@agentix-e/anomaly-detector-core` | [![npm](https://img.shields.io/npm/v/@agentix-e/anomaly-detector-core)](https://www.npmjs.com/package/@agentix-e/anomaly-detector-core) | Node + Browser | Detection, forecasting, calibration, utilities |
| `@agentix-e/anomaly-detector-node` | [![npm](https://img.shields.io/npm/v/@agentix-e/anomaly-detector-node)](https://www.npmjs.com/package/@agentix-e/anomaly-detector-node) | Node.js | TimesFM foundation-model forecasting |
| `@agentix-e/anomaly-detector-web` | [![npm](https://img.shields.io/npm/v/@agentix-e/anomaly-detector-web)](https://www.npmjs.com/package/@agentix-e/anomaly-detector-web) | Browser | TimesFM Web (onnxruntime-web) forecasting |

## Quick Start

```bash
npm install @agentix-e/anomaly-detector-core
```

```ts
import { createDetector } from '@agentix-e/anomaly-detector-core'

const detector = createDetector()

for (const point of stream) {
  const result = await detector.analyze(point, history)
  if (result.jointConfidence > 0.95) {
    // Your alert logic — library outputs confidence, you decide the threshold
    fireAlert(result)
  }
}
```

## Capabilities

- **Streaming anomaly detection** — RRCF via trcf-ts, < 1ms per point
- **Multivariate attribution** — leave-one-out Shapley decomposition
- **Concept drift detection** — ADWIN / KSWIN with adaptive thresholds
- **40+ forecasting models** — ARIMA, ETS, Theta, TBATS, GARCH, VAR via anofox-forecast
- **Three calibration modes** — Forecast-Guided, Anomaly-Guided, Joint Confidence
- **Framework-agnostic charts** — `ChartData` output compatible with any visualization library
- **TimesFM (optional)** — Google Research's foundation model for zero-shot forecasting
- **State persistence** — versioned serialization for hot-reload

## Philosophy

**The library outputs confidence — you decide.** No hardcoded alert levels.
No opinionated notification pipelines. Just a `jointConfidence` number and
rich diagnostic data (attribution, drift, predictions, residuals).

## Project Structure

```
anomaly-detector/
├── packages/
│   ├── anomaly-detector-core/    # Core analysis engine
│   │   ├── src/
│   │   │   ├── detect/           # TrcfDetector + Attribution + Drift
│   │   │   ├── forecast/         # AnofoxForecaster + AutoModelSelector
│   │   │   ├── calibrate/        # 3 calibration modes
│   │   │   ├── visualize/        # Framework-agnostic ChartData
│   │   │   ├── utils/            # classifyByLevels + suppressFlapping
│   │   │   ├── engine.ts         # createDetector() factory
│   │   │   └── types.ts          # All DI interfaces
│   │   └── test/
│   ├── anomaly-detector-node/    # TimesFM Node.js adapter
│   └── anomaly-detector-web/     # TimesFM Browser adapter
├── docs/
│   ├── ARCHITECTURE.md
│   └── index.html                # GitHub Pages landing
└── .github/workflows/
    ├── _quality.yml              # Reusable lint + typecheck + test
    ├── ci.yml                    # CI + GitHub Pages
    └── release.yml               # npm publish (OIDC)
```

## Documentation & Reports

| Resource | Link |
|----------|------|
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Coverage Report | [agentix-e.github.io/anomaly-detector/coverage/](https://agentix-e.github.io/anomaly-detector/coverage/) |
| GitHub Pages | [agentix-e.github.io/anomaly-detector/](https://agentix-e.github.io/anomaly-detector/) |

## Development

```bash
pnpm install
pnpm -r lint          # ESLint across all packages
pnpm -r typecheck     # TypeScript type checking
pnpm -r test          # Run all tests
pnpm -r test:coverage # Tests with coverage reports
```

## License

MIT
