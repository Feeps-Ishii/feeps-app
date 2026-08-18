// チーム開発のコミット差分ビュー（2026-08-19新設）。
// コミット履歴をクリックしたときに「どこが変わったか」を出す。受講生の作業画面
// (DevLabWorkspaceComponents.jsx) と 管理・企業担当者の進捗画面 (DevLabComponents.jsx) の
// 両方から使うため独立ファイルにしている（Sandpackのlazy境界を跨がないため。ADR 0011）。
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge, Btn, Card, SkeletonRows, T } from "../../components/common";
import { apiGet } from "../../api.js";

function apiErrorMessage(e, fallback) {
  if (e?.status === 403) return "この操作を行う権限がありません。";
  return e?.errorMessage || e?.message || fallback;
}

const CHANGE_TYPE_LABEL = { added: "新規", deleted: "削除", modified: "変更" };
const CHANGE_TYPE_TONE = { added: "green", deleted: "red", modified: "cyan" };

const lineStyle = {
  add: { background: T.successSubtle, color: T.textPrimary },
  del: { background: T.dangerSubtle, color: T.textPrimary },
  context: { background: "transparent", color: T.textSecondary },
};
const LINE_PREFIX = { add: "+", del: "-", context: " " };

function DiffLines({ hunks }) {
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: T.border }}>
      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: 1.6 }}>
        {hunks.map((h, hi) => (
          <div key={hi}>
            {hi > 0 && <div className="px-3 py-0.5" style={{ background: T.surfaceAlt || "transparent", color: T.textMuted }}>⋯</div>}
            <div className="px-3 py-0.5" style={{ color: T.textMuted }}>
              @@ -{h.beforeStart},{h.beforeLines} +{h.afterStart},{h.afterLines} @@
            </div>
            {h.lines.map((l, li) => (
              <div key={li} className="flex" style={lineStyle[l.type]}>
                <span className="shrink-0 select-none px-2 text-right" style={{ width: 44, color: T.textMuted }}>{l.beforeNo || ""}</span>
                <span className="shrink-0 select-none px-2 text-right" style={{ width: 44, color: T.textMuted }}>{l.afterNo || ""}</span>
                <span className="shrink-0 select-none pr-1" style={{ color: T.textMuted }}>{LINE_PREFIX[l.type]}</span>
                <span className="whitespace-pre pr-3">{l.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * コミット1件の差分。commitはチームのcommits配列の要素（メタデータ）をそのまま渡す。
 * 差分本体はクリック時に取りに行く（履歴一覧のレスポンスを重くしないため）。
 */
export function CommitDiffPanel({ teamId, commit, onClose }) {
  const [files, setFiles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noDiff, setNoDiff] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(""); setNoDiff(false);
    apiGet(`/devlab/teams/${encodeURIComponent(teamId)}/commits/${encodeURIComponent(commit.commitId)}`)
      .then(res => {
        if (!alive) return;
        // 差分保存を入れる前のコミットはfiles=nullで返る
        if (res?.files == null) { setNoDiff(true); setFiles([]); } else setFiles(res.files);
      })
      .catch(e => { if (alive) setError(apiErrorMessage(e, "差分を確認できません。")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [teamId, commit.commitId]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{commit.message}</span>
            {commit.authorType === "ai" && <Badge tone="amber">AIメンバー</Badge>}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: T.textMuted }}>
            {commit.authorName}{commit.roleName ? `（${commit.roleName}）` : ""}
            {commit.at ? ` ・ ${new Date(commit.at).toLocaleString("ja-JP")}` : ""}
          </p>
        </div>
        <Btn kind="ghost" size="sm" icon={X} onClick={onClose}>閉じる</Btn>
      </div>

      {loading ? <SkeletonRows rows={4} /> : error ? (
        <p className="text-sm" style={{ color: T.danger }}>{error}</p>
      ) : noDiff ? (
        <div>
          <p className="mb-2 text-xs" style={{ color: T.textMuted }}>
            このコミットには差分が記録されていません（差分の保存を始める前のコミットです）。変更されたファイルは以下です。
          </p>
          <ul className="space-y-0.5">
            {(commit.changedPaths || []).map(p => (
              <li key={p} className="text-xs" style={{ color: T.textSecondary }}>・{p}</li>
            ))}
          </ul>
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs" style={{ color: T.textMuted }}>変更されたファイルがありません。</p>
      ) : (
        <div className="space-y-3">
          {files.map(f => (
            <div key={f.path}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold" style={{ color: T.textPrimary, fontFamily: "ui-monospace, monospace" }}>{f.path}</span>
                <Badge tone={CHANGE_TYPE_TONE[f.changeType] || "muted"}>{CHANGE_TYPE_LABEL[f.changeType] || f.changeType}</Badge>
                <span className="text-xs" style={{ color: T.success }}>+{f.added}</span>
                <span className="text-xs" style={{ color: T.danger }}>-{f.removed}</span>
              </div>
              {f.truncated || !f.hunks?.length
                ? <p className="text-xs" style={{ color: T.textMuted }}>差分が大きいため表示を省略しました（{f.added}行追加・{f.removed}行削除）。</p>
                : <DiffLines hunks={f.hunks} />}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
