import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/rules.ts', 'src/types.ts'],
      thresholds: {
        statements: 97,
        branches: 95,
        functions: 100,
        lines: 99,
      },
    },
  },
})
