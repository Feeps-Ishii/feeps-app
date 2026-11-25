import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../api.js";
import { Btn, Chip, Modal } from "../parts/ui.jsx";
import { arr } from "../staff/common.js";

/* 全コース共通の単元を読む・選ぶ・印を出す（単元の画面・コースを作る窓・コースの編集の棚で使う）。API は /curriculum-library */

export const SORTS = [["new", "新しい順"], ["used", "よく使う順"], ["name", "名前順"]];

export function sortUnits(list, sort) {
  const rows = list.map((u, i) => ({ u, i }));
  if (sort === "used") rows.sort((a, b) => arr(b.u.usedIn).length - arr(a.u.usedIn).length || a.i - b.i);
  else if (sort === "name") rows.sort((a, b) => String(a.u.title).localeCompare(String(b.u.title), "ja"));
  else rows.sort((a, b) => String(b.u.at || "").localeCompare(String(a.u.at || "")) || b.i - a.i);
  return rows.map(r => r.u);
}
export const matches = (u, q) => !q.trim() || String(u.title || "").toLowerCase().includes(q.trim().toLowerCase());

export function useShelf() {
  const [st, setSt] = useState({ state: "loading", units: [], updatedAt: "" });
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    apiGet("/curriculum-library").then(r => { if (alive) setSt({ state: "ready", units: arr(r?.units), updatedAt: r?.updatedAt || "" }); }).catch(() => { if (alive) setSt({ state: "error", units: [], updatedAt: "" }); });
    return () => { alive = false; };
  }, [key]);
  return { ...st, reload: () => setKey(k => k + 1) };
}

// コースに単元を足したら、どのコースで使ったかを書く（失敗しても足したことは取り消さない）
export function markUnitsUsed(courseId, unitIds) {
  const ids = [...new Set(arr(unitIds).filter(Boolean))];
  if (!courseId || !ids.length) return Promise.resolve();
  return apiPost("/curriculum-library/used", { courseId, unitIds: ids }).catch(() => {});
}

// 中身の 3 つの印（資料・テスト・練習問題）
export function UnitKinds({ u, small }) {
  const ks = [["doc", "資料", arr(u.files).length], ["tst", "テスト", arr(u.testIds).length], ["prc", "演習", arr(u.pracIds).length]];
  return <span className={`lu-ks${small ? " sm" : ""}`}>{ks.map(([c, t, n]) => <span key={c} className={`lu-k ${n ? c : "zero"}`}><i aria-hidden="true" />{t} <span className="num">{n}</span></span>)}</span>;
}

// コースを作るときに：単元を選んで足す
export function ShelfPicker({ onClose, onPick, has = [] }) {
  const shelf = useShelf();
  const [picked, setPicked] = useState({}); const [q, setQ] = useState(""); const [sort, setSort] = useState("new");
  const rows = sortUnits(shelf.units.filter(u => matches(u, q)), sort);
  const sel = shelf.units.filter(u => picked[u.id]);
  return (
    <Modal title="単元から足す" width={600} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={!sel.length} onClick={() => onPick(sel)}>{sel.length} 単元を足す</Btn></>}>
      {shelf.state === "error" ? <div className="empty"><b>単元を確認できません</b><Btn kind="ghost sm" onClick={shelf.reload}>再読み込み</Btn></div> : shelf.state === "loading" ? <div className="dv-mt">読み込み中</div> : (
        <>
          <div className="lu-tools pk"><span className="fsearch lu-q"><input type="search" value={q} placeholder="単元の名前で探す" aria-label="単元の名前で探す" onChange={e => setQ(e.target.value)} /></span><select className="in lu-sort" aria-label="並べ替え" value={sort} onChange={e => setSort(e.target.value)}>{SORTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
          <div className="lu-pl">
            {rows.map(u => {
              const on = has.includes(u.id);
              return (
                <label key={u.id} className={`lu-pr${on ? " has" : ""}`}>
                  <input type="checkbox" disabled={on} checked={on || !!picked[u.id]} onChange={e => setPicked(p => ({ ...p, [u.id]: e.target.checked }))} />
                  <span className="lu-pt"><b>{u.title || "名前なし"}</b><small>{arr(u.usedIn).length ? `${arr(u.usedIn).length} コースで使用` : "未使用"}</small></span>
                  {on ? <Chip tone="mk">入っています</Chip> : <UnitKinds u={u} small />}
                </label>
              );
            })}
            {!rows.length && <Chip>{shelf.units.length ? "見つかりません" : "単元はまだありません"}</Chip>}
          </div>
        </>
      )}
    </Modal>
  );
}

