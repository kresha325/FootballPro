import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function injectFacebookAppId(mode) {
  const env = loadEnv(mode, process.cwd(), '')
  const raw = String(env.VITE_FACEBOOK_APP_ID || env.FACEBOOK_APP_ID || '').trim()
  const appId = /^\d+$/.test(raw) ? raw : ''
  return {
    name: 'inject-facebook-app-id',
    transformIndexHtml(html) {
      if (!appId) {
        return html.replace(/\s*<!--fb:app_id-->\n?/, '\n')
      }
      return html.replace(
        '<!--fb:app_id-->',
        `<meta property="fb:app_id" content="${appId}" />`
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        parserOpts: {
          plugins: ['decorators-legacy']
        }
      }
    }),
    injectFacebookAppId(mode),
    // VitePWA plugin temporarily removed for Vercel build compatibility
  ],
  build: {
    chunkSizeWarningLimit: 2000, // default është 500kb, rritet në 2000kb
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    css: true
  },
  server: {
    port: 5174,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: [
      '.loca.lt',
      'small-trees-stare.loca.lt',
      'xtalenti.com',
      'www.xtalenti.com',
    ],
    // https: {
    //   key: (() => {
    //     try {
    //       return require('fs').readFileSync('../backend/certs/server.key');
    //     } catch (e) { return undefined; }
    //   })(),
    //   cert: (() => {
    //     try {
    //       return require('fs').readFileSync('../backend/certs/server.cert');
    //     } catch (e) { return undefined; }
    //   })(),
    // },
    hmr: {
      protocol: 'ws',
      overlay: false
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/.git/**']
    }
  },
}))