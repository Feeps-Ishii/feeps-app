// ER図（テーブル設計）エディタ（2026-08-19新設）。
// 案件参画体験の成果物をアプリ内で作れるようにする第1弾。外部ツールで作ってURLを貼る
// 運用をやめ、ここで設計してそのまま提出できるようにする。
//
// 描画はSVGの自前実装。Mermaid等の外部ライブラリを足すとバンドルが増えるうえ、
// 「編集した結果がその場で図になる」体験を作りにくいため（ADR 0011のSandpack境界と同じ考え方で、
// 重い依存は増やさない）。
import React, { useMemo, useState } from "react";
import { Plus, Trash2, Table2, GitBranch, Code2 } from "lucide-react";
import { Badge, Btn, Card, EmptyState, T, fieldStyle } from "../../../components/common";
import {
  COLUMN_TYPES, CARDINALITIES, emptyErModel, newTable, newColumn, newRelation,
  sanitizeErModel, validateErModel, erModelToSql, tableName,
} from "./erModel.js";

const CARD_W = 190;
const CARD_GAP_X = 70;
const CARD_GAP_Y = 40;
const ROW_H = 18;
const HEAD_H = 26;

// テーブルを横3列のグリッドに並べ、リレーションを線で結ぶ。
// 自動レイアウトにしているのは、ドラッグ配置を入れると保存する座標が増えて
// 「設計を考える」より「図を整える」作業になってしまうため。
function useLayout(tables) {
  return useMemo(() => {
    const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(tables.length || 1))));
    const boxes = new Map();
    let y = 10;
    let rowH = 0;
    tables.forEach((t, i) => {
      const c = i % cols;
      if (c === 0 && i > 0) { y += rowH + CARD_GAP_Y; rowH = 0; }
      const h = HEAD_H + Math.max(1, (t.columns || []).length) * ROW_H + 8;
      rowH = Math.max(rowH, h);
      boxes.set(t.id, { x: 10 + c * (CARD_W + CARD_GAP_X), y, w: CARD_W, h });
    });
    const width = 20 + cols * CARD_W + (cols - 1) * CARD_GAP_X;
    const height = y + rowH + 20;
    return { boxes, width, height };
  }, [tables]);
}

function ErCanvas({ model }) {
  const tables = model.tables || [];
  const { boxes, width, height } = useLayout(tables);
  if (!tables.length) return null;

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: T.border, background: "#fff" }}>
      <svg width={Math.max(width, 320)} height={height} role="img" aria-label="ER図">
        {(model.relations || []).map(r => {
          const a = boxes.get(r.fromTableId);
          const b = boxes.get(r.toTableId);
          if (!a || !b) return null;
          const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2;
          const x2 = b.x + b.w / 2, y2 = b.y + b.h / 2;
          return (
            <g key={r.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={T.accent} strokeWidth="1.6" strokeDasharray="5 4" />
              <rect x={(x1 + x2) / 2 - 16} y={(y1 + y2) / 2 - 8} width="32" height="16" rx="8" fill="#fff" stroke={T.accent} strokeWidth="1" />
              <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" fontSize="9" fill={T.accent} fontWeight="700">{r.cardinality}</text>
            </g>
          );
        })}
        {tables.map(t => {
          const box = boxes.get(t.id);
          if (!box) return null;
          return (
            <g key={t.id}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" fill="#fff" stroke={T.border} strokeWidth="1.4" />
              <path d={`M${box.x} ${box.y + 8} a8 8 0 0 1 8 -8 h${box.w - 16} a8 8 0 0 1 8 8 v${HEAD_H - 8} h-${box.w} z`} fill={T.accentSubtle} />
              <text x={box.x + 10} y={box.y + 18} fontSize="11.5" fontWeight="700" fill={T.accentHover}>{t.name || "(名前未設定)"}</text>
              {(t.columns || []).map((c, i) => (
                <text key={c.id} x={box.x + 10} y={box.y + HEAD_H + 13 + i * ROW_H} fontSize="10.5"
                  fill={c.pk ? T.textPrimary : T.textSecondary} fontWeight={c.pk ? 700 : 400}>
                  {c.pk ? "🔑 " : ""}{c.name || "(未設定)"} : {c.type}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ColumnRow({ column, onChange, onRemove }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      <input style={{ ...fieldStyle, width: 130 }} value={column.name} placeholder="カラム名"
        onChange={e => onChange({ ...column, name: e.target.value })} />
      <select style={{ ...fieldStyle, width: 130 }} value={column.type}
        onChange={e => onChange({ ...column, type: e.target.value })}>
        {COLUMN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <label className="flex items-center gap-1 text-xs" style={{ color: T.textSecondary }}>
        <input type="checkbox" checked={!!column.pk} onChange={e => onChange({ ...column, pk: e.target.checked })} />PK
      </label>
      <label className="flex items-center gap-1 text-xs" style={{ color: T.textSecondary }}>
        <input type="checkbox" checked={!!column.notNull} onChange={e => onChange({ ...column, notNull: e.target.checked })} />NOT NULL
      </label>
      <input style={{ ...fieldStyle, flex: 1, minWidth: 120 }} value={column.comment} placeholder="説明（任意）"
        onChange={e => onChange({ ...column, comment: e.target.value })} />
      <Btn kind="ghost" size="sm" icon={Trash2} onClick={onRemove}>削除</Btn>
    </div>
  );
}

/**
 * @param value  保存済みのERモデル（null可）
 * @param onChange(model) 変更のたびに呼ぶ。提出テキストの生成は呼び出し側の責務
 */
export default function ErDiagramEditor({ value, onChange, readOnly = false }) {
  const model = useMemo(() => sanitizeErModel(value || emptyErModel()), [value]);
  const [showSql, setShowSql] = useState(false);
  const issues = useMemo(() => validateErModel(model), [model]);

  function update(next) {
    if (!readOnly) onChange(sanitizeErModel(next));
  }
  function updateTable(id, patch) {
    update({ ...model, tables: model.tables.map(t => (t.id === id ? { ...t, ...patch } : t)) });
  }

  if (readOnly && !model.tables.length) {
    return <p className="text-xs" style={{ color: T.textMuted }}>テーブル設計は未提出です。</p>;
  }

  return (
    <div className="space-y-3">
      {model.tables.length > 0 && <ErCanvas model={model} />}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Btn kind="ghost" size="sm" icon={Plus}
            onClick={() => update({ ...model, tables: [...model.tables, newTable(`table_${model.tables.length + 1}`)] })}>
            テーブルを追加
          </Btn>
          <Btn kind="ghost" size="sm" icon={GitBranch} disabled={model.tables.length < 2}
            onClick={() => update({ ...model, relations: [...model.relations, newRelation(model.tables[0].id, model.tables[1].id)] })}>
            リレーションを追加
          </Btn>
          <Btn kind="ghost" size="sm" icon={Code2} onClick={() => setShowSql(v => !v)}>
            {showSql ? "SQLを隠す" : "CREATE TABLEを見る"}
          </Btn>
        </div>
      )}

      {showSql && (
        <pre className="overflow-x-auto rounded-xl p-3 text-xs" style={{ background: "#0f172a", color: "#e2e8f0" }}>
          {erModelToSql(model) || "-- テーブルがありません"}
        </pre>
      )}

      {model.tables.length === 0 ? (
        <EmptyState icon={Table2} title="テーブルがありません" desc="「テーブルを追加」から設計を始めてください。" />
      ) : (
        <div className="space-y-3">
          {model.tables.map(t => (
            <Card key={t.id} className="p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Table2 size={14} style={{ color: T.accent }} />
                <input style={{ ...fieldStyle, width: 180, fontWeight: 700 }} value={t.name} placeholder="テーブル名"
                  disabled={readOnly} onChange={e => updateTable(t.id, { name: e.target.value })} />
                <input style={{ ...fieldStyle, flex: 1, minWidth: 160 }} value={t.comment} placeholder="このテーブルの役割（任意）"
                  disabled={readOnly} onChange={e => updateTable(t.id, { comment: e.target.value })} />
                {!readOnly && (
                  <Btn kind="ghost" size="sm" icon={Trash2}
                    onClick={() => update({ ...model, tables: model.tables.filter(x => x.id !== t.id) })}>
                    テーブル削除
                  </Btn>
                )}
              </div>
              <div className="divide-y" style={{ borderColor: T.border }}>
                {(t.columns || []).map(c => (
                  <ColumnRow key={c.id} column={c}
                    onChange={next => updateTable(t.id, { columns: t.columns.map(x => (x.id === c.id ? next : x)) })}
                    onRemove={() => updateTable(t.id, { columns: t.columns.filter(x => x.id !== c.id) })} />
                ))}
              </div>
              {!readOnly && (
                <Btn kind="ghost" size="sm" icon={Plus} className="mt-1"
                  onClick={() => updateTable(t.id, { columns: [...(t.columns || []), newColumn()] })}>
                  カラムを追加
                </Btn>
              )}
            </Card>
          ))}
        </div>
      )}

      {model.relations.length > 0 && (
        <Card className="p-3">
          <h4 className="mb-2 text-sm font-bold" style={{ color: T.textPrimary }}>リレーション</h4>
          <div className="space-y-2">
            {model.relations.map(r => {
              const fromCols = model.tables.find(t => t.id === r.fromTableId)?.columns || [];
              const toCols = model.tables.find(t => t.id === r.toTableId)?.columns || [];
              const set = patch => update({ ...model, relations: model.relations.map(x => (x.id === r.id ? { ...x, ...patch } : x)) });
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-1.5">
                  <select style={{ ...fieldStyle, width: 140 }} value={r.fromTableId} disabled={readOnly}
                    onChange={e => set({ fromTableId: e.target.value, fromColumnId: "" })}>
                    {model.tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select style={{ ...fieldStyle, width: 130 }} value={r.fromColumnId} disabled={readOnly}
                    onChange={e => set({ fromColumnId: e.target.value })}>
                    <option value="">カラムを選択</option>
                    {fromCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <span className="text-xs" style={{ color: T.textMuted }}>→</span>
                  <select style={{ ...fieldStyle, width: 140 }} value={r.toTableId} disabled={readOnly}
                    onChange={e => set({ toTableId: e.target.value, toColumnId: "" })}>
                    {model.tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select style={{ ...fieldStyle, width: 130 }} value={r.toColumnId} disabled={readOnly}
                    onChange={e => set({ toColumnId: e.target.value })}>
                    <option value="">カラムを選択</option>
                    {toCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select style={{ ...fieldStyle, width: 90 }} value={r.cardinality} disabled={readOnly}
                    onChange={e => set({ cardinality: e.target.value })}>
                    {CARDINALITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {!readOnly && (
                    <Btn kind="ghost" size="sm" icon={Trash2}
                      onClick={() => update({ ...model, relations: model.relations.filter(x => x.id !== r.id) })}>削除</Btn>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!readOnly && issues.length > 0 && (
        <Card className="p-3" style={{ background: T.warningSubtle }}>
          <p className="mb-1 text-xs font-bold" style={{ color: T.warning }}>提出前に確認してください（{issues.length}件）</p>
          <ul className="space-y-0.5">
            {issues.map((m, i) => <li key={i} className="text-xs" style={{ color: T.textSecondary }}>・{m}</li>)}
          </ul>
        </Card>
      )}
      {!readOnly && issues.length === 0 && model.tables.length > 0 && (
        <p className="text-xs" style={{ color: T.success }}>設計上の問題は見つかりませんでした。</p>
      )}
    </div>
  );
}

export { tableName };
