// AI生成の非同期ジョブのポーリング（2026-08-19新設）。
//
// 上位モデル（Sonnet/Opus）は1レッスン生成に40秒以上かかり、API Gatewayの29秒上限に
// 収まらない（実測: Haiku 14〜15秒 / Sonnet 4.6 42〜45秒）。Backendは生成を受け付けて
// 202 + jobId を返すだけになったので、こちらで結果が出るまで待つ。
// 正典: docs/decisions/0018-ai-generation-async-job.md
import { apiGet, apiPost } from "../../../api.js";

const POLL_INTERVAL_MS = 2500;
// ワーカーのLambda Timeoutは300秒。少し余裕を足した時点で諦める。
const POLL_TIMEOUT_MS = 330000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成を投げて、完了するまで待って結果を返す。
 * @param path      POST先。202 {jobId} を返すこと
 * @param body      POSTボディ
 * @param onProgress(status) 任意。"queued" / "running" を受け取る（進行表示用）
 * @returns ジョブのresult（生成物）
 */
export async function runAiJob(path, body, onProgress) {
  const started = await apiPost(path, body);
  const jobId = started?.jobId;
  // 移行期の保険: Backendが同期で結果を返した場合はそのまま使う
  if (!jobId) return started;

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastStatus = "queued";
  if (onProgress) onProgress(lastStatus);

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const job = await apiGet(`/learning/admin/ai-jobs/${encodeURIComponent(jobId)}`);
    if (job?.status && job.status !== lastStatus) {
      lastStatus = job.status;
      if (onProgress) onProgress(lastStatus);
    }
    if (job?.status === "done") return job.result || {};
    if (job?.status === "error") {
      const err = new Error(job.error || "AI生成に失敗しました。");
      err.errorMessage = job.error || undefined;
      throw err;
    }
  }
  throw new Error("AI生成が時間内に終わりませんでした。もう一度お試しください。");
}

export const AI_JOB_STATUS_LABEL = {
  queued: "生成の順番を待っています…",
  running: "AIが生成しています…（30〜60秒ほどかかります）",
};
