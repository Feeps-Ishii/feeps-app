// 表計算（Excel風）エディタ（2026-08-19新設）。要件一覧・試算表・工数見積のような
// 「表で考える」演習をアプリ内で完結させる。
import React, { useMemo, useState } from "react";
import { Plus, Minus, Table2 } from "lucide-react";
import { Badge, Btn, Card, T } from "../../../components/common";
import {
  MAX_COLS, MAX_ROWS, colLabel, cellRef, emptySheetModel, sanitizeSheetModel,
  evaluateCell, validateSheetModel,
} from "./sheetModel.js";

export default function SpreadsheetEditor({ value, onChange, readOnly = false }) {
  const model = useMemo(() => sanitizeSheetModel(value || emptySheetModel()), [value]);
  // 編集中のセルだけ生の文字列（数式）を出し、それ以外は計算結果を出す
  const [editing, setEditing] = useState("");
  const issues = useMemo(() => validateSheetModel(model), [model]);

  function update(next) {
    if (!readOnly) onChange(sanitizeSheetModel(next));
  }
  function setCell(ref, raw) {
    const cells = { ...model.cells };
    if (raw === "") delete cells[ref]; else cells[ref] = raw;
    update({ ...model, cells });
  }

  const cellStyle = {
    border: `1px solid ${T.border}`, padding: "4px 6px", fontSize: 12.5,
    minWidth: 96, background: "#fff", color: T.textPrimary, outline: "none", width: "100%",
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Btn kind="ghost" size="sm" icon={Plus} disabled={model.cols >= MAX_COLS}
            onClick={() => update({ ...model, cols: model.cols + 1 })}>列を追加</Btn>
          <Btn kind="ghost" size="sm" icon={Minus} disabled={model.cols <= 1}
            onClick={() => update({ ...model, cols: model.cols - 1 })}>列を削除</Btn>
          <Btn kind="ghost" size="sm" icon={Plus} disabled={model.rows >= MAX_ROWS}
            onClick={() => update({ ...model, rows: model.rows + 1 })}>行を追加</Btn>
          <Btn kind="ghost" size="sm" icon={Minus} disabled={model.rows <= 1}
            onClick={() => update({ ...model, rows: model.rows - 1 })}>行を削除</Btn>
          <label className="flex items-center gap-1 text-xs" style={{ color: T.textSecondary }}>
            <input type="checkbox" checked={model.headerRow !== false}
              onChange={e => update({ ...model, headerRow: e.target.checked })} />1行目を見出しにする
          </label>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: T.border }}>
        <table style={{ borderCollapse: "collapse", background: "#fff" }}>
          <thead>
            <tr>
              <th style={{ ...cellStyle, minWidth: 34, background: T.surfaceMuted || T.soft, color: T.textMuted }} />
              {Array.from({ length: model.cols }, (_, c) => (
                <th key={c} style={{ ...cellStyle, background: T.surfaceMuted || T.soft, color: T.textMuted, fontWeight: 700 }}>
                  {colLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: model.rows }, (_, r) => (
              <tr key={r}>
                <td style={{ ...cellStyle, background: T.surfaceMuted || T.soft, color: T.textMuted, textAlign: "center", minWidth: 34 }}>{r + 1}</td>
                {Array.from({ length: model.cols }, (_, c) => {
                  const ref = cellRef(c, r);
                  const raw = model.cells[ref] || "";
                  const isHeader = model.headerRow !== false && r === 0;
                  const shown = editing === ref ? raw : (raw.startsWith("=") ? evaluateCell(model, ref) : raw);
                  const isError = typeof shown === "string" && shown.startsWith("#");
                  return (
                    <td key={c} style={{ padding: 0, border: `1px solid ${T.border}` }}>
                      <input
                        value={shown}
                        readOnly={readOnly}
                        onFocus={() => setEditing(ref)}
                        onBlur={() => setEditing("")}
                        onChange={e => setCell(ref, e.target.value)}
                        style={{
                          ...cellStyle, border: "none",
                          fontWeight: isHeader ? 700 : 400,
                          background: isHeader ? (T.accentSubtle || "#f5f7fa") : "#fff",
                          color: isError ? T.danger : (raw.startsWith("=") && editing !== ref ? T.accentHover : T.textPrimary),
                          textAlign: /^-?[0-9.,]+$/.test(String(shown)) ? "right" : "left",
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <p className="text-xs" style={{ color: T.textMuted }}>
          <Table2 size={11} className="mr-1 inline" />
          数式が使えます: <code>=A1+B1</code> / <code>=SUM(A2:A9)</code> / <code>=AVERAGE(B2:B9)</code>（COUNT・MIN・MAXも可）。
          数式セルは確定すると計算結果を表示します。
        </p>
      )}

      {!readOnly && issues.length > 0 && (
        <Card className="p-3" style={{ background: T.warningSubtle }}>
          <p className="mb-1 text-xs font-bold" style={{ color: T.warning }}>確認してください（{issues.length}件）</p>
          <ul className="space-y-0.5">
            {issues.map((m, i) => <li key={i} className="text-xs" style={{ color: T.textSecondary }}>・{m}</li>)}
          </ul>
        </Card>
      )}
      {!readOnly && issues.length === 0 && Object.keys(model.cells).length > 0 && (
        <Badge tone="green">計算エラーはありません</Badge>
      )}
    </div>
  );
}
