import { lazy } from "react";

// 作り直した画面の登録（ロール → 画面のキー → コンポーネント）。ここに無い画面は今の画面を中に出す
export const LMS_SCREENS = {
  trainee: {
    home: lazy(() => import("./trainee/Home.jsx")),
  },
  instructor: {},
  client: {},
  admin: {},
};
