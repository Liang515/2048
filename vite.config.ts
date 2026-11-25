import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    // 可加到手機主畫面、離線也能玩
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["2048.ico", "2048-96x96.png", "apple-touch-icon.png"],
      manifest: {
        name: "2048",
        short_name: "2048",
        description: "大字、好按、沒有廣告的 2048",
        lang: "zh-TW",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f5f5f4",
        theme_color: "#f5f5f4",
        icons: [
          { src: "web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,ico,svg,webmanifest}"],
        // 2048logo.png 頁面沒有用到（1.1MB），不放進離線快取
        globIgnores: ["**/2048logo.png"],
        runtimeCaching: [
          {
            // Google Fonts 字型檔快取，離線時字型也正常
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
  },
});
