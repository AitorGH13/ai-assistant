import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/conversation": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/api/voices": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/api/speak": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
