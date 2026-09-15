import React, { useEffect, useMemo, useState } from "react";
import { Clock, NotebookPen, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { apiGet } from "../../api.js";
import { Btn, Modal, PRISM, PrismCard, PrismErrorRetryCard, SkeletonRows } from "../../components/common";
import { setTrainingTargetContext } from "../../utils/common/courseContext.js";
import { homeDateLabel } from "./useTraining.js";

/* 受講生ホームの提出カレンダー（2026-09-14 承認モック: trainee-calendar）。
   今日しか映さないホームだと、昨日出し忘れた日報は翌日からどこにも出てこない。
   1か月ぶんの勤怠・日報の提出状況をそのまま並べ、出し忘れた日が残るようにする。

   決めごとは2つだけ:
   - **これからの研修日は「未提出」にしない**（「予定」と出す）。まだ出す日が来ていない
     ものを赤くすると、赤が当たり前になって見なくなる。
   - **取得できなかった日は「?」のままにする**。未提出と混ぜると、出したのに出していない
     ことにされる。 */

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

const BADGE_TONE = {
  ok: { bg: PRISM.okSubtle, color: PRISM.ok, border: "1px solid transparent" },
  ng: { bg: PRISM.badSubtle, color: PRISM.bad, border: "1px solid transparent" },
  plan: { bg: "transparent", color: PRISM.mut, border: `1px dashed ${PRISM.line2}` },
  unk: { bg: PRISM.neutralSubtle, color: PRISM.sub, border: `1px dashed ${PRISM.mut}` },
};

function pad(n) { return String(n).padStart(2, "0"); }
function isoOf(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function monthOf(iso) { return String(iso || "").slice(0, 7); }
function shiftMonth(month, delta) {
  const [y, m] = String(month).split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function monthLabel(month) {
  const [y, m] = String(month).split("-").map(Number);
  return `${y}年${m}月`;
}

function reportHasComment(report) {
  if (!report) return false;
  if (String(report.comment || "").trim()) return true;
  return Array.isArray(report.comments) && report.comments.some(c => String(c?.text || c?.comment || c?.body || "").trim());
}

function Badge({ tone, icon: Icon, label, compact = false, size = 11 }) {
  const c = BADGE_TONE[tone] || BADGE_TONE.plan;
  return (
    <span
      className="feeps-subcal-badge inline-flex items-center gap-1 rounded-md font-bold leading-[1.5]"
      style={{ background: c.bg, color: c.color, border: c.border, padding: compact ? 3 : "2px 5px", fontSize: 9.5, whiteSpace: "nowrap" }}
    >
      {Icon && <Icon size={size} strokeWidth={2.4} className="shrink-0" />}
      {!compact && label && <span className="feeps-subcal-label">{label}</span>}
    </span>
  );
}

// アイコン＝どちらの提出物か、色と文言＝どうなっているか。
// 「勤」「報」の1文字だと何のことか分からないので文言を出す。
function badgeFor(kind, state) {
  if (state === "unk") return { tone: "unk", icon: HelpCircle, label: "確認できません" };
  if (kind === "att") return { tone: state, icon: Clock, label: state === "ok" ? "打刻済み" : "未打刻" };
  return { tone: state, icon: NotebookPen, label: state === "ok" ? "提出済み" : "未提出" };
}

export default function SubmissionCalendar({ courses = [], reports = [], attendance = [], reportsAvailable = true, attendanceAvailable = true, today, go }) {
  const [month, setMonth] = useState(() => monthOf(today));
  const [state, setState] = useState("loading"); // loading | ready | setup_required | error
  const [daysByDate, setDaysByDate] = useState({});
  const [openDate, setOpenDate] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // **配列そのものではなく文字列を依存に使う。** 親（ホーム）が再描画されるたびに
  // courses は新しい配列になるため、配列を依存にすると画面スクロールのような
  // 描画のたびに研修カレンダーを取り直してしまう（実際にホイール操作で毎回
  // 「読み込み中」が挟まる不具合になっていた）。
  const courseKey = useMemo(
    () => [...new Set(courses.map(c => c?.courseId).filter(Boolean))].sort().join(","),
    [courses],
  );

  useEffect(() => {
    let alive = true;
    const courseIds = courseKey ? courseKey.split(",") : [];
    if (!courseIds.length) { setDaysByDate({}); setState("ready"); return () => { alive = false; }; }
    setState(current => (current === "ready" ? "ready" : "loading"));
    // 勤怠画面と同じ取り方（/courses/{id}/workdays）。月を変えたときだけ取り直す。
    Promise.all(courseIds.map(courseId =>
      apiGet(`/courses/${courseId}/workdays?month=${month}`).then(result => ({ courseId, result }))))
      .then(results => {
        if (!alive) return;
        const byDate = {};
        results.forEach(({ courseId, result }) => {
          (result?.days || []).forEach(day => {
            if (day.status !== "ready" || day.isTrainingDay !== true) return;
            byDate[day.date] = [...(byDate[day.date] || []), { ...day, courseId }];
          });
        });
        setDaysByDate(byDate);
        setState(results.some(({ result }) => result?.status === "setup_required") ? "setup_required" : "ready");
      })
      .catch(() => { if (alive) { setDaysByDate({}); setState("error"); } });
    return () => { alive = false; };
  }, [courseKey, month, reloadKey]);

  const reportByDate = useMemo(() => {
    const map = {};
    (reports || []).forEach(r => { if (r?.date) map[r.date] = r; });
    return map;
  }, [reports]);
  const attendanceByDate = useMemo(() => {
    const map = {};
    (attendance || []).forEach(a => { if (a?.date) map[a.date] = a; });
    return map;
  }, [attendance]);

  // 研修日かどうかが分からないときは提出状況も判定しない。研修日でない日を
  // 「未提出」にしてしまうため。
  const scheduleUnknown = state === "error" || state === "setup_required";
  // 研修日が分からないときに「この月の研修日 0日」と出すと、取得失敗を0へ丸めたことになる
  const countsUnknown = state === "loading" || scheduleUnknown;

  function stateOf(iso) {
    const contexts = daysByDate[iso];
    if (!contexts || !contexts.length) return null;
    if (iso > today) return { kind: "plan", contexts };
    const att = scheduleUnknown || !attendanceAvailable ? "unk" : (attendanceByDate[iso]?.clockIn ? "ok" : "ng");
    const rep = scheduleUnknown || !reportsAvailable ? "unk" : (reportByDate[iso] ? "ok" : "ng");
    return { kind: "past", att, rep, contexts };
  }

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // 月曜はじまり
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { iso: isoOf(d), day: d.getDate(), inMonth: d.getMonth() === m - 1 };
    });
  }, [month]);

  const summary = useMemo(() => {
    const inMonth = cells.filter(c => c.inMonth);
    const trainingDays = inMonth.filter(c => daysByDate[c.iso]).length;
    const finished = inMonth.filter(c => daysByDate[c.iso] && c.iso <= today).length;
    // 今日は「出し忘れ」に数えない。まだ一日が終わっていないのに忘れた扱いにすると、
    // 毎朝かならず1日ぶん赤くなり、数字が信用されなくなる（セルの赤は今日も出す）。
    const missed = inMonth.filter(c => {
      if (c.iso >= today) return false;
      const s = stateOf(c.iso);
      return s?.kind === "past" && (s.att === "ng" || s.rep === "ng");
    }).length;
    return { trainingDays, finished, missed };
  }, [cells, daysByDate, reportByDate, attendanceByDate, today, scheduleUnknown, reportsAvailable, attendanceAvailable]);

  const openState = openDate ? stateOf(openDate) : null;
  const openContext = openState?.contexts?.[0] || null;

  function openReports(date) {
    // 日報画面は目的の日付をそのまま開ける（受講生はtrainingTargetの日付を初期値に使う）
    setTrainingTargetContext({ view: "reports", courseId: openContext?.courseId || "", date });
    setOpenDate("");
    go && go("reports");
  }
  function openAttendance(date) {
    setTrainingTargetContext({ view: "attendance", courseId: openContext?.courseId || "", date });
    setOpenDate("");
    go && go("attendance");
  }

  return (
    <PrismCard className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[13.5px] font-bold" style={{ color: PRISM.ink }}>提出カレンダー</span>
        <span className="text-[11.5px]" style={{ color: PRISM.mut }}>勤怠と日報を出せているか</span>
        <div className="ml-auto flex items-center gap-1">
          <Btn size="sm" kind="ghost" aria-label="前の月" onClick={() => setMonth(m => shiftMonth(m, -1))}><ChevronLeft size={14} /></Btn>
          <span className="px-1 text-[12.5px] font-bold tabular-nums" style={{ color: PRISM.ink }}>{monthLabel(month)}</span>
          <Btn size="sm" kind="ghost" aria-label="次の月" onClick={() => setMonth(m => shiftMonth(m, 1))}><ChevronRight size={14} /></Btn>
          {month !== monthOf(today) && <Btn size="sm" kind="ghost" onClick={() => setMonth(monthOf(today))}>今月</Btn>}
        </div>
      </div>

      {state === "error" && (
        <PrismErrorRetryCard
          message="研修カレンダーを確認できませんでした。研修日かどうかが分からないため、提出状況は「確認できません」と出しています。"
          onRetry={() => setReloadKey(v => v + 1)}
        />
      )}
      {state === "setup_required" && (
        <div className="mb-3 rounded-[12px] px-3 py-2 text-[11.5px]" style={{ background: PRISM.warnSubtle, color: PRISM.warn }}>
          研修日程が未設定のため、提出状況は判定していません。運営担当者へご確認ください。
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="min-w-[130px] flex-1 rounded-[12px] px-3 py-2" style={{ border: `1px solid ${PRISM.line}` }}>
          <div className="text-[10.5px] font-bold" style={{ color: PRISM.mut }}>この月の研修日</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <b className="text-[20px] font-bold tabular-nums" style={{ color: PRISM.ink }}>{countsUnknown ? "—" : summary.trainingDays}</b>
            <span className="text-[11px]" style={{ color: PRISM.mut }}>日</span>
          </div>
        </div>
        <div className="min-w-[130px] flex-1 rounded-[12px] px-3 py-2" style={{ border: `1px solid ${PRISM.line}` }}>
          <div className="text-[10.5px] font-bold" style={{ color: PRISM.mut }}>今日までに終わった研修日</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <b className="text-[20px] font-bold tabular-nums" style={{ color: PRISM.ink }}>{countsUnknown ? "—" : summary.finished}</b>
            <span className="text-[11px]" style={{ color: PRISM.mut }}>/ {countsUnknown ? "—" : summary.trainingDays}日</span>
          </div>
        </div>
        <div className="min-w-[130px] flex-1 rounded-[12px] px-3 py-2"
          style={{ border: `1px solid ${summary.missed && !scheduleUnknown ? PRISM.badLine : PRISM.line}`, background: summary.missed && !scheduleUnknown ? PRISM.badSubtle : "transparent" }}>
          <div className="text-[10.5px] font-bold" style={{ color: PRISM.mut }}>出し忘れ</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <b className="text-[20px] font-bold tabular-nums" style={{ color: summary.missed && !scheduleUnknown ? PRISM.bad : PRISM.ink }}>
              {countsUnknown ? "—" : summary.missed}
            </b>
            <span className="text-[11px]" style={{ color: PRISM.mut }}>日</span>
          </div>
        </div>
      </div>

      {/* 月を変えたときなどの再取得では、いま出ているカレンダーを消さない。
          毎回スケルトンに戻ると画面がちらついて読めない */}
      {state === "loading" && !Object.keys(daysByDate).length ? <div className="mt-3"><SkeletonRows rows={4} /></div> : (
        <div className="feeps-subcal mt-3 grid gap-1.5" style={{ gridTemplateColumns: "repeat(7,minmax(0,1fr))" }}>
          {WEEKDAYS.map((w, i) => (
            <div key={w} className="text-center text-[10px] font-extrabold tracking-[0.06em]"
              style={{ color: i === 5 ? "#4E7FB5" : i === 6 ? "#B5654E" : PRISM.mut }}>{w}</div>
          ))}
          {cells.map(cell => {
            const s = cell.inMonth ? stateOf(cell.iso) : null;
            const isToday = cell.iso === today;
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => cell.inMonth && setOpenDate(cell.iso)}
                disabled={!cell.inMonth}
                className="feeps-subcal-cell block rounded-[10px] p-1.5 text-left"
                style={{
                  minHeight: 72,
                  background: s ? PRISM.surface : PRISM.base,
                  border: `1px solid ${isToday ? PRISM.accent : s ? PRISM.line : "transparent"}`,
                  boxShadow: isToday ? `0 0 0 2px ${PRISM.accentSubtle}` : "none",
                  opacity: cell.inMonth ? 1 : 0.3,
                  cursor: cell.inMonth ? "pointer" : "default",
                }}
              >
                {/* 今日はどの日かが一番先に分かってほしいので、枠だけでなく日付の色も変える */}
                <span className="flex items-center gap-1">
                  <span className="text-[11.5px] tabular-nums"
                    style={{ color: isToday ? PRISM.accent : s ? PRISM.ink : PRISM.mut, fontWeight: isToday ? 800 : 700 }}>{cell.day}</span>
                  {isToday && (
                    <span className="feeps-subcal-today rounded-full px-1.5 py-px text-[9px] font-extrabold leading-[1.4]"
                      style={{ background: PRISM.accent, color: "#fff" }}>今日</span>
                  )}
                </span>
                {s && (
                  <span className="mt-1.5 flex flex-col items-start gap-[3px]">
                    {s.kind === "plan" ? (
                      // これからの研修日は勤怠・日報を別々に出さない。同じ「予定」が2行並ぶだけになる
                      <Badge tone="plan" label="予定" />
                    ) : (
                      <>
                        <Badge {...badgeFor("att", s.att)} />
                        <Badge {...badgeFor("rep", s.rep)} />
                      </>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10.5px]" style={{ color: PRISM.mut }}>
        <span className="inline-flex items-center gap-1.5"><Clock size={12} strokeWidth={2.4} />時計のマーク＝勤怠</span>
        <span className="inline-flex items-center gap-1.5"><NotebookPen size={12} strokeWidth={2.4} />ペンのマーク＝日報</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PRISM.ok }} />緑＝出せている</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PRISM.bad }} />赤＝出ていない</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ border: `1px dashed ${PRISM.mut}` }} />点線＝これから／確認できません</span>
        <span className="ml-auto">色のない日は研修がない日です</span>
      </div>

      {openDate && (
        <Modal
          size="sm"
          title={homeDateLabel(openDate)}
          desc={openState ? (openContext?.title || "この日の単元は登録されていません") : "この日は研修日ではありません"}
          onClose={() => setOpenDate("")}
        >
          {!openState ? (
            <p className="text-[12.5px] leading-relaxed" style={{ color: PRISM.sub }}>
              勤怠・日報の提出は必要ありません。研修日かどうかは、講師が登録した研修カレンダーで決まります。
            </p>
          ) : openState.kind === "plan" ? (
            <p className="text-[12.5px] leading-relaxed" style={{ color: PRISM.sub }}>
              これからの研修日です。当日になると勤怠と日報を入力できるようになります。
              {openContext?.startTime && openContext?.endTime ? `（${openContext.startTime}〜${openContext.endTime}）` : ""}
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: PRISM.line }}>
              <div className="flex items-center gap-3 py-3 first:pt-0">
                <Badge {...badgeFor("att", openState.att)} compact size={14} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold" style={{ color: PRISM.ink }}>勤怠</div>
                  <div className="text-[11px]" style={{ color: openState.att === "ng" ? PRISM.warn : PRISM.mut, fontWeight: openState.att === "ng" ? 700 : 400 }}>
                    {openState.att === "unk" ? "確認できませんでした"
                      : openState.att === "ok"
                        ? [attendanceByDate[openDate]?.clockIn && `${attendanceByDate[openDate].clockIn} 出勤`, attendanceByDate[openDate]?.clockOut && `${attendanceByDate[openDate].clockOut} 退勤`].filter(Boolean).join(" ／ ")
                        : "まだ打刻がありません"}
                  </div>
                </div>
                <Btn size="sm" kind={openState.att === "ng" ? "primary" : "ghost"} onClick={() => openAttendance(openDate)}>
                  {openState.att === "ng" ? "記録する" : "勤怠を開く"}
                </Btn>
              </div>
              <div className="flex items-center gap-3 py-3">
                <Badge {...badgeFor("rep", openState.rep)} compact size={14} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold" style={{ color: PRISM.ink }}>日報</div>
                  <div className="text-[11px]" style={{ color: openState.rep === "ng" ? PRISM.warn : PRISM.mut, fontWeight: openState.rep === "ng" ? 700 : 400 }}>
                    {openState.rep === "unk" ? "確認できませんでした"
                      : openState.rep === "ok"
                        ? (reportHasComment(reportByDate[openDate]) ? "提出済み ・ 先生からの返事あり" : "提出済み")
                        : "まだ提出されていません"}
                  </div>
                </div>
                <Btn size="sm" kind={openState.rep === "ng" ? "primary" : "ghost"} onClick={() => openReports(openDate)}>
                  {openState.rep === "ng" ? "日報を書く" : "日報を開く"}
                </Btn>
              </div>
              {reportHasComment(reportByDate[openDate]) && (
                <div className="pt-3">
                  <div className="rounded-[10px] px-3 py-2.5" style={{ background: PRISM.accentSubtle }}>
                    <div className="text-[10.5px] font-bold" style={{ color: PRISM.accent }}>先生からの返事</div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[11.5px] leading-[1.75]" style={{ color: PRISM.sub }}>
                      {String(reportByDate[openDate]?.comment || "").trim()
                        || (reportByDate[openDate]?.comments || []).map(c => String(c?.text || c?.comment || c?.body || "").trim()).filter(Boolean)[0]}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </PrismCard>
  );
}
