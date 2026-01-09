import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        parserOpts: {
          plugins: ['decorators-legacy']
        }
      }
    }),
    // VitePWA plugin temporarily removed for Vercel build compatibility
  ],
  server: {
    port: 5174,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: [
      '.loca.lt',
      'small-trees-stare.loca.lt'
    ],
    https: {
      key: (() => {
        try {
          return require('fs').readFileSync('../backend/certs/server.key');
        } catch (e) { return undefined; }
      })(),
      cert: (() => {
        try {
          return require('fs').readFileSync('../backend/certs/server.cert');
        } catch (e) { return undefined; }
      })(),
    },
    hmr: {
      protocol: 'ws',
      overlay: false
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/.git/**']
    }
  },
})