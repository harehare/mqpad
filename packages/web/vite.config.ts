import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      workbox: {
        // mq-web's wasm binary isn't matched by the default globPatterns
        // (js/css/html/svg/png/ico/woff*), so it'd otherwise be fetched live
        // every time the runner first runs offline.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm}"],
        // Default 2 MiB cap is below both the mermaid-heavy main bundle and
        // mq-web's wasm binary - raised so they still get precached.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: "mqpad",
        short_name: "mqpad",
        description: "A WYSIWYG Markdown editor with Obsidian-style links and live mq code blocks",
        theme_color: "#67b8e3",
        background_color: "#16273a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  optimizeDeps: { exclude: ["mq-web"] },
});
