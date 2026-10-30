import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const tursoUrl =
    env.VITE_TURSO_DB_URL ||
    env.TURSO_DB_URL ||
    env.turso_db_url ||
    process.env.VITE_TURSO_DB_URL ||
    process.env.TURSO_DB_URL ||
    process.env.turso_db_url ||
    '';
  const tursoToken =
    env.VITE_TURSO_TOKEN ||
    env.TURSO_TOKEN ||
    env.turso_token ||
    process.env.VITE_TURSO_TOKEN ||
    process.env.TURSO_TOKEN ||
    process.env.turso_token ||
    '';

  return {
    base: '/family-plan/',
    define: {
      'import.meta.env.VITE_TURSO_DB_URL': JSON.stringify(tursoUrl),
      'import.meta.env.VITE_TURSO_TOKEN': JSON.stringify(tursoToken),
      'process.env.TURSO_DB_URL': JSON.stringify(tursoUrl),
      'process.env.TURSO_TOKEN': JSON.stringify(tursoToken),
      'process.env.turso_db_url': JSON.stringify(tursoUrl),
      'process.env.turso_token': JSON.stringify(tursoToken),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        includeAssets: [
          'favicon.svg',
          'icon-192x192.svg',
          'icon-512x512.svg',
          'favicon.ico',
          'apple-touch-icon.png',
          'masked-icon.svg',
          'icons/*.png',
          'icon.svg',
        ],
        manifest: {
          name: 'Prumo',
          short_name: 'Prumo',
          description: 'Gestão financeira familiar com foco em simplicidade e privacidade absoluta.',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#000000',
          theme_color: '#000000',
          icons: [
            {
              src: 'icon-192x192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: 'icon-512x512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallback: '/family-plan/index.html',
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*$/,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/.*\.turso\.io\/.*$/,
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3456',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
