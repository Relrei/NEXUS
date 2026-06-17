import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `--mode single` で1ファイルHTML(スマホ転送用)。それ以外は通常のPWAビルド。
// 単一HTMLではPWA(service worker=別ファイル必須)を外し、全アセットをindex.htmlへインライン。
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(single
        ? [viteSingleFile()]
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
              manifest: {
                name: 'NEXUS',
                short_name: 'NEXUS',
                description: '散らばった素材を集め、束ね、渡せる形に梱包する個人の倉庫',
                theme_color: '#05070d',
                background_color: '#05070d',
                display: 'standalone',
                orientation: 'any',
                icons: [
                  { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
                  { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
                  { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
              },
              workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
            }),
          ]),
    ],
    build: single ? { outDir: 'dist-single', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 100000 } : {},
  }
})
