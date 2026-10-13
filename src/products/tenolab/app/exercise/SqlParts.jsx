import React, { useEffect, useState } from "react";
import { describeTables } from "./sqlRunner.js";
import "./bench.css";

/* SQL の結果の表と、テーブルの中身（2026-10-13）。レッスンの演習・演習一覧・案件体験で共通に使う */

export function SqlGrid({ set, max = 200, light = false }) {
  if (!set) return null;
  if (!set.columns.length) return null;
  return (
    <div className={`xb-grid ${light ? "light boxed" : ""}`}>
      <table>
        <thead><tr>{set.columns.map((c, k) => <th key={k} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {set.values.slice(0, max).map((r, i) => (
            <tr key={i}>{r.map((v, k) => <td key={k} className={v === null ? "null" : typeof v === "number" ? "num" : ""}>{v === null ? "NULL" : String(v)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// テーブルの中身。code を渡すと、そのSQLを流したあとの中身を見せる（INSERT・CREATE TABLE の結果が見える）。
// setup が null のときは何もしない（SQL 以外の演習で sql.js を読み込まない）
export function useSqlTables(setup, code = "", stamp = 0) {
  const [tables, setTables] = useState([]);
  useEffect(() => {
    if (setup === null) return undefined;
    let alive = true;
    describeTables(setup, code).then(t => { if (alive) setTables(t); }).catch(() => {});
    return () => { alive = false; };
  }, [setup, stamp]); // eslint-disable-line react-hooks/exhaustive-deps
  return tables;
}

// code を渡すと、そのSQLに出てくるテーブルを最初に開く
export function SqlTables({ tables, after = false, code = "" }) {
  const [open, setOpen] = useState("");
  // いちばん先に出てくるテーブル
  const used = tables
    .map(t => ({ t, at: String(code).search(new RegExp(`\\b${t.name}\\b`, "i")) }))
    .filter(x => x.at >= 0).sort((a, b) => a.at - b.at)[0]?.t;
  const cur = tables.find(t => t.name === open) || used || tables[0];
  if (!cur) return <div className="xb-db" />;
  return (
    <div className="xb-db">
      <div className="tabs" role="tablist" aria-label="テーブル">
        {tables.map(t => <button key={t.name} type="button" role="tab" aria-selected={t.name === cur.name} onClick={() => setOpen(t.name)}>{t.name}<small>{t.values.length}</small></button>)}
        {after && <span className="after">実行後</span>}
      </div>
      <div className="xb-grid light">
        <table>
          <thead><tr>{cur.columns.map(c => <th key={c.name} scope="col">{c.name}{c.pk && <i title="主キー">PK</i>}<small>{c.type}</small></th>)}</tr></thead>
          <tbody>{cur.values.map((r, i) => <tr key={i}>{r.map((v, k) => <td key={k} className={v === null ? "null" : typeof v === "number" ? "num" : ""}>{v === null ? "NULL" : String(v)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
