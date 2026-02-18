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
      "/functions/v1": {
        target: "http://127.0.0.1:54321",
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-collapsible', '@radix-ui/react-label', '@radix-ui/react-popover', '@radix-ui/react-scroll-area', '@radix-ui/react-select', '@radix-ui/react-separator', '@radix-ui/react-slot', '@radix-ui/react-tabs', '@radix-ui/react-toggle', '@radix-ui/react-tooltip', 'lucide-react'],
          'syntax-highlighter': ['react-syntax-highlighter'],
          'markdown': ['react-markdown'],
          'supabase': ['@supabase/supabase-js'],
          'elevenlabs': ['@elevenlabs/react'],
          'utils': ['axios', 'clsx', 'tailwind-merge', 'class-variance-authority'],
        }
      }
    }
  }
});
