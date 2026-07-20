import React, { useRef, useState } from "react";
import { Check, Copy, Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import Btn from "./Btn.jsx";
import Modal from "./Modal.jsx";
import { T } from "./theme.js";
import {
  downloadTraineeImportTemplate, importTraineeRow, parseTraineeImportFile,
} from "../../utils/common/traineeImportSchema.js";

const STATUS_LABEL = {
  created: "登録成功",
  created_partial: "登録成功（一部項目未保存）",
  skipped: "登録済みのためスキップ",
  error: "失敗",
};
const STATUS_TONE = {
  created: T.success, created_partial: T.warning, skipped: T.textMuted, error: T.danger,
};

// 社員（受講生）Excelひな形一括インポート: ひな形DL→アップロード→プレビュー（行ごとの検証）→登録実行→行ごとの結果 を1コンポーネントに集約。
// admin用（AdminComponents.jsx）とclient/admin共用（GrantsComponents.jsx）の両方から使う共通UI。
export default function TraineeBulkImportPanel({
  label = "Excelで一括登録",
  desc = "ひな形をダウンロードして記入し、アップロードしてください。登録前に内容を確認できます。",
  courses = [],
  companyId,
  disabledReason = "",
  onCompleted,
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null); // { fileName, rows, validCount, errorCount }
  const [results, setResults] = useState(null); // row-keyed map: rowNumber -> result
  const [running, setRunning] = useState(false);
  const [parseError, setParseError] = useState("");
  const fileRef = useRef(null);

  function reset() {
    setPreview(null); setResults(null); setParseError("");
  }
  function close() {
    setOpen(false);
    const hadResults = !!results;
    reset();
    if (hadResults && onCompleted) onCompleted();
  }

  async function handleFile(file) {
    if (!file) return;
    setParseError(""); setResults(null);
    try {
      const parsed = await parseTraineeImportFile(file, { courses });
      setPreview(parsed);
    } catch (e) {
      setParseError(e?.message || String(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runImport() {
    if (!preview || running) return;
    const validRows = preview.rows.filter(r => r.ok);
    if (!validRows.length) return;
    setRunning(true);
    const next = {};
    for (const row of validRows) {
      next[row.rowNumber] = await importTraineeRow(row.values, { companyId });
      setResults({ ...next });
    }
    setRunning(false);
  }

  async function retryRow(row) {
    setResults(state => ({ ...state, [row.rowNumber]: { ...state[row.rowNumber], status: "retrying" } }));
    const result = await importTraineeRow(row.values, { companyId });
    setResults(state => ({ ...state, [row.rowNumber]: result }));
  }

  async function copyPassword(text) {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard未対応環境では無視 */ }
  }

  const errorRows = preview ? preview.rows.filter(r => !r.ok) : [];
  const okRows = preview ? preview.rows.filter(r => r.ok) : [];

  return (
    <>
      <Btn kind="ghost" size="sm" icon={FileSpreadsheet} disabled={!!disabledReason} title={disabledReason || undefined}
        onClick={() => { reset(); setOpen(true); }}>{label}</Btn>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />

      {open && (
        <Modal
          title={results ? "登録結果" : "Excelで一括登録"}
          desc={results ? undefined : desc}
          size="xl"
          onClose={running ? undefined : close}
          footer={results ? (
            <Btn icon={Check} onClick={close}>閉じる</Btn>
          ) : preview ? (
            <>
              <Btn kind="ghost" onClick={() => { reset(); }} disabled={running}>やり直す</Btn>
              <Btn icon={Check} onClick={runImport} disabled={running || okRows.length === 0}>
                {running ? "登録中…" : `この内容で登録する（${okRows.length}件）`}
              </Btn>
            </>
          ) : (
            <Btn kind="ghost" onClick={close}>閉じる</Btn>
          )}
        >
          {results ? (
            <ResultsTable rows={preview.rows.filter(r => r.ok)} results={results} onRetry={retryRow} onCopyPassword={copyPassword} />
          ) : preview ? (
            <div className="space-y-4">
              <div className="rounded-xl p-3" style={{ background: T.bgBase }}>
                <div className="text-xs" style={{ color: T.textMuted }}>ファイル</div>
                <div className="mt-1 text-sm font-bold" style={{ color: T.textPrimary }}>{preview.fileName}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                <div className="rounded-xl p-3 text-center" style={{ border: `1px solid ${T.border}` }}>
                  <div className="text-xl font-bold" style={{ color: T.success }}>{preview.validCount}</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>登録可能な行</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ border: `1px solid ${T.border}` }}>
                  <div className="text-xl font-bold" style={{ color: preview.errorCount ? T.danger : T.textMuted }}>{preview.errorCount}</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>エラーのある行（登録されません）</div>
                </div>
              </div>
              <PreviewTable rows={preview.rows} />
              {errorRows.length > 0 && (
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>
                  エラーのある{errorRows.length}行は登録対象から自動的に除外されます。Excelを修正して再アップロードしてください。
                </div>
              )}
              <div className="rounded-xl px-3 py-2 text-xs leading-5" style={{ background: T.warningSubtle, color: T.warning }}>
                「この内容で登録する」を押すと、上記の登録可能な行のみアカウントを作成します（既に登録済みのメールアドレスは自動的にスキップされます）。
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Btn kind="ghost" icon={Download} onClick={() => downloadTraineeImportTemplate({ courses })}>ひな形をダウンロード</Btn>
              <Btn icon={FileSpreadsheet} onClick={() => fileRef.current?.click()}>記入したExcelをアップロード</Btn>
              {parseError && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{parseError}</div>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function PreviewTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${T.border}` }}>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0" style={{ background: T.bgBase }}>
            <tr style={{ color: T.textMuted }}>
              <th className="px-2 py-2 text-left">行</th>
              <th className="px-2 py-2 text-left">氏名</th>
              <th className="px-2 py-2 text-left">メールアドレス</th>
              <th className="px-2 py-2 text-left">コース</th>
              <th className="px-2 py-2 text-left">状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.rowNumber} style={{ borderTop: `1px solid ${T.border}`, background: row.ok ? "transparent" : (T.dangerSubtle) }}>
                <td className="px-2 py-2" style={{ color: T.textMuted }}>{row.rowNumber}</td>
                <td className="px-2 py-2" style={{ color: T.textPrimary }}>{row.values.name || "—"}</td>
                <td className="px-2 py-2" style={{ color: T.textPrimary }}>{row.values.email || "—"}</td>
                <td className="px-2 py-2" style={{ color: T.textMuted }}>{row.values.courseNameRaw || "—"}</td>
                <td className="px-2 py-2">
                  {row.ok
                    ? <span style={{ color: T.success }} className="font-semibold">OK{row.warnings.length > 0 ? "（注意あり）" : ""}</span>
                    : <span style={{ color: T.danger }} className="font-semibold">エラー</span>}
                  {(row.errors.length > 0 || row.warnings.length > 0) && (
                    <ul className="mt-1 list-disc pl-4" style={{ color: row.ok ? T.warning : T.danger }}>
                      {row.errors.map((m, i) => <li key={`e${i}`}>{m}</li>)}
                      {row.warnings.map((m, i) => <li key={`w${i}`}>{m}</li>)}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsTable({ rows, results, onRetry, onCopyPassword }) {
  const counts = rows.reduce((acc, row) => {
    const status = results[row.rowNumber]?.status || "pending";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(counts).map(([status, count]) => (
          <span key={status} className="rounded-full px-3 py-1 font-semibold" style={{ background: T.bgBase, color: STATUS_TONE[status] || T.textMuted }}>
            {STATUS_LABEL[status] || status}: {count}件
          </span>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${T.border}` }}>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ background: T.bgBase }}>
              <tr style={{ color: T.textMuted }}>
                <th className="px-2 py-2 text-left">氏名</th>
                <th className="px-2 py-2 text-left">メールアドレス</th>
                <th className="px-2 py-2 text-left">状態</th>
                <th className="px-2 py-2 text-left">仮パスワード</th>
                <th className="px-2 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const r = results[row.rowNumber];
                const status = r?.status || "pending";
                return (
                  <tr key={row.rowNumber} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td className="px-2 py-2" style={{ color: T.textPrimary }}>{row.values.name}</td>
                    <td className="px-2 py-2" style={{ color: T.textPrimary }}>{row.values.email}</td>
                    <td className="px-2 py-2">
                      <span className="font-semibold" style={{ color: STATUS_TONE[status] || T.textMuted }}>
                        {status === "retrying" ? "再試行中…" : (STATUS_LABEL[status] || "処理待ち")}
                      </span>
                      {r?.reason && <div className="mt-0.5" style={{ color: T.textMuted }}>{r.reason}</div>}
                    </td>
                    <td className="px-2 py-2">
                      {r?.tempPassword ? (
                        <button type="button" onClick={() => onCopyPassword(r.tempPassword)} className="inline-flex items-center gap-1 font-mono" style={{ color: T.textPrimary }} title="クリックしてコピー">
                          {r.tempPassword}<Copy size={12} />
                        </button>
                      ) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {status === "error" && (
                        <button type="button" onClick={() => onRetry(row)} className="inline-flex items-center gap-1 font-semibold" style={{ color: T.accentHover }}>
                          <RefreshCw size={12} />再試行
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
