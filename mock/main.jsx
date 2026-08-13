import React from "react";
import { createRoot } from "react-dom/client";
import "../src/index.css";
import ModeSplitMock from "./ModeSplitMock.jsx";

// 社内検討用モック専用エントリ。src/main.jsx（本体アプリ、aws.js/Cognito読み込み）とは
// 完全に独立させ、認証・実API呼び出しを一切発生させない。
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ModeSplitMock />
  </React.StrictMode>
);
