import React from "react";

/* 教材の一覧（コース・演習・案件体験）を単元ごとに分ける・一覧から公開する・まとめて公開する（2026-10-13） */

export const needsPublish = x => !x.published || !!x.changed;

// 単元の並び順で分ける。単元が見つからないものは「その他」にまとめて最後に
export function groupByTopic(items, topics) {
  const order = [...(topics || [])].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  const known = new Set(order.map(t => t.id));
  const groups = order.map(t => ({ topic: t, items: items.filter(x => x.topic === t.id) }));
  const rest = items.filter(x => !known.has(x.topic));
  if (rest.length) groups.push({ topic: { id: "_other", name: "その他", color: "#767D8C" }, items: rest });
  return groups.filter(g => g.items.length);
}

// 1件ずつ順に公開する。公開できなかったものは理由と一緒に返す
export async function publishMany(list, publishOne) {
  const failed = [];
  let ok = 0;
  for (const x of list) {
    try { await publishOne(x); ok++; }
    catch (e) { failed.push({ title: x.title || x.id, error: e?.errorMessage || "公開できませんでした", issues: e?.data?.issues || [] }); }
  }
  return { ok, failed };
}

export function confirmPublish(list, extra = "") {
  const names = list.slice(0, 8).map(x => `・${x.title || x.id}`).join("\n");
  return window.confirm(`${list.length}件を公開します。受講生の画面にすぐ出ます。\n\n${names}${list.length > 8 ? `\n…ほか${list.length - 8}件` : ""}${extra ? `\n\n${extra}` : ""}`);
}

export function GroupHead({ topic, count, drafts, busy, onPublishAll }) {
  return (
    <div className="mgroup-h">
      <i style={{ background: topic.color || "#767D8C" }} aria-hidden="true" />
      <h3>{topic.name}</h3>
      <span className="muted">{count}件{drafts ? ` ・ 未公開 ${drafts}` : ""}</span>
      {drafts > 0 && <button type="button" className="btn ghost sm" disabled={busy} onClick={onPublishAll}>{busy ? "公開しています…" : `まとめて公開（${drafts}）`}</button>}
    </div>
  );
}

export function PublishResult({ res, onClose }) {
  if (!res) return null;
  return (
    <div className={`verdict ${res.failed.length ? "ng" : "ok"}`} role="status" style={{ display: "grid", gap: 4 }}>
      <div className="row" style={{ gap: 8 }}>
        <b>公開 {res.ok}件{res.failed.length ? ` ・ できなかった ${res.failed.length}件` : ""}</b>
        <button type="button" className="btn ghost sm" style={{ marginLeft: "auto" }} onClick={onClose}>閉じる</button>
      </div>
      {res.failed.map((f, i) => (
        <div key={i} style={{ fontSize: 13 }}>{f.title}：{f.error}{f.issues?.length ? `（${f.issues.join("／")}）` : ""}</div>
      ))}
    </div>
  );
}
