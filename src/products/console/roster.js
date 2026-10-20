/* お客様の名簿を読む（2026-10-20）。Excel（.xlsx/.xls）・CSV・文の貼り付け。
   1) 表にする 2) 見出しの行と列（名前・姓・名・ふりがな・メール）をルールで見分ける。見分けられなければ画面が AI に聞く */

export async function readRosterFile(file) {
  const name = String(file?.name || "").toLowerCase();
  if (/\.(xlsx|xlsm|xls)$/.test(name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }).map(r => r.map(c => String(c ?? "").trim()));
  }
  const buf = await file.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buf);
  // 文字化けしたら Shift_JIS（日本の Excel で保存した CSV に多い）
  if (text.includes("�")) { try { text = new TextDecoder("shift_jis").decode(buf); } catch { /* utf-8 のまま */ } }
  return textToRows(text);
}

export function textToRows(text) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
  const delim = lines.some(l => l.includes("\t")) ? "\t" : lines.some(l => l.includes(",")) ? "," : null;
  return lines.map(l => (delim ? splitLine(l, delim) : [l]).map(c => c.trim()));
}
function splitLine(line, d) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === "\"" && line[i + 1] === "\"") { cur += "\""; i++; } else if (ch === "\"") q = false; else cur += ch; }
    else if (ch === "\"") q = true;
    else if (ch === d) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const H = {
  name: /^(氏名|名前|お名前|なまえ|フルネーム|name|full ?name|受講者名|社員名|受講生名)$/i,
  sei: /^(姓|苗字|名字|last ?name|family ?name)$/i,
  mei: /^(名|下の名前|first ?name|given ?name)$/i,
  kana: /(ふりがな|フリガナ|カナ|かな|よみ|読み|kana)/i,
  email: /(mail|メール|ｅメール|e-mail)/i,
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JP = /[぀-ヿ一-鿿]/;

// ルールで見分ける。見分けられたら { headerRow, name, sei, mei, kana, email }、名前の列が無ければ null
export function guessColumns(rows) {
  const top = rows.slice(0, 10);
  for (let r = 0; r < top.length; r++) {
    const cells = top[r].map(c => String(c).replace(/[\s　*※（）()]/g, ""));
    const find = re => cells.findIndex(c => c && re.test(c));
    const m = { headerRow: r, name: find(H.name), sei: find(H.sei), mei: find(H.mei), kana: find(H.kana), email: find(H.email) };
    if (m.name >= 0 || (m.sei >= 0 && m.mei >= 0)) {
      if (m.name >= 0) { m.sei = -1; m.mei = -1; }
      if (m.kana === m.name) m.kana = -1;
      return m;
    }
  }
  // 見出しが無い：メールの列と、日本語の入った最初の列
  const width = Math.max(0, ...top.map(r => r.length));
  const colOf = test => { for (let c = 0; c < width; c++) if (top.filter(r => test(String(r[c] || ""))).length >= Math.ceil(top.length * 0.6)) return c; return -1; };
  const email = colOf(v => EMAIL.test(v));
  const name = colOf(v => JP.test(v) && !EMAIL.test(v));
  if (name >= 0) return { headerRow: -1, name, sei: -1, mei: -1, kana: -1, email };
  return null;
}

export function rosterPeople(rows, m) {
  if (!m) return [];
  const at = (r, c) => (c >= 0 ? String(r[c] || "").trim() : "");
  return rows.slice(m.headerRow + 1).map((r, i) => {
    const name = (m.name >= 0 ? at(r, m.name) : [at(r, m.sei), at(r, m.mei)].filter(Boolean).join(" ")).replace(/\s+/g, " ").slice(0, 40);
    const email = at(r, m.email).toLowerCase();
    return { line: m.headerRow + 2 + i, name, kana: at(r, m.kana), email: EMAIL.test(email) ? email : "" };
  }).filter(p => p.name || p.email);
}
