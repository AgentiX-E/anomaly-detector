# Anomaly Detector

> Embedded time-series anomaly detection engine for Node.js and Browser.

## Overview

**@agentix-e/anomaly-detector** is the industry's first open-source TypeScript library that unifies **streaming anomaly detection**, **multi-model forecasting**, and **calibrated attribution** into a single, embedded engine. It runs entirely local — no cloud services, no API keys, no data egress.

- **Dual-runtime**: Works in Node.js and Browser (Chrome/Firefox/Safari)
- **RRCF detection** with leave-one-out Shapley dimension attribution
- **40+ statistical models** (ARIMA/ETS/Theta/TBATS/GARCH) via anofox-forecast WASM
- **Optional TimesFM** foundation-model for zero-shot forecasting
- **Three calibration modes** fuse detection + forecast into a single `jointConfidence`
- **Visualization-ready** output: 6 framework adapters (ECharts/Chart.js/Recharts/Nivo/Plot/D3)

## Quick Start

```typescript
import { createDetector } from '@agentix-e/anomaly-detector-core'

const detector = createDetector()
const result = await detector.analyze(point, history)

// result.jointConfidence → 0.93
// The caller defines their own threshold and alert logic.
if (result.jointConfidence > 0.95) {
  myAlertSystem.fire(result)
}
```

## Packages

| Package | Description | Runtime |
|---------|-------------|---------|
| `@agentix-e/anomaly-detector-core` | Core engine (detect + forecast + calibrate) | Node.js + Browser |
| `@agentix-e/anomaly-detector-node` | Node.js entry (TimesFM optional) | Node.js |
| `@agentix-e/anomaly-detector-web` | Browser entry (TimesFM optional) | Browser |

## Architecture

```
DataPoint → [IDetector] → DetectionResult ─┐
                                            ├→ [ICalibrator] → jointConfidence
DataPoint → [IForecaster] → ForecastResult ─┘
```

The library outputs a single number: `jointConfidence` [0, 1]. The caller decides thresholds, alert levels, and notification channels. **No business decisions baked into the engine.**

## DI Tokens

All components are replaceable via the DI pattern:

```typescript
const detector = createDetector({
  detector: new CustomDetector(),
  forecaster: new CustomForecaster(),
  calibrator: new JointCalibrator()
})
```

## Documentation

- [Product Whitepaper](./docs/whitepaper.md)
- [Architecture Guide](./docs/architecture.md)
- [API Reference](./docs/api.md)

## License

MIT
