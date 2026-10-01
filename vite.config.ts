import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
        start_url: '/',
        display: 'standalone',
        background_color: '#fbf8f2',
        theme_color: '#7a4b2a',
        icons: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
});
