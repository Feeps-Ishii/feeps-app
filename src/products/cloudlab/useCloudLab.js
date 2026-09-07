import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api.js";

// クラウド実習の進捗。GET /cloudlab/progress ／ POST /cloudlab/units/{id}/pass
//
// **取れなかったときに0件へ丸めない。** 「まだ何も通っていない」と
// 「確認できない」は別物で、前者に丸めると受講生の進捗が消えたように見える。

export function useCloudLabProgress() {
  const [progress, setProgress] = useState(null);   // null = まだ分からない
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError("");
    return apiGet("/cloudlab/progress")
      .then(res => setProgress({
        units: res?.units && typeof res.units === "object" ? res.units : {},
        totalSeconds: Number(res?.totalSeconds) || 0,
        lastUnitId: typeof res?.lastUnitId === "string" ? res.lastUnitId : "",
      }))
      .catch(e => setError(e?.errorMessage || e?.message || "実習の記録を確認できません。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // 通過の記録。**画面はサーバーの返り値で更新する**（自前で足すと、
  // 記録に失敗したときに通ったように見えてしまう）
  const markPassed = useCallback((unitId, seconds) => (
    apiPost(`/cloudlab/units/${encodeURIComponent(unitId)}/pass`, { seconds })
      .then(res => { if (res?.units) setProgress(res); return res; })
      .catch(e => { setError(e?.errorMessage || e?.message || "記録できませんでした。"); })
  ), []);

  return { progress, loading, error, reload: load, markPassed };
}
