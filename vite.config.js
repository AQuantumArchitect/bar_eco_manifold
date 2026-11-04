import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The only chunk above Vite's 500 kB default is Surface3D, which is the
    // three.js core (~500 kB; WebGLRenderer pulls in nearly all of it). It is
    // lazy-loaded only when the 3D view is opened, so it never blocks first paint.
    chunkSizeWarningLimit: 520,
    rollupOptions: {
      output: {
        // Keep the charting stack (recharts + d3) out of the app chunk so each
        // piece stays under Vite's 500 kB warning and caches independently.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|lodash)[\\/]/.test(id)) return 'charts';
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
        },
      },
    },
  },
});
