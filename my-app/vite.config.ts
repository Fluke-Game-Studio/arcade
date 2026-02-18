import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If deploying at https://arcade.flukegamestudio.com/:
export default defineConfig({
  plugins: [react()],
  base: '/',  // <-- subdomain root
})