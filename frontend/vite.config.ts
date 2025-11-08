import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
      },
      renderer: process.env.NODE_ENV === "test" ? undefined : {},
    }),
  ],

  // ✅ Clean imports
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  // ✅ Tailwind + PostCSS
  css: {
    postcss: path.resolve(__dirname, "postcss.config.cjs"),
  },

  // ✅ Output and build config
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },

  // ✅ Development server config
  server: {
    port: 5173,
    strictPort: true,
    open: false,

    // 🚫 Prevent hot-reload when JSON files in /data change
    watch: {
      ignored: [
        "**/data/**", // ignore data folder at project root
        "!**/src/**", // allow normal src watching
      ],
    },
  },
});
