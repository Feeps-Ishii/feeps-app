import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { fetchAuthSession } from "aws-amplify/auth";
import "./index.css";
import "./aws.js";
import LearningAdminProduct from "./products/learning/admin/LearningAdminProduct.jsx";
import { roleOf, isStaffRole } from "./products/tenolab/role.js";

/* テノラボの講師・管理者メニューにはめ込む「コースの管理」（元の Feeps One のEラーニングの管理画面、ADR 0024）。
   Tailwind・Prism の見た目で作られていて、そのままテノラボの画面に入れると
   Tailwind の初期化（preflight）がテノラボ側の見た目まで変えてしまう。
   そこで別の入口（lab-embed.html#learning-admin）で開き、テノラボからは iframe で載せる。
   ログインは同じ（同じドメインなので、Cognito のトークンを共有する）。 */
const whichOf = () => (window.location.hash || "").replace(/^#\/?/, "");

function EmbedApp() {
  const [role, setRole] = useState(null); // null=読み込み中 / "out"=未ログイン
  const [which, setWhich] = useState(whichOf);
  useEffect(() => {
    const on = () => setWhich(whichOf());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    fetchAuthSession()
      .then(s => {
        const payload = s?.tokens?.idToken?.payload;
        setRole(payload ? roleOf(payload) : "out");
      })
      .catch(() => setRole("out"));
  }, []);

  if (role === null) return <p style={{ padding: 24, fontSize: 14 }}>読み込んでいます…</p>;
  if (role === "out") return <p style={{ padding: 24, fontSize: 14 }}>ログインが切れています。テノラボの画面でログインし直してください。</p>;

  let body;
  if (which === "learning-admin" && isStaffRole(role)) body = <LearningAdminProduct role={role} />;
  else body = <p style={{ fontSize: 14 }}>この画面は講師と管理者だけが使えます。</p>;
  return <div className="min-h-full bg-white p-4 md:p-6">{body}</div>;
}

createRoot(document.getElementById("root")).render(<EmbedApp />);
