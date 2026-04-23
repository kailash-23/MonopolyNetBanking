import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const resolvedApiUrl = process.env.VITE_API_URL || process.env.BACKEND_URL || '';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(resolvedApiUrl),
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
});
