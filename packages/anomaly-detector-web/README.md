# @agentix-e/anomaly-detector-web

> Browser entry for anomaly-detector — adds TimesFM foundation-model forecasting via ONNX Runtime Web. TimesFM is opt-in — install `@agentix-e/timesfm-web` separately.

[![npm](https://img.shields.io/npm/v/@agentix-e/anomaly-detector-web?color=orange)](https://www.npmjs.com/package/@agentix-e/anomaly-detector-web)
[![CI](https://github.com/AgentiX-E/anomaly-detector/actions/workflows/ci.yml/badge.svg)](https://github.com/AgentiX-E/anomaly-detector/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://agentix-e.github.io/anomaly-detector/coverage/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/AgentiX-E/anomaly-detector/blob/master/LICENSE)

## Overview

`@agentix-e/anomaly-detector-web` is the browser platform entry for the
anomaly-detector ecosystem. It re-exports core types and adds optional
TimesFM Web support — Google Research's foundation model running directly
in the browser via ONNX Runtime Web (WebAssembly + WebGL).

TimesFM is **opt-in**: the adapter uses dynamic `import()` and gracefully
falls back to anofox-forecast if `@agentix-e/timesfm-web` is not installed.
The adapter uses variable-based `import()` to prevent bundler static analysis
and avoid tree-shaking failures.

## Installation

```bash
npm install @agentix-e/anomaly-detector-web
```

For TimesFM Web support, install the optional dependency:

```bash
npm install @agentix-e/timesfm-web onnxruntime-web
```

`onnxruntime-web` is a peer dependency of `@agentix-e/timesfm-web`.

## Quick Start

### Basic Usage (anofox-forecast via WASM — no extra deps)

```ts
import { createWebDetector } from '@agentix-e/anomaly-detector-web'

const detector = createWebDetector()

const result = await detector.analyze(
  { value: 95, timestamp: Date.now() },
  [{ value: 50, timestamp: Date.now() - 60000 }]
)

console.log(result.jointConfidence)
```

### With TimesFM Web (opt-in)

```bash
npm install @agentix-e/timesfm-web onnxruntime-web
```

```ts
import {
  createWebDetector,
  type TimesfmWebConfig
} from '@agentix-e/anomaly-detector-web'

const timesfmConfig: TimesfmWebConfig = {
  modelUrl: 'https://cdn.example.com/timesfm-2.0.onnx',
  executionProvider: 'wasm',  // or 'webgl' for GPU acceleration
}

const detector = createWebDetector({
  forecaster: {
    type: 'timesfm',
    timesfm: timesfmConfig,
  },
})

const result = await detector.analyze(current, history)
```

If TimesFM Web is requested but `@agentix-e/timesfm-web` is not installed,
the detector logs a warning and falls back to anofox-forecast.

### Direct TimesFM Adapter Usage

```ts
import { TimesfmWebAdapter } from '@agentix-e/anomaly-detector-web'
import { createDetector } from '@agentix-e/anomaly-detector-web'

const adapter = new TimesfmWebAdapter({
  modelUrl: 'https://cdn.example.com/timesfm-2.0.onnx',
})

const detector = createDetector({
  _customForecaster: adapter,
})
```

## API Documentation

📚 **All core types and functions are re-exported from `@agentix-e/anomaly-detector-core`**.
See the [core README](../anomaly-detector-core/README.md) for the full API reference.

### Key Exports

| Export | Kind | Description |
|--------|------|-------------|
| `createWebDetector(config?)` | function | Creates a detector with TimesFM Web support (opt-in, graceful fallback) |
| `TimesfmWebAdapter` | class | Browser TimesFM adapter — wraps `@agentix-e/timesfm-web` via onnxruntime-web |
| `TimesfmWebConfig` | type | Configuration for TimesFM Web (modelUrl, executionProvider) |
| `createDetector` | function | Re-exported from core — zero-config shortcut |
| `IAnomalyDetector` | interface | Detector interface (re-exported) |
| `DetectorConfig` | type | Full configuration type (re-exported) |

## License

MIT
