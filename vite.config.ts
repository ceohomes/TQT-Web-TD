import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Cho phép SPA routing trong dev
    historyApiFallback: true,
  },
})
