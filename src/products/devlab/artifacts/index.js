// 成果物エディタのレジストリ（2026-08-19新設）。
//
// 呼び出し側（提出フォーム・管理のステップ編集）が種別ごとにif分岐を持たないようにする。
// 新しい成果物を足すときは、ここへ1行足すだけで提出フォームも管理セレクタも自動で対応する
// （Backendの ARTIFACT_TYPES への追加も忘れずに。docs/specs/devlab-artifacts-spec.md）。
import ErDiagramEditor from "./ErDiagramEditor.jsx";
import SpreadsheetEditor from "./SpreadsheetEditor.jsx";
import DocumentEditor from "./DocumentEditor.jsx";
import WireframeEditor from "./WireframeEditor.jsx";
import { emptyErModel, sanitizeErModel, erModelToText } from "./erModel.js";
import { emptySheetModel, sanitizeSheetModel, sheetModelToText } from "./sheetModel.js";
import { emptyDocModel, sanitizeDocModel, docModelToText } from "./docModel.js";
import { emptyWireModel, sanitizeWireModel, wireModelToText } from "./wireModel.js";

export const ARTIFACT_REGISTRY = {
  er_diagram: {
    label: "テーブル設計（ER図）",
    fieldLabel: "テーブル設計（この画面で作成します）",
    Editor: ErDiagramEditor,
    empty: emptyErModel,
    sanitize: sanitizeErModel,
    toText: erModelToText,
    isEmpty: m => !(m?.tables || []).length,
  },
  spreadsheet: {
    label: "表計算（Excel風）",
    fieldLabel: "表（この画面で作成します。数式が使えます）",
    Editor: SpreadsheetEditor,
    empty: emptySheetModel,
    sanitize: sanitizeSheetModel,
    toText: sheetModelToText,
    isEmpty: m => !Object.keys(m?.cells || {}).length,
  },
  document: {
    label: "設計書・文書",
    fieldLabel: "設計書（この画面で作成します）",
    Editor: DocumentEditor,
    empty: emptyDocModel,
    sanitize: sanitizeDocModel,
    toText: docModelToText,
    isEmpty: m => !(m?.sections || []).some(s => (s.body || "").trim()),
  },
  wireframe: {
    label: "画面設計（ワイヤーフレーム）",
    fieldLabel: "画面設計（この画面で作成します）",
    Editor: WireframeEditor,
    empty: emptyWireModel,
    sanitize: sanitizeWireModel,
    toText: wireModelToText,
    isEmpty: m => !(m?.screens || []).some(s => (s.rows || []).length),
  },
};

export const ARTIFACT_OPTIONS = [
  { value: "none", label: "なし（テキスト・URLで提出）" },
  ...Object.entries(ARTIFACT_REGISTRY).map(([value, def]) => ({ value, label: def.label })),
];

export function artifactDef(type) {
  return ARTIFACT_REGISTRY[type] || null;
}
