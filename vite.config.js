import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// CloudFront のルート配信前提なので base は "/"。
// 将来サブパス配信にする場合のみ base を変更してください。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // mock/mode-split.html は社内検討用モック（実Product外）の第2エントリ。
      // index.htmlの既存ビルド・出力先には影響しない（追加のみ）。
      input: {
        // キー名"index"を維持し、既存の資産命名（assets/index-*.js）を変えない。
        index: resolve(__dirname, "index.html"),
        modeSplitMock: resolve(__dirname, "mock/mode-split.html"),
      },
    },
  },
});
