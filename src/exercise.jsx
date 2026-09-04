import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ExerciseWindowApp from "./products/learning/ExerciseWindowApp.jsx";

// 演習ウィンドウ専用のエントリ。**aws.js（認証）は読み込まない。**
// この窓はトークンを持たず、APIも叩かない（ADR 0021）。
createRoot(document.getElementById("root")).render(<ExerciseWindowApp />);
