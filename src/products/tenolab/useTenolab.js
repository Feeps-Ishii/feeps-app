import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../../api.js";

// テノラボの学習記録（自分の分）。正本は API（DynamoDB）。取得に失敗したら "error" のまま出し、
// 0件として扱わない（進み具合がゼロに見えると、続きから始められなくなるため）。
export function useTenolabProgress(enabled) {
  const [state, setState] = useState(enabled ? "loading" : "off"); // off | loading | ready | error
  const [items, setItems] = useState([]);

  const reload = useCallback(async () => {
    if (!enabled) { setState("off"); setItems([]); return; }
    setState("loading");
    try {
      const res = await apiGet("/tenolab/progress");
      setItems(Array.isArray(res?.items) ? res.items : []);
      setState("ready");
    } catch (e) {
      console.warn("tenolab progress load failed", e);
      setState("error");
    }
  }, [enabled]);

  useEffect(() => { reload(); }, [reload]);

  // 1単元ぶんを保存する。失敗は呼び出し側へそのまま投げる（画面で知らせるため）
  const save = useCallback(async (courseId, unitId, data) => {
    const res = await apiPut(`/tenolab/progress/${courseId}/${unitId}`, data);
    const item = res?.item;
    if (item) {
      setItems(prev => {
        const rest = prev.filter(x => !(x.courseId === item.courseId && x.unitId === item.unitId));
        return [...rest, item];
      });
    }
    return item;
  }, []);

  return { state, items, reload, save };
}
