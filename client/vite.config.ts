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
      "/api/chat": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/api/search": {
        target: "http://localhost:3001",
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
      "/api/conversation-signature": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/api/conversation-webhook": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/api/conversation-audio": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
});
