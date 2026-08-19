// 画面設計（ワイヤーフレーム）エディタ（2026-08-19新設）。
// 行を上から積み、行の中にブロックを並べる方式。編集と同時に実際の画面イメージを出す。
import React, { useMemo, useState } from "react";
import { Plus, Trash2, Monitor } from "lucide-react";
import { Badge, Btn, Card, EmptyState, T, fieldStyle } from "../../../components/common";
import {
  BLOCK_TYPES, BLOCK_LABEL, emptyWireModel, newScreen, newRow, newBlock,
  sanitizeWireModel, validateWireModel,
} from "./wireModel.js";

// ブロック種別ごとの見た目。ワイヤーなので色は使わず、高さと枠線の質感だけで区別する。
const BLOCK_STYLE = {
  header: { h: 34, fill: "#e9edf3", dashed: false },
  nav: { h: 26, fill: "#eef1f6", dashed: false },
  heading: { h: 24, fill: "#e4e8ef", dashed: false },
  text: { h: 44, fill: "#f4f6fa", dashed: true },
  image: { h: 68, fill: "#eceff5", dashed: true },
  form: { h: 62, fill: "#f1f4f9", dashed: false },
  table: { h: 72, fill: "#f1f4f9", dashed: false },
  card: { h: 56, fill: "#f4f6fa", dashed: false },
  button: { h: 26, fill: "#dfe5ee", dashed: false },
  footer: { h: 30, fill: "#e9edf3", dashed: false },
};

function WirePreview({ screen }) {
  return (
    <div className="rounded-xl border p-2" style={{ borderColor: T.border, background: "#fff" }}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: "#cbd5e1" }} />
        <span className="h-2 w-2 rounded-full" style={{ background: "#cbd5e1" }} />
        <span className="h-2 w-2 rounded-full" style={{ background: "#cbd5e1" }} />
        <span className="ml-1 text-[10px]" style={{ color: T.textMuted }}>{screen.name}</span>
      </div>
      <div className="space-y-1.5">
        {screen.rows.map(r => (
          <div key={r.id} className="flex gap-1.5">
            {r.blocks.map(b => {
              const st = BLOCK_STYLE[b.type] || BLOCK_STYLE.text;
              return (
                <div key={b.id} className="flex flex-1 items-center justify-center rounded px-1 text-center"
                  style={{
                    height: st.h, background: st.fill,
                    border: `1px ${st.dashed ? "dashed" : "solid"} #c3cbd8`,
                    fontSize: 10, color: "#5b6472", overflow: "hidden",
                  }}>
                  <span className="truncate">{b.label || BLOCK_LABEL[b.type]}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WireframeEditor({ value, onChange, readOnly = false }) {
  const model = useMemo(() => sanitizeWireModel(value || emptyWireModel()), [value]);
  const [activeId, setActiveId] = useState("");
  const issues = useMemo(() => validateWireModel(model), [model]);
  const active = model.screens.find(s => s.id === activeId) || model.screens[0];

  function update(next) {
    if (!readOnly) onChange(sanitizeWireModel(next));
  }
  function updateScreen(id, patch) {
    update({ ...model, screens: model.screens.map(s => (s.id === id ? { ...s, ...patch } : s)) });
  }
  function updateRow(screenId, rowId, patch) {
    const sc = model.screens.find(s => s.id === screenId);
    if (!sc) return;
    updateScreen(screenId, { rows: sc.rows.map(r => (r.id === rowId ? { ...r, ...patch } : r)) });
  }

  if (readOnly) {
    if (!model.screens.length) return <p className="text-xs" style={{ color: T.textMuted }}>画面設計は未提出です。</p>;
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {model.screens.map(sc => <WirePreview key={sc.id} screen={sc} />)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {model.screens.map(sc => (
          <button key={sc.id} type="button" onClick={() => setActiveId(sc.id)}
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={sc.id === active?.id
              ? { background: T.accentSubtle, color: T.accentHover }
              : { background: "transparent", color: T.textMuted, border: `1px solid ${T.border}` }}>
            {sc.name}
          </button>
        ))}
        <Btn kind="ghost" size="sm" icon={Plus}
          onClick={() => {
            const sc = newScreen(`画面${model.screens.length + 1}`);
            update({ ...model, screens: [...model.screens, sc] });
            setActiveId(sc.id);
          }}>画面を追加</Btn>
      </div>

      {!active ? (
        <EmptyState icon={Monitor} title="画面がありません" desc="「画面を追加」から設計を始めてください。" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input style={{ ...fieldStyle, flex: 1, minWidth: 160, fontWeight: 700 }} value={active.name}
                placeholder="画面名（例: ログイン画面）" onChange={e => updateScreen(active.id, { name: e.target.value })} />
              {model.screens.length > 1 && (
                <Btn kind="ghost" size="sm" icon={Trash2}
                  onClick={() => update({ ...model, screens: model.screens.filter(s => s.id !== active.id) })}>画面を削除</Btn>
              )}
            </div>

            {active.rows.map((r, ri) => (
              <Card key={r.id} className="p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold" style={{ color: T.textMuted }}>{ri + 1}段目</span>
                  <div className="flex gap-1">
                    <Btn kind="ghost" size="sm" icon={Plus} disabled={r.blocks.length >= 4}
                      onClick={() => updateRow(active.id, r.id, { blocks: [...r.blocks, newBlock()] })}>横に追加</Btn>
                    <Btn kind="ghost" size="sm" icon={Trash2}
                      onClick={() => updateScreen(active.id, { rows: active.rows.filter(x => x.id !== r.id) })}>段を削除</Btn>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {r.blocks.map(b => (
                    <div key={b.id} className="flex flex-wrap items-center gap-1.5">
                      <select style={{ ...fieldStyle, width: 150 }} value={b.type}
                        onChange={e => updateRow(active.id, r.id, { blocks: r.blocks.map(x => (x.id === b.id ? { ...x, type: e.target.value } : x)) })}>
                        {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <input style={{ ...fieldStyle, flex: 1, minWidth: 140 }} value={b.label}
                        placeholder="何を置くか（例: メールアドレス入力）"
                        onChange={e => updateRow(active.id, r.id, { blocks: r.blocks.map(x => (x.id === b.id ? { ...x, label: e.target.value } : x)) })} />
                      {r.blocks.length > 1 && (
                        <Btn kind="ghost" size="sm" icon={Trash2}
                          onClick={() => updateRow(active.id, r.id, { blocks: r.blocks.filter(x => x.id !== b.id) })}>削除</Btn>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            <Btn kind="ghost" size="sm" icon={Plus}
              onClick={() => updateScreen(active.id, { rows: [...active.rows, newRow()] })}>段を追加</Btn>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold" style={{ color: T.textMuted }}>画面イメージ</p>
            <WirePreview screen={active} />
          </div>
        </div>
      )}

      {issues.length > 0 ? (
        <Card className="p-3" style={{ background: T.warningSubtle }}>
          <p className="mb-1 text-xs font-bold" style={{ color: T.warning }}>提出前に確認してください（{issues.length}件）</p>
          <ul className="space-y-0.5">
            {issues.map((m, i) => <li key={i} className="text-xs" style={{ color: T.textSecondary }}>・{m}</li>)}
          </ul>
        </Card>
      ) : <Badge tone="green">設計上の問題は見つかりませんでした</Badge>}
    </div>
  );
}
