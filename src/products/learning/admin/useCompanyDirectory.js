import { useEffect, useState } from "react";
import { apiGet } from "../../../api.js";

// コース公開範囲（企業単位、2026-07-21追加）のバッジ表示・編集UIで共通利用する
// 企業一覧取得フック。CourseManager / CourseDetailView から共有し、重複fetchを避ける。
// GET /companies は admin・instructor どちらも呼び出せる既存API（新規API追加禁止）。
export function useCompanyDirectory() {
  const [companies, setCompanies] = useState([]);
  const [companiesError, setCompaniesError] = useState("");
  useEffect(() => {
    let alive = true;
    apiGet("/companies")
      .then(list => { if (alive) setCompanies(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setCompaniesError("企業一覧を取得できませんでした。"); });
    return () => { alive = false; };
  }, []);
  return { companies, companiesError };
}

export function companyNameResolver(companies, companiesError) {
  return (id) => {
    if (companiesError) return id;
    return companies.find(c => c.companyId === id)?.name || id;
  };
}
