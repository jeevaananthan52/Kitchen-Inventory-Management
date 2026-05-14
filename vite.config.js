import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to FastAPI backend during development.
    // This means you can call fetch('/items/') in React instead of
    // hardcoding 'http://127.0.0.1:8000/items/', which breaks in production.
    proxy: {
      '/items': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})