// 社員（受講生）情報のExcelひな形一括インポート: 列定義・検証・ひな形生成・取込行実行を集約する単一の定義。
// ひな形生成・アップロード解析・プレビュー表示のすべてがこのファイルの定義を参照し、二重管理しない。
// 呼び出し元: src/products/admin/AdminComponents.jsx（管理者のユーザー管理）
//             src/products/grants/GrantsComponents.jsx（企業担当者・管理者の受講生の助成金情報）
import { apiPost, apiPut } from "../../api.js";
import { EMPLOYMENT_TYPE_OPTIONS, GRADUATE_STATUS_OPTIONS, IT_EXPERIENCE_OPTIONS } from "../../products/grants/GrantsCatalog.js";

const SHEET_NAME = "社員一覧";
const GUIDE_SHEET_NAME = "入力上の注意";
const EXAMPLE_NAME = "（記入例）山田 太郎";
const EXAMPLE_EMAIL = "（記入例）yamada@example.co.jp"; // わざとメール形式として不正にし、削除し忘れても自動的にスキップされエラー登録されないようにする

function columnFormatNote(column) {
  if (column.kind === "enum") return `選択肢: ${column.options.map(o => o.label).join(" / ")}`;
  if (column.kind === "date") return "形式: YYYY-MM-DD（例: 2026-04-01）。Excelの日付セルでも入力可。";
  if (column.kind === "boolean") return "「対象」または空欄で入力してください。";
  if (column.kind === "course") return "既存のコース名を正確に入力してください（下表「登録可能なコース名」を参照）。未入力可。";
  return column.note || "自由入力です。";
}

export const TRAINEE_IMPORT_COLUMNS = [
  { key: "name", header: "氏名", required: true, kind: "text" },
  { key: "email", header: "メールアドレス", required: true, kind: "text", note: "ログインID（Cognito）として使用します。" },
  { key: "employmentType", header: "雇用形態", required: false, kind: "enum", options: EMPLOYMENT_TYPE_OPTIONS },
  { key: "hireDate", header: "採用日", required: false, kind: "date" },
  { key: "gender", header: "性別", required: false, kind: "text" },
  { key: "graduateStatus", header: "新卒既卒", required: false, kind: "enum", options: GRADUATE_STATUS_OPTIONS },
  { key: "itExperienceLevel", header: "IT経験", required: false, kind: "enum", options: IT_EXPERIENCE_OPTIONS },
  { key: "employmentInsuranceNumber", header: "雇用保険番号（個人）", required: false, kind: "text" },
  { key: "grantEligible", header: "助成金対象", required: false, kind: "boolean", note: "管理者による取込のみ反映されます（企業担当者の取込では無視されます）。" },
  { key: "courseId", header: "割当コース", required: false, kind: "course" },
];

function excelValueToIsoDate(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  return String(value).trim().replace(/\//g, "-").slice(0, 10);
}

function matchEnumValue(raw, options) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const found = options.find(o => o.label === text || o.value === text || o.label.toLowerCase() === text.toLowerCase());
  return found ? found.value : "";
}

function parseBooleanFlag(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  const truthy = ["対象", "はい", "true", "1", "○", "yes", "y"];
  const falsy = ["対象外", "いいえ", "false", "0", "×", "no", "n"];
  const lower = text.toLowerCase();
  if (truthy.includes(text) || truthy.includes(lower)) return true;
  if (falsy.includes(text) || falsy.includes(lower)) return false;
  return undefined;
}

function isBlankRawRow(raw) {
  return Object.values(raw || {}).every(v => String(v ?? "").trim() === "");
}

function generateTempPassword() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letter = letters[Math.floor(Math.random() * letters.length)];
  return `Feeps#${digits}${letter}`;
}

// ---- ひな形ダウンロード ----
export async function downloadTraineeImportTemplate({ courses = [] } = {}) {
  const XLSX = await import("xlsx");
  const headers = TRAINEE_IMPORT_COLUMNS.map(c => c.header);
  const exampleRow = Object.fromEntries(TRAINEE_IMPORT_COLUMNS.map(c => {
    if (c.key === "name") return [c.header, EXAMPLE_NAME];
    if (c.key === "email") return [c.header, EXAMPLE_EMAIL];
    if (c.kind === "enum") return [c.header, c.options[0]?.label || ""];
    if (c.kind === "date") return [c.header, "2026-04-01"];
    if (c.kind === "boolean") return [c.header, "対象"];
    if (c.key === "gender") return [c.header, "女性"];
    if (c.key === "employmentInsuranceNumber") return [c.header, "1234-567890-1"];
    return [c.header, ""];
  }));
  const blankRows = Array.from({ length: 8 }, () => Object.fromEntries(headers.map(h => [h, ""])));
  const sheet = XLSX.utils.json_to_sheet([exampleRow, ...blankRows], { header: headers });
  sheet["!cols"] = headers.map(h => ({ wch: Math.max(14, Math.min(30, h.length * 2 + 8)) }));
  const guideRows = [
    ["Feeps One 社員（受講生）一括登録テンプレート"],
    ["入力方法", "1行目は項目名、2行目は記入例です（そのまま残しても内容が不正なため自動的にスキップされ、登録されません）。3行目以降に1名1行で入力してください。"],
    ...TRAINEE_IMPORT_COLUMNS.map(c => [c.header, `${c.required ? "必須" : "任意"}。${columnFormatNote(c)}`]),
    ["登録可能なコース名", courses.length ? courses.map(c => c.name).filter(Boolean).join(" / ") : "（現在割り当て可能なコースがありません。コース未割当のまま登録できます）"],
    ["パスワード", "初回ログイン用の仮パスワードは登録実行時に自動発行されます。登録結果画面に表示されるパスワードを本人へお伝えください（初回ログイン時に変更が必要です）。"],
    ["重複メール", "既に登録済みのメールアドレスは「登録済みのためスキップ」と表示され、既存アカウントは変更されません。"],
  ];
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  guide["!cols"] = [{ wch: 20 }, { wch: 92 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, guide, GUIDE_SHEET_NAME);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(workbook, `社員一括登録テンプレート_${stamp}.xlsx`);
}

// ---- アップロード解析・検証 ----
export function parseTraineeImportRows(rawRows, { courses = [] } = {}) {
  const seenEmails = new Set();
  const rows = (rawRows || [])
    .map((raw, index) => ({ raw, sheetRow: index + 2 })) // 1行目はヘッダーのため、データはsheet上の2行目から
    .filter(({ raw }) => !isBlankRawRow(raw))
    .map(({ raw, sheetRow }) => {
      const errors = [];
      const warnings = [];
      const name = String(raw["氏名"] ?? "").trim();
      const emailRaw = String(raw["メールアドレス"] ?? "").trim();
      const email = emailRaw.toLowerCase();
      if (!name) errors.push("氏名が未入力です。");
      if (!email) errors.push("メールアドレスが未入力です。");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("メールアドレスの形式が正しくありません。");
      else if (seenEmails.has(email)) errors.push("同じファイル内にメールアドレスが重複しています。");
      else seenEmails.add(email);

      const employmentTypeRaw = String(raw["雇用形態"] ?? "").trim();
      const employmentType = matchEnumValue(employmentTypeRaw, EMPLOYMENT_TYPE_OPTIONS);
      if (employmentTypeRaw && !employmentType) errors.push(`雇用形態の値が不正です（${EMPLOYMENT_TYPE_OPTIONS.map(o => o.label).join("/")}のいずれか）。`);

      const graduateStatusRaw = String(raw["新卒既卒"] ?? "").trim();
      const graduateStatus = matchEnumValue(graduateStatusRaw, GRADUATE_STATUS_OPTIONS);
      if (graduateStatusRaw && !graduateStatus) errors.push(`新卒既卒の値が不正です（${GRADUATE_STATUS_OPTIONS.map(o => o.label).join("/")}のいずれか）。`);

      const itExperienceRaw = String(raw["IT経験"] ?? "").trim();
      const itExperienceLevel = matchEnumValue(itExperienceRaw, IT_EXPERIENCE_OPTIONS);
      if (itExperienceRaw && !itExperienceLevel) errors.push(`IT経験の値が不正です（${IT_EXPERIENCE_OPTIONS.map(o => o.label).join("/")}のいずれか）。`);

      const hireDateRaw = raw["採用日"];
      const hireDateText = String(hireDateRaw ?? "").trim();
      const hireDate = hireDateText ? excelValueToIsoDate(hireDateRaw) : "";
      if (hireDateText && !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) errors.push("採用日の形式が正しくありません（YYYY-MM-DD）。");

      const gender = String(raw["性別"] ?? "").trim();
      const employmentInsuranceNumber = String(raw["雇用保険番号（個人）"] ?? "").trim();
      const grantEligible = parseBooleanFlag(raw["助成金対象"]);
      if (String(raw["助成金対象"] ?? "").trim() && grantEligible === undefined) warnings.push("助成金対象の値を認識できなかったため、未設定として登録します。");

      const courseNameRaw = String(raw["割当コース"] ?? "").trim();
      let courseId = "";
      if (courseNameRaw) {
        const found = courses.find(c => String(c.name || "").trim() === courseNameRaw);
        if (found) courseId = found.courseId;
        else warnings.push(`コース「${courseNameRaw}」が一覧に見つかりません。コース未割当のまま登録します。`);
      }

      return {
        rowNumber: sheetRow,
        values: { name, email, employmentType, graduateStatus, itExperienceLevel, hireDate, gender, employmentInsuranceNumber, grantEligible, courseId, courseNameRaw },
        errors,
        warnings,
        ok: errors.length === 0,
      };
    });

  return {
    rows,
    validCount: rows.filter(r => r.ok).length,
    errorCount: rows.filter(r => !r.ok).length,
  };
}

export async function parseTraineeImportFile(file, { courses = [] } = {}) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error(`${SHEET_NAME}シートがありません。`);
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const result = parseTraineeImportRows(rawRows, { courses });
  if (!result.rows.length) throw new Error("入力された行がありません。");
  return { fileName: file.name, ...result };
}

// ---- 1行の登録実行（POST /admin/users → 任意でPUT /grants/company-trainees/{id}） ----
export async function importTraineeRow(values, { companyId } = {}) {
  const tempPassword = generateTempPassword();
  let created;
  try {
    created = await apiPost("/admin/users", {
      email: values.email,
      name: values.name,
      role: "trainee",
      tempPassword,
      companyId: companyId || "",
      courseId: values.courseId || "",
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("409")) return { status: "skipped", email: values.email, name: values.name, reason: "登録済みのメールアドレスのためスキップしました。" };
    return { status: "error", email: values.email, name: values.name, reason: msg };
  }

  const grantPayload = {};
  if (values.employmentType) grantPayload.employmentType = values.employmentType;
  if (values.graduateStatus) grantPayload.graduateStatus = values.graduateStatus;
  if (values.itExperienceLevel) grantPayload.itExperienceLevel = values.itExperienceLevel;
  if (values.gender) grantPayload.gender = values.gender;
  if (values.employmentInsuranceNumber) grantPayload.employmentInsuranceNumber = values.employmentInsuranceNumber;
  if (values.hireDate) grantPayload.hireDate = values.hireDate;
  if (values.grantEligible !== undefined) grantPayload.grantEligible = values.grantEligible;

  if (Object.keys(grantPayload).length) {
    try {
      await apiPut(`/grants/company-trainees/${created.userId}`, grantPayload);
    } catch (e) {
      return {
        status: "created_partial", email: values.email, name: values.name, userId: created.userId, tempPassword,
        reason: "アカウントは作成しましたが、助成金項目の保存に失敗しました：" + (e?.message || e),
      };
    }
  }
  return { status: "created", email: values.email, name: values.name, userId: created.userId, tempPassword };
}
