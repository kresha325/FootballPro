import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FootballPro',
        short_name: 'FootballPro',
        description: 'Football social platform',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 5174,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: [
      '.loca.lt',
      'small-trees-stare.loca.lt',
      'localhost',
      '192.168.100.57'
    ],
    hmr: {
      host: '192.168.100.57',
      protocol: 'ws',
      overlay: false
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/.git/**']
    }
  },
})