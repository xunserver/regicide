import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')

  return {
    base: env.VITE_BASE_PATH ?? '/',
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
    },
    build: {
      assetsInlineLimit: 4096,
      outDir: 'dist',
      sourcemap: false,
      target: 'es2018',
    },
  }
})
