import React, { useState } from "react";

// 今までの管理者の画面（人・企業・コースの作成）。開いたときだけ読み込む
const AdminUsers = React.lazy(() => import("../admin/AdminComponents.jsx").then(m => ({ default: m.AdminUsers })));
const AdminCompanies = React.lazy(() => import("../admin/AdminComponents.jsx").then(m => ({ default: m.AdminCompanies })));
const AdminCourses = React.lazy(() => import("../admin/AdminComponents.jsx").then(m => ({ default: m.AdminCourses })));

/* 人・企業（2026-10-20）。ユーザー・講師、企業、コースの作成と設定。管理者だけ */
const SUB = [["users", "人（受講生・講師・担当者）"], ["companies", "企業"], ["courses", "コースの作成・設定"]];

export default function ConsolePeople({ sub, setSub, onLegacy }) {
  const [cur, setCur] = useState(sub || "users");
  const pick = k => { setCur(k); setSub?.(k); };
  return (
    <>
      <div className="dhc-secttl"><h2>人・企業</h2></div>
      <div className="dhc-subtabs">
        {SUB.map(([k, t]) => <button key={k} type="button" aria-pressed={cur === k} onClick={() => pick(k)}>{t}</button>)}
      </div>
      <div className="dhc-pane" key={cur}>
        <React.Suspense fallback={<div className="dhc-empty">読み込んでいます…</div>}>
          {cur === "users" && <AdminUsers />}
          {cur === "companies" && <AdminCompanies />}
          {cur === "courses" && <AdminCourses go={v => onLegacy(v)} />}
        </React.Suspense>
      </div>
    </>
  );
}
