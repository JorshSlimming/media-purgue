import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
    },
    include: ['tests/unit/**/*.test.ts', 'tests/property/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  }
})
