import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/socket.io": { target: "ws://127.0.0.1:3000", ws: true },
      "/emulator": "http://127.0.0.1:3000",
    },
  },
  build: {
    target: "es2022",
    rollupOptions: { input: { main: "index.html", play: "play.html" } },
  },
});
