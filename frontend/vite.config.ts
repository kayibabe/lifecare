import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  css: {
    // This app uses Tailwind 4 through its Vite plugin. Do not inherit the
    // repository root's Tailwind 3 PostCSS configuration.
    postcss: { plugins: [] },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/fhir': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
