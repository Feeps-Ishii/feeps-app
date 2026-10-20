import React from "react";
import FirstSetup from "../tenolab/app/FirstSetup.jsx";
import "./firstSetupLms.css";

/* LMS のはじめての設定（2026-10-20）。まとめて発行した仮のID（@id.devhub-lms.com）で LMS に入った人も、
   DevHub Learning と同じように、パスワードを変えたあとに名前とメールアドレスを登録する（profile.placeholder が外れるまで）。
   中身は Learning の FirstSetup をそのまま使い、見た目だけ .fs-lms の中で当てる */
export default function FirstSetupLms({ name, onDone, onLogout }) {
  return (
    <div className="fs-lms">
      <header><b>DevHub LMS</b><button type="button" onClick={onLogout}>ログアウト</button></header>
      <FirstSetup name={name} onDone={onDone} />
    </div>
  );
}
