import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/detect/**/*.ts', 'src/calibrate/**/*.ts', 'src/utils/**/*.ts'],
      exclude: ['src/**/index.ts'],
      thresholds: {
        statements: 95, branches: 80, functions: 95, lines: 95,
      },
      reporter: ['text', 'lcov'],
    },
  },
})
