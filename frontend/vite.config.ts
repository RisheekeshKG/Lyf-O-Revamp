import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),

    electron({
      main: {
        // ✅ Electron main process
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron", // main -> dist-electron/main.js
          },
        },
      },

      preload: {
        // ✅ Preload script (contextBridge)
        input: path.join(__dirname, "electron/preload.ts"),
        vite: {
          build: {
            outDir: "dist-electron", // preload -> dist-electron/preload.js
            rollupOptions: {
              output: {
                // 👇 this line fixes the .mjs issue
                entryFileNames: "preload.js",
              },
            },
          },
        },
      },

      renderer: process.env.NODE_ENV === "test" ? undefined : {},
    }),
  ],

  // ✅ Clean import aliases
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  // ✅ Tailwind / PostCSS config
  css: {
    postcss: path.resolve(__dirname, "postcss.config.cjs"),
  },

  // ✅ Build configuration
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },

  // ✅ Dev server settings
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    watch: {
      ignored: [
        "**/data/**", // ignore /data to avoid unnecessary reloads
        "!**/src/**",
      ],
    },
  },
});
