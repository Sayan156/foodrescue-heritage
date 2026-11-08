import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Both local and tunnel traffic use the same /api URL as the frontend.
  server: {
    port: 5173,
    allowedHosts: [
      'outdoor-pastor-courtesy-nowhere.trycloudflare.com'
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  }
})

