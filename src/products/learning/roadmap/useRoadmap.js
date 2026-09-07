import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";

// 目標と自己申告。GET/PUT /roadmap/me ／ PUT /roadmap/me/declared
//
// **取れなかったときに「目標なし」へ丸めない。** 「まだ選んでいない」と
// 「確認できない」は別物で、前者に丸めると選び直しを迫ってしまう。

export function useRoadmap() {
  const [state, setState] = useState(null);   // null = まだ分からない
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError("");
    return apiGet("/roadmap/me")
      .then(res => setState({
        goalId: typeof res?.goalId === "string" ? res.goalId : "",
        declared: Array.isArray(res?.declared) ? res.declared : [],
      }))
      .catch(e => setError(e?.errorMessage || e?.message || "目標を確認できません。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // **画面はサーバーの返り値で更新する。** 自前で足すと、保存に失敗したときに
  // 保存できたように見えてしまう
  const chooseGoal = useCallback(goalId => {
    setSaving(true); setError("");
    return apiPut("/roadmap/me", { goalId })
      .then(res => setState({ goalId: res?.goalId || "", declared: res?.declared || [] }))
      .catch(e => setError(e?.errorMessage || e?.message || "目標を保存できませんでした。"))
      .finally(() => setSaving(false));
  }, []);

  const setDeclared = useCallback((itemId, declared) => {
    setSaving(true); setError("");
    return apiPut("/roadmap/me/declared", { itemId, declared })
      .then(res => setState({ goalId: res?.goalId || "", declared: res?.declared || [] }))
      .catch(e => setError(e?.errorMessage || e?.message || "保存できませんでした。"))
      .finally(() => setSaving(false));
  }, []);

  return { state, loading, error, saving, reload: load, chooseGoal, setDeclared };
}
