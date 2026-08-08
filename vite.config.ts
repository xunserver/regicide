import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages: https://blog.xunserver.cn/regicide/
  base: '/regicide/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  optimizeDeps: {
    include: ['phaser'],
  },
  build: {
    target: 'es2022',
  },
})
