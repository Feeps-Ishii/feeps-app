import { lazy } from "react";

// 作り直した画面の登録（ロール → 画面のキー → コンポーネント）。ここに無い画面は今の画面を中に出す
export const LMS_SCREENS = {
  trainee: {
    home: lazy(() => import("./trainee/Home.jsx")),
    report: lazy(() => import("./trainee/Report.jsx")),
    att: lazy(() => import("./trainee/Attendance.jsx")),
    cur: lazy(() => import("./trainee/Curriculum.jsx")),
    test: lazy(() => import("./trainee/Tests.jsx")),
    prac: lazy(() => import("./trainee/Practice.jsx")),
    dev: lazy(() => import("./trainee/Dev.jsx")),
    doc: lazy(() => import("./trainee/Folder.jsx")),
  },
  instructor: {},
  client: {},
  admin: {},
};
