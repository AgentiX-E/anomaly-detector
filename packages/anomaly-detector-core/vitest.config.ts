import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/browser/**'],
    coverage: {
      provider: 'v8',
      include: ['src/detect/**/*.ts', 'src/calibrate/**/*.ts', 'src/utils/**/*.ts', 'src/visualize/**/*.ts', 'src/forecast/auto-select.ts'],
      exclude: ['src/**/index.ts'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
      reporter: ['text', 'lcov', 'html'],
    },
  },
})
