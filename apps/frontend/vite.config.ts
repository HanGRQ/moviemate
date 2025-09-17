import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 代理以 /api 开头的请求到后端
      "/api": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false,
        // 如果后端不是以 /api 开头，也可以用 rewrite 改路径
        // rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
