import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/network-agenda/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase/supabase-js')) return 'supabase-vendor'
          if (id.includes('lucide-react')) return 'icons-vendor'
          if (id.includes('react')) return 'react-vendor'
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
})
