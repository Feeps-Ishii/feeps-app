import React, { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../../api.js";
import { T, Card, Btn, Badge, EmptyState, SectionHead, SkeletonRows, PrismErrorRetryCard } from "../../components/common";
import { getActiveCourseId, setActiveCourseId } from "../../utils/common/courseContext.js";
import { Check, FileDown, RotateCcw, Save } from "lucide-react";

/* 修了レポート（2026-10-02 ユーザー決定。CHANGELOG 191）
   出欠・日報・テストを研修日で集計し、講師の所見と受講生ごとの一言を添える。
   講師・管理者は書いて「確定」すると企業担当に公開。企業担当は確定したものを自社の受講生の分だけ見る。 */

const errText = (e, f) => e?.errorMessage || e?.message || f;
const pctText = v => (v == null ? "－" : `${v}%`);
const dateText = d => (d ? d.replaceAll("-", "/") : "");

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: T.bgBase }}>
      <div className="text-[11px] font-bold" style={{ color: T.textMuted }}>{label}</div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: T.textPrimary }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: T.textMuted }}>{sub}</div>}
    </div>
  );
}

export default function CompletionReportView({ role }) {
  const canEditRole = role === "admin" || role === "instructor";
  const [courses, setCourses] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async id => {
    if (!id) return;
    setLoadErr(""); setData(null); setMsg(""); setDirty(false);
    try {
      const d = await apiGet(`/completion-report?courseId=${encodeURIComponent(id)}`);
      setData(d); setSummary(d?.report?.summary || ""); setNotes(d?.report?.traineeNotes || {});
    } catch (e) { setLoadErr(errText(e, "修了レポートを読み込めませんでした。")); }
  }, []);
  useEffect(() => {
    apiGet("/completion-report/courses").then(d => {
      const list = Array.isArray(d?.courses) ? d.courses : [];
      setCourses(list);
      const pref = getActiveCourseId();
      setCourseId(list.some(c => c.courseId === pref) ? pref : (list[0]?.courseId || ""));
    }).catch(e => { setCourses([]); setLoadErr(errText(e, "コースを読み込めませんでした。")); });
  }, []);
  useEffect(() => { load(courseId); }, [courseId, load]);

  async function save(action) {
    if (busy) return;
    if (action === "confirm" && !window.confirm("確定すると、企業担当の方が見られるようになります。確定しますか？")) return;
    setBusy(action); setMsg("");
    try {
      const r = await apiPut("/completion-report", { courseId, summary, traineeNotes: notes, action });
      setData(d => ({ ...d, report: r.report }));
      setNotes(r.report.traineeNotes || {}); setDirty(false);
      setCourses(cs => cs.map(c => (c.courseId === courseId ? { ...c, status: r.report.status } : c)));
      setMsg(action === "confirm" ? "確定しました。企業担当の方が見られます。" : action === "unconfirm" ? "確定を取り消しました。企業担当の方からは見えなくなります。" : "保存しました。");
    } catch (e) { setMsg(errText(e, "保存できませんでした。")); }
    finally { setBusy(""); }
  }

  if (courses == null) return <div><SectionHead title="修了レポート" /><Card className="p-5"><SkeletonRows rows={5} /></Card></div>;
  if (!courses.length) return <div><SectionHead title="修了レポート" /><Card><EmptyState title={role === "client" ? "見られるコースがありません" : role === "admin" ? "コースがありません" : "担当しているコースがありません"} desc="" /></Card></div>;

  const report = data?.report;
  const confirmed = report?.status === "confirmed";
  const editable = canEditRole && data?.canEdit && !confirmed;
  const period = data?.period;

  return (
    <div>
      <style>{`@media print{@page{size:A4;margin:12mm} body *{visibility:hidden !important} #completion-print,#completion-print *{visibility:visible !important} #completion-print{position:absolute;left:0;top:0;width:100%}}`}</style>
      <SectionHead title="修了レポート" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-sm font-bold" style={{ border: `1px solid ${T.border}` }}>
          <span className="text-xs" style={{ color: T.textMuted }}>コース</span>
          <select value={courseId} onChange={e => { if (dirty && !window.confirm("保存していない変更があります。移動しますか？")) return; setCourseId(e.target.value); setActiveCourseId(e.target.value); }} className="bg-transparent outline-none">
            {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}{canEditRole ? (c.status === "confirmed" ? "（確定）" : "（下書き）") : ""}</option>)}
          </select>
        </label>
        {data?.published && canEditRole && <Badge tone={confirmed ? "green" : "amber"}>{confirmed ? "確定・企業様に公開中" : "下書き・企業様には非公開"}</Badge>}
        {dirty && <Badge tone="amber">保存していない変更</Badge>}
        {data?.published && (
          <span className="ml-auto flex flex-wrap gap-2">
            <Btn size="sm" kind="ghost" icon={FileDown} onClick={() => window.print()}>PDFで出力</Btn>
            {canEditRole && !confirmed && <Btn size="sm" kind="ghost" icon={Save} disabled={!!busy} onClick={() => save("save")}>{busy === "save" ? "保存中…" : "保存"}</Btn>}
            {canEditRole && !confirmed && <Btn size="sm" icon={Check} disabled={!!busy} onClick={() => save("confirm")}>{busy === "confirm" ? "確定中…" : "確定して企業様に公開"}</Btn>}
            {canEditRole && confirmed && <Btn size="sm" kind="ghost" icon={RotateCcw} disabled={!!busy} onClick={() => save("unconfirm")}>{busy === "unconfirm" ? "取り消し中…" : "確定を取り消す"}</Btn>}
          </span>
        )}
      </div>
      {msg && <div className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>{msg}</div>}
      {loadErr && <PrismErrorRetryCard message={loadErr} onRetry={() => load(courseId)} />}
      {!data && !loadErr && <Card className="p-5"><SkeletonRows rows={8} /></Card>}
      {data && !data.published && <Card><EmptyState title="まだ公開されていません" desc="" /></Card>}

      {data?.published && (
        <div id="completion-print" className="grid gap-3">
          <Card className="grid gap-3 px-5 py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-bold" style={{ color: T.textPrimary }}>修了レポート　{data.courseName}</h2>
              {period && <span className="text-xs" style={{ color: T.textSecondary }}>{dateText(period.startDate)}〜{dateText(period.endDate)} ・ 研修日 {period.trainingDays}日{!period.finished && period.referenceDate ? `（${dateText(period.referenceDate)}時点）` : ""}</span>}
              {confirmed && <span className="text-xs" style={{ color: T.textMuted }}>確定 {dateText((report.confirmedAt || "").slice(0, 10))}{report.confirmedByName ? ` ${report.confirmedByName}` : ""}</span>}
            </div>
            {data.unknown && <div className="text-xs font-semibold" style={{ color: T.warning }}>一部の受講生の出欠・日報を読み込めませんでした。数字が少なく出ている可能性があります。</div>}
            {period?.status && period.status !== "ready" && <div className="text-xs font-semibold" style={{ color: T.warning }}>研修期間・研修カレンダーが設定されていないため、出欠と日報は集計できません。</div>}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="受講生" value={`${data.overall.traineeCount}人`} />
              <Tile label="出席率" value={pctText(data.overall.attendanceRate)} sub={`遅刻 ${data.overall.late} ・ 早退 ${data.overall.early} ・ 欠席 ${data.overall.absent}`} />
              <Tile label="日報の提出率" value={pctText(data.overall.reportRate)} />
              <Tile label="テストの平均" value={data.overall.testAverage == null ? "－" : `${data.overall.testAverage}点`} sub={data.tests.length ? `${data.tests.length}回` : "テストなし"} />
            </div>
          </Card>

          {data.tests.length > 0 && (
            <Card className="overflow-hidden p-0">
              <div className="px-5 py-3 text-sm font-bold" style={{ color: T.textPrimary, borderBottom: `1px solid ${T.border}` }}>テスト</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead><tr>{["テスト", "受験した人", "平均"].map(h => <th key={h} className="px-5 py-2 text-left text-[11px] font-bold" style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
                  <tbody>{data.tests.map(t => (
                    <tr key={t.testId} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td className="px-5 py-2 font-bold" style={{ color: T.textPrimary }}>{t.title}</td>
                      <td className="px-5 py-2 tabular-nums">{t.takers} / {data.overall.traineeCount}人</td>
                      <td className="px-5 py-2 tabular-nums">{t.average == null ? "－" : `${t.average}点`}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="px-5 py-3 text-sm font-bold" style={{ color: T.textPrimary, borderBottom: `1px solid ${T.border}` }}>受講生ごと</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead><tr>{["受講生", "出席", "遅刻・早退・欠席", "日報", "テスト", "講師から一言"].map(h => <th key={h} className="px-4 py-2 text-left text-[11px] font-bold" style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
                <tbody>{data.trainees.map(t => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}`, verticalAlign: "top" }}>
                    <td className="px-4 py-2"><b style={{ color: T.textPrimary }}>{t.name}</b>{t.companyName && <div className="text-[11px]" style={{ color: T.textMuted }}>{t.companyName}</div>}</td>
                    <td className="px-4 py-2 tabular-nums"><b>{pctText(t.attendanceRate)}</b><div className="text-[11px]" style={{ color: T.textMuted }}>{t.attended} / {period?.trainingDays ?? 0}日{t.missing ? ` ・ 未登録 ${t.missing}` : ""}</div></td>
                    <td className="px-4 py-2 tabular-nums">{t.late} ・ {t.early} ・ {t.absent}</td>
                    <td className="px-4 py-2 tabular-nums"><b>{pctText(t.reportRate)}</b><div className="text-[11px]" style={{ color: T.textMuted }}>{t.reportDays}日</div></td>
                    <td className="px-4 py-2 tabular-nums"><b>{t.testAverage == null ? "－" : `${t.testAverage}点`}</b><div className="text-[11px]" style={{ color: T.textMuted }}>{t.testsTaken} / {data.tests.length}回</div></td>
                    <td className="min-w-[240px] px-4 py-2">
                      {editable
                        ? <><textarea value={notes[t.id] || ""} onChange={e => { setNotes(n => ({ ...n, [t.id]: e.target.value })); setDirty(true); }} maxLength={600} rows={2} aria-label={`${t.name}への一言`} className="w-full rounded-lg px-2 py-1 text-xs outline-none print:hidden" style={{ border: `1px solid ${T.border}` }} /><div className="hidden whitespace-pre-wrap text-xs print:block">{notes[t.id] || ""}</div></>
                        : <div className="whitespace-pre-wrap text-xs" style={{ color: T.textSecondary }}>{notes[t.id] || "－"}</div>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>

          <Card className="grid gap-2 px-5 py-4">
            <div className="text-sm font-bold" style={{ color: T.textPrimary }}>講師の所見</div>
            {editable
              ? <><textarea value={summary} onChange={e => { setSummary(e.target.value); setDirty(true); }} maxLength={4000} rows={6} aria-label="講師の所見" className="w-full rounded-xl px-3 py-2 text-sm outline-none print:hidden" style={{ border: `1px solid ${T.border}` }} /><div className="hidden whitespace-pre-wrap text-sm print:block">{summary}</div></>
              : <div className="whitespace-pre-wrap text-sm" style={{ color: T.textSecondary }}>{summary || "－"}</div>}
          </Card>
        </div>
      )}
    </div>
  );
}
