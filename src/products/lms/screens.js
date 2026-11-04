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
    team: lazy(() => import("./trainee/Team.jsx")),
    note: lazy(() => import("./trainee/Note.jsx")),
    goal: lazy(() => import("./trainee/Goal.jsx")),
  },
  instructor: {},
  client: {
    home: lazy(() => import("./client/Home.jsx")),
    report: lazy(() => import("./staff/Reports.jsx")),
    att: lazy(() => import("./staff/Attendance.jsx")),
    state: lazy(() => import("./client/State.jsx")),
    people: lazy(() => import("./staff/People.jsx")),
    done: lazy(() => import("./client/Done.jsx")),
    ann: lazy(() => import("./client/Ann.jsx")),
  },
  admin: {},
};
