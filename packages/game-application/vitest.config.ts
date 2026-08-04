import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/operation-results.ts',
        'src/player-intent.ts',
        'src/session-snapshot.ts',
        'src/ports/**/*.ts',
      ],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 100,
        lines: 95,
      },
    },
  },
})
