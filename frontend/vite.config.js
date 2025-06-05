import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://trading-app-backend-t9k9.onrender.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
