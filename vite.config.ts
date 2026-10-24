import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages adresi: https://ncg0659.github.io/popgrid/
export default defineConfig({
  base: '/popgrid/',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
