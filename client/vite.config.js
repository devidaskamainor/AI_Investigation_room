import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { force: true },
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000' },
  },
  build: { sourcemap: false },
});
