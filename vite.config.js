import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

// CloudFront のルート配信前提なので base は "/"。
// 将来サブパス配信にする場合のみ base を変更してください。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 演習ウィンドウ（別窓）を2つ目の入口として出す。
  // CloudFront に SPA フォールバックが無いので、**実ファイルとして置く必要がある**。
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        exercise: resolve(__dirname, "exercise.html"),
      },
    },
  },
});
