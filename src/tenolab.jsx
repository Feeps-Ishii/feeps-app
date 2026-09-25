import React from "react";
import { createRoot } from "react-dom/client";
import "./aws.js";
import TenolabApp from "./products/tenolab/TenolabApp.jsx";

// テノラボ（体験型Eラーニング）専用の入口。LMS（index.html）とは別の画面として開く（ADR 0022）。
// 認証（aws.js）は LMS と共通。index.css（Tailwind・Prism）は読み込まない。
createRoot(document.getElementById("root")).render(<TenolabApp />);
