import React, { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

/* コースの「今日」の「連絡と教室」（2026-10-20、講師の使いやすさ）。
   お知らせ・チーム・席替えの今を1か所で見て、そのまま動けるようにする。
   お知らせは書いてから、宛先と文を確かめて出す（公開する前は必ず確認） */

const fmt = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`; };

function Box({ title, action, children }) {
  return (
    <div className="dhc-room">
      <h4>{title}{action}</h4>
      {children}
    </div>
  );
}

export default function CourseRoom({ course, openTab }) {
  const [anc, setAnc] = useState(null);
  const [teams, setTeams] = useState(null);
  const [seat, setSeat] = useState(null);
  const [compose, setCompose] = useState(null);
  const load = useCallback(() => {
    apiGet("/announcements").then(r => setAnc((r?.items || []).filter(a => a.courseId === course.id).slice(0, 3))).catch(() => setAnc("error"));
    apiGet(`/teams?courseId=${encodeURIComponent(course.id)}`).then(r => setTeams((r?.teams || []).filter(t => !t.endedAt && t.status !== "ended"))).catch(() => setTeams("error"));
    apiGet(`/seating?courseId=${encodeURIComponent(course.id)}`).then(r => setSeat(r || {})).catch(() => setSeat("error"));
  }, [course.id]);
  useEffect(() => { load(); }, [load]);
  const round = seat && seat !== "error" ? (seat.rounds || []).slice(-1)[0] : null;
  const seated = round ? Object.keys(round.assign || {}).length : 0;

  return (
    <div className="dhc-card dhc-sec">
      <h3>連絡と教室</h3>
      <div className="dhc-rooms">
        <Box title="お知らせ" action={<button type="button" className="dhc-sbtn pri" onClick={() => setCompose({ title: "", body: "", important: false })}>お知らせを出す</button>}>
          {anc === null ? <span className="dhc-note">読み込んでいます…</span>
            : anc === "error" ? <span className="dhc-note">確認できませんでした</span>
              : !anc.length ? <span className="dhc-note">このコースへのお知らせはまだありません</span>
                : anc.map(a => (
                  <div key={a.announcementId} className="dhc-li">
                    <b>{a.importance === "important" && <span className="dhc-pill bad">重要</span>} {a.title}</b>
                    <small>{fmt(a.publishedAt || a.createdAt)}</small>
                  </div>
                ))}
          <button type="button" className="dhc-lnk" onClick={() => openTab("announce")}>お知らせの一覧 →</button>
        </Box>
        <Box title="チーム" action={<button type="button" className="dhc-sbtn" onClick={() => openTab("teams")}>チームを開く</button>}>
          {teams === null ? <span className="dhc-note">読み込んでいます…</span>
            : teams === "error" ? <span className="dhc-note">確認できませんでした</span>
              : !teams.length ? <span className="dhc-note">チームはまだありません</span>
                : (<div className="dhc-teams">{teams.slice(0, 8).map(t => <span key={t.teamId}>{t.name}<em>{(t.members || []).length}人</em></span>)}{teams.length > 8 && <span>ほか {teams.length - 8}</span>}</div>)}
        </Box>
        <Box title="席替え" action={<button type="button" className="dhc-sbtn" onClick={() => openTab("seating")}>席替えを開く</button>}>
          {seat === null ? <span className="dhc-note">読み込んでいます…</span>
            : seat === "error" ? <span className="dhc-note">確認できませんでした</span>
              : !seat.layout ? <span className="dhc-note">教室の配置がまだありません</span>
                : !round ? <span className="dhc-note">配置はあります。席替えはまだです</span>
                  : (<div className="dhc-li"><b>{round.title || "席替え"} <span className={`dhc-pill ${round.status === "confirmed" ? "ok" : "warn"}`}>{round.status === "draft" ? "下書き" : "確定"}</span></b><small>{round.startDate ? `${round.startDate} から ・ ` : ""}{seated} 人の席</small></div>)}
        </Box>
      </div>
      {compose && (
        <ConfirmDialog title="このコースの受講生へお知らせを出す" runLabel="この内容で出す"
          canRun={!!compose.title.trim() && !!compose.body.trim()}
          rows={[["宛先", `${course.name} の受講生`], ["出す時", "すぐ（受講生のホームの一番上）"]]}
          onClose={() => { setCompose(null); load(); }}
          onRun={async () => { await apiPost("/announcements", { title: compose.title.trim(), body: compose.body.trim(), audience: "trainee", courseId: course.id, importance: compose.important ? "important" : "normal" }); return "出しました。"; }}>
          <label className="dhc-field">件名<input value={compose.title} maxLength={120} onChange={e => setCompose(x => ({ ...x, title: e.target.value }))} /></label>
          <label className="dhc-field">本文<textarea rows={6} value={compose.body} maxLength={4000} onChange={e => setCompose(x => ({ ...x, body: e.target.value }))} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "7px 10px", fontSize: 13.5, resize: "vertical" }} /></label>
          <div className="dhc-checks"><label className={compose.important ? "on" : ""}><input type="checkbox" checked={compose.important} onChange={e => setCompose(x => ({ ...x, important: e.target.checked }))} />重要として出す</label></div>
        </ConfirmDialog>
      )}
    </div>
  );
}
