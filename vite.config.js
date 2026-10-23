import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 3000,
    watch: {
      ignored: [
        '**/undo-shell/.restore/**',
        '**/undo-shell/bin/**',
        '**/undo-shell/obj/**'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true
      }
    }
  }
})

