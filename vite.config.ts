import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// 部署在子路徑（如 GitHub Pages 的 /biblexer/）時以 BASE_PATH 指定；預設為根目錄
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: null,
      registerType: 'autoUpdate',
      injectManifest: {
        // 只預先快取 app shell；資料、模型、ORT 由頁面下載並顯示進度（research R7）
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webmanifest}'],
        globIgnores: ['data/**', 'models/**', 'ort/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        rollupFormat: 'iife',
      },
      manifest: {
        name: 'BibLexer 語意串珠聖經',
        short_name: 'BibLexer',
        lang: 'zh-Hant-TW',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#fbf8f2',
        theme_color: '#7a4b2a',
        // 可安裝成 App（PWA）：Android 需要 192 與 512 的圖示；maskable 給自適應圖示裁切（主體在安全區內）
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
});
