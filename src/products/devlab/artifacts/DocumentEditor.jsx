// 設計書エディタ（2026-08-19新設）。章立てで書き、右側にMarkdownプレビューを出す。
// プレビューは既存の .feeps-lesson-md（index.css）をそのまま使うので、
// 見出し・箇条書き・表・コードブロックが教材と同じ見た目で確認できる。
import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Plus, Trash2, Eye, FileText } from "lucide-react";
import { Badge, Btn, Card, T, fieldStyle } from "../../../components/common";
import {
  emptyDocModel, newSection, sanitizeDocModel, validateDocModel, docModelToMarkdown,
} from "./docModel.js";

export default function DocumentEditor({ value, onChange, readOnly = false }) {
  const model = useMemo(() => sanitizeDocModel(value || emptyDocModel()), [value]);
  const [preview, setPreview] = useState(false);
  const issues = useMemo(() => validateDocModel(model), [model]);
  const markdown = useMemo(() => docModelToMarkdown(model), [model]);

  function update(next) {
    if (!readOnly) onChange(sanitizeDocModel(next));
  }
  function updateSection(id, patch) {
    update({ ...model, sections: model.sections.map(s => (s.id === id ? { ...s, ...patch } : s)) });
  }

  if (readOnly) {
    return markdown
      ? <div className="feeps-lesson-md text-sm" style={{ color: T.textPrimary }}><ReactMarkdown>{markdown}</ReactMarkdown></div>
      : <p className="text-xs" style={{ color: T.textMuted }}>設計書は未提出です。</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input style={{ ...fieldStyle, flex: 1, minWidth: 200, fontWeight: 700 }} value={model.title}
          placeholder="ドキュメントのタイトル" onChange={e => update({ ...model, title: e.target.value })} />
        <Btn kind="ghost" size="sm" icon={Eye} onClick={() => setPreview(v => !v)}>
          {preview ? "編集に戻る" : "プレビュー"}
        </Btn>
      </div>

      {preview ? (
        <Card className="p-4">
          {markdown
            ? <div className="feeps-lesson-md text-sm" style={{ color: T.textPrimary }}><ReactMarkdown>{markdown}</ReactMarkdown></div>
            : <p className="text-xs" style={{ color: T.textMuted }}>まだ何も書かれていません。</p>}
        </Card>
      ) : (
        <div className="space-y-2">
          {model.sections.map((s, i) => (
            <Card key={s.id} className="p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold" style={{ color: T.textMuted }}>{i + 1}</span>
                <input style={{ ...fieldStyle, flex: 1, minWidth: 160, fontWeight: 700 }} value={s.heading}
                  placeholder="見出し（例: 機能一覧）" onChange={e => updateSection(s.id, { heading: e.target.value })} />
                <Btn kind="ghost" size="sm" icon={Trash2}
                  onClick={() => update({ ...model, sections: model.sections.filter(x => x.id !== s.id) })}>削除</Btn>
              </div>
              <textarea style={{ ...fieldStyle, minHeight: 110 }} value={s.body}
                placeholder="本文（Markdownが使えます。箇条書き・表・コードブロックも可）"
                onChange={e => updateSection(s.id, { body: e.target.value })} />
            </Card>
          ))}
          <Btn kind="ghost" size="sm" icon={Plus}
            onClick={() => update({ ...model, sections: [...model.sections, newSection()] })}>章を追加</Btn>
          <p className="text-xs" style={{ color: T.textMuted }}>
            <FileText size={11} className="mr-1 inline" />
            本文はMarkdownで書けます（`- 箇条書き` / `**強調**` / <code>```コードブロック```</code>）。
          </p>
        </div>
      )}

      {issues.length > 0 ? (
        <Card className="p-3" style={{ background: T.warningSubtle }}>
          <p className="mb-1 text-xs font-bold" style={{ color: T.warning }}>提出前に確認してください（{issues.length}件）</p>
          <ul className="space-y-0.5">
            {issues.map((m, i) => <li key={i} className="text-xs" style={{ color: T.textSecondary }}>・{m}</li>)}
          </ul>
        </Card>
      ) : <Badge tone="green">書き漏れはありません</Badge>}
    </div>
  );
}
