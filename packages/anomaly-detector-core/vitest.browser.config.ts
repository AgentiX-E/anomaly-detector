import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      name: process.env.BROWSER || 'chromium',
      provider: 'playwright',
      headless: true,
    },
  },
})
