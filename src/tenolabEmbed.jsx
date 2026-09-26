import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { fetchAuthSession } from "aws-amplify/auth";
import "./index.css";
import "./aws.js";
import { PRODUCT_ACCENT } from "./components/common";
import DevLabProduct from "./products/devlab/DevLabProduct.jsx";
import CloudLabProduct from "./products/cloudlab/CloudLabProduct.jsx";

/* テノラボの中にはめ込む「開発演習」「クラウド実習」（ADR 0022）。
   どちらも Tailwind・Prism の見た目で作られていて、そのままテノラボの画面に入れると
   Tailwind の初期化（preflight）がテノラボ側の見た目まで変えてしまう。
   そこで別の入口（lab-embed.html）で開き、テノラボからは iframe で載せる。
   ログインは同じ（同じドメインなので、Cognito のトークンを共有する）。
   見た目をテノラボに置き換えたら、この入口は外す。 */
const WHICH = (window.location.hash || "").replace(/^#\/?/, "");

function roleOf(payload = {}) {
  const claimed = String(payload?.["custom:role"] || payload?.role || "").toLowerCase();
  if (["admin", "instructor", "client", "trainee"].includes(claimed)) return claimed;
  const raw = payload?.["cognito:groups"] ?? payload?.groups ?? [];
  const g = (Array.isArray(raw) ? raw.join(",") : String(raw)).toLowerCase();
  return g.includes("admin") ? "admin" : g.includes("instructor") ? "instructor" : g.includes("client") ? "client" : "trainee";
}

function EmbedApp() {
  const [role, setRole] = useState(null); // null=読み込み中 / "out"=未ログイン
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
  if (WHICH === "cloudlab") {
    body = role === "client"
      ? <p style={{ fontSize: 14 }}>クラウド実習は、受講する方の機能です。</p>
      : <CloudLabProduct />;
  } else {
    body = role === "client"
      ? <DevLabProduct subView="dl_manage_teams" goSub={() => {}} role={role} themeColor={PRODUCT_ACCENT.learning.accent} />
      : <DevLabProduct subView="dl_projects" goSub={() => {}} role={role} themeColor={PRODUCT_ACCENT.learning.accent} />;
  }
  return <div className="min-h-full bg-white p-4 md:p-6">{body}</div>;
}

createRoot(document.getElementById("root")).render(<EmbedApp />);
