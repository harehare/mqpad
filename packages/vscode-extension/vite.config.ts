import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  optimizeDeps: { exclude: ["mq-web"] },
  build: {
    outDir: "dist/webview",
    emptyOutDir: true,
  },
});
