# @agentix-e/anomaly-detector-node

> Node.js entry for anomaly-detector — adds TimesFM foundation-model forecasting via ONNX Runtime. TimesFM is opt-in — install `@agentix-e/timesfm-node` separately.

[![npm](https://img.shields.io/npm/v/@agentix-e/anomaly-detector-node?color=orange)](https://www.npmjs.com/package/@agentix-e/anomaly-detector-node)
[![CI](https://github.com/AgentiX-E/anomaly-detector/actions/workflows/ci.yml/badge.svg)](https://github.com/AgentiX-E/anomaly-detector/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://agentix-e.github.io/anomaly-detector/coverage/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/AgentiX-E/anomaly-detector/blob/master/LICENSE)

## Overview

`@agentix-e/anomaly-detector-node` is the Node.js platform entry for the
anomaly-detector ecosystem. It re-exports everything from
`@agentix-e/anomaly-detector-core` and adds optional TimesFM support —
Google Research's foundation model for zero-shot time-series forecasting.

TimesFM is **opt-in**: the adapter uses dynamic `import()` and gracefully
falls back to anofox-forecast if `@agentix-e/timesfm-node` is not installed.

## Installation

```bash
npm install @agentix-e/anomaly-detector-node
```

For TimesFM support, install the optional dependency:

```bash
npm install @agentix-e/timesfm-node
```

Requires **Node.js >= 22**.

## Quick Start

### Basic Usage (anofox-forecast — no extra deps)

```ts
import { createNodeDetector } from '@agentix-e/anomaly-detector-node'

const detector = createNodeDetector()

const result = await detector.analyze(
  { value: 95, timestamp: Date.now() },
  [{ value: 50, timestamp: Date.now() - 60000 }]
)

console.log(result.jointConfidence)
```

### With TimesFM (opt-in)

```bash
npm install @agentix-e/timesfm-node
```

```ts
import { createNodeDetector, type TimesfmConfig } from '@agentix-e/anomaly-detector-node'

const timesfmConfig: TimesfmConfig = {
  modelPath: './timesfm-2.0.onnx',
  // Proxy support for model download
  proxy: {
    host: 'proxy.example.com',
    port: 8080,
    username: 'user',  // optional
    password: 'pass',  // optional
  },
}

const detector = createNodeDetector({
  forecaster: {
    type: 'timesfm',
    timesfm: timesfmConfig,
  },
})

const result = await detector.analyze(current, history)
```

If TimesFM is requested but `@agentix-e/timesfm-node` is not installed,
the detector logs a warning and falls back to anofox-forecast.

## API Documentation

📚 **All core types and functions are re-exported from `@agentix-e/anomaly-detector-core`**.
See the [core README](../anomaly-detector-core/README.md) for the full API reference.

### Key Exports

| Export | Kind | Description |
|--------|------|-------------|
| `createNodeDetector(config?)` | function | Creates a detector with TimesFM support (opt-in, graceful fallback) |
| `TimesfmNodeAdapter` | class | Node.js TimesFM adapter — wraps `@agentix-e/timesfm-node` |
| `TimesfmConfig` | type | Configuration for TimesFM (modelPath, proxy, device) |
| `createDetector` | function | Re-exported from core — zero-config shortcut |
| `IAnomalyDetector` | interface | Detector interface (re-exported) |
| `DetectorConfig` | type | Full configuration type (re-exported) |

## License

MIT
