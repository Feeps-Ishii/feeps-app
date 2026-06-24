import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// CloudFront のルート配信前提なので base は "/"。
// 将来サブパス配信にする場合のみ base を変更してください。
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
