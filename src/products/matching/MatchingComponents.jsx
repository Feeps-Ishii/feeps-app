import React from "react";
import {
  Activity, AlertCircle, Briefcase, Building2, Calendar, CheckCircle2,
  ChevronLeft, FileSpreadsheet, FileText, MapPin, Printer, Sparkles
} from "lucide-react";
import { MATCHING_HOME_CARDS, OPENINGS } from "./MatchingCatalog.js";
import { candidateToSheet, matchTone, useMatching } from "./useMatching.js";
import { Card, Badge, Btn, Avatar, SectionHead, PageHeader, ProductNavCard, T, EmptyState as CommonEmptyState, SkeletonRows } from "../../components/common";

const GRAD = `linear-gradient(135deg, ${T.accent} 0%, #5B8CFF 100%)`;
const FOOTER = "Copyright © 2025 Feeps Inc. All Rights Reserved.";

function Bar({ value, tone = "cyan" }) {
  const t = { cyan: T.accent, green: T.success, amber: T.warning };
  return <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: T.border }}>
    <div className="h-full rounded-full" style={{ width: `${value}%`, background: t[tone], transition: "width .8s ease" }} /></div>;
}
function EmptyState({ title, desc }) {
  return <CommonEmptyState icon={Briefcase} title={title} desc={desc} />;
}
async function exportSkillSheetExcel({ p, selfPR, strengths, weak, skills, projects }) {
  try {
    const XLSX = await import("xlsx");
    const W = 6, rows = [], merges = [];
    const push = r => rows.push(r);
    const full = text => { const r = rows.length; push([text]); merges.push({ s: { r, c: 0 }, e: { r, c: W } }); };
    full("スキルシート");
    push([]);
    push(["氏名", p.name, "", "年齢", String(p.age), "", ""]);
    push(["役割", p.title, "", "経験年数", p.exp, "", ""]);
    push(["最寄駅", p.station, "", "", "", "", ""]);
    push([]);
    full("自己PR");
    { const r = rows.length; push([selfPR]); merges.push({ s: { r, c: 0 }, e: { r, c: W } }); }
    push([]);
    push(["強み", strengths.join("、")]);
    push(["弱み・課題", weak.join("、")]);
    push([]);
    full("保有スキル・資格");
    push(["分類", "名称", "習熟度(%)"]);
    skills.forEach(sk => push([sk.cat, sk.name, sk.level]));
    push([]);
    full("案件履歴 / 職務経歴");
    push(["No", "期間", "案件名 / 業務内容", "役割", "規模", "担当工程", "使用技術"]);
    projects.forEach((pr, i) => push([
      i + 1, pr.period, pr.name + (pr.desc ? "\n" + pr.desc : ""), pr.role, pr.scale,
      (pr.phases || []).join("・"), (pr.tech || []).join(", "),
    ]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 46 }, { wch: 14 }, { wch: 10 }, { wch: 26 }, { wch: 28 }];
    ws["!merges"] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "スキルシート");
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `スキルシート_${p.name}_${stamp}.xlsx`);
  } catch (e) { console.error(e); }
}

function SkillSheetPreview({ data, onClose }) {
  const { p, selfPR, strengths, weak, skills, projects } = data;
  const today = new Date().toLocaleDateString("ja-JP");
  function doPrint() { try { window.print(); } catch (e) { /* noop */ } }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Btn kind="ghost" size="sm" icon={ChevronLeft} onClick={onClose}>編集に戻る</Btn>
        <div className="flex gap-2"><Btn kind="ghost" size="sm" icon={Printer} onClick={doPrint}>印刷</Btn>
          <Btn size="sm" icon={FileSpreadsheet} onClick={() => exportSkillSheetExcel(data)}>Excelで発行</Btn></div>
      </div>
      <Card className="overflow-hidden">
        <div className="h-2" style={{ background: GRAD }} />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4" style={{ borderColor: T.border }}>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: T.accent }}>SKILL SHEET</div>
              <div className="mt-1 text-2xl font-bold" style={{ color: T.textPrimary }}>{p.name}</div>
              <div className="text-sm" style={{ color: T.textSecondary }}>{p.title}</div>
            </div>
            <div className="text-right text-xs" style={{ color: T.textMuted }}>
              <div>年齢：{p.age}　経験：{p.exp}</div>
              <div className="flex items-center justify-end gap-1"><MapPin size={11} />最寄：{p.station}</div>
              <div className="mt-1">発行日：{today}</div>
            </div>
          </div>

          {selfPR && (
            <div className="mt-5">
              <div className="mb-1.5 text-xs font-bold" style={{ color: T.textPrimary }}>自己PR</div>
              <p className="text-sm leading-relaxed" style={{ color: T.textSecondary }}>{selfPR}</p>
            </div>
          )}

          {(strengths.length > 0 || weak.length > 0) && (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {strengths.length > 0 && <div>
                <div className="mb-1.5 text-xs font-bold" style={{ color: T.accent }}>強み</div>
                <div className="flex flex-wrap gap-1.5">{strengths.map(t => <span key={t} className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>{t}</span>)}</div>
              </div>}
              {weak.length > 0 && <div>
                <div className="mb-1.5 text-xs font-bold" style={{ color: T.warning }}>弱み・伸ばしたい点</div>
                <div className="flex flex-wrap gap-1.5">{weak.map(t => <span key={t} className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: T.warningSubtle, color: T.warning }}>{t}</span>)}</div>
              </div>}
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 text-xs font-bold" style={{ color: T.textPrimary }}>保有スキル</div>
            {skills.length === 0 ? <div className="text-xs" style={{ color: T.textMuted }}>登録なし</div> : <div className="grid gap-2 sm:grid-cols-2">{skills.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 truncate font-semibold" style={{ color: T.textPrimary }}>{s.name}</span>
                <div className="flex-1"><Bar value={s.level} tone={s.level >= 80 ? "green" : "cyan"} /></div>
                <span style={{ color: T.textMuted }}>{s.level}</span>
              </div>
            ))}</div>}
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs font-bold" style={{ color: T.textPrimary }}>案件履歴 / 職務経歴</div>
            <div className="space-y-2">{projects.map(pr => (
              <div key={pr.id} className="rounded-lg p-3" style={{ border: `1px solid ${T.border}` }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{pr.name}</span>
                  <span className="text-xs" style={{ color: T.textMuted }}>{pr.period}</span></div>
                <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>役割：{pr.role || "—"} ・ 規模：{pr.scale || "—"}{pr.phases && pr.phases.length ? " ・ 担当：" + pr.phases.join("・") : ""}</div>
                {pr.desc && <div className="mt-1 text-xs leading-relaxed" style={{ color: T.textSecondary }}>{pr.desc}</div>}
                <div className="mt-1.5 flex flex-wrap gap-1">{pr.tech.map(t => <span key={t} className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>{t}</span>)}</div>
              </div>
            ))}{projects.length === 0 && <div className="text-xs" style={{ color: T.textMuted }}>登録なし</div>}</div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-3 text-xs" style={{ borderColor: T.border, color: T.textMuted }}>
            <span>Generated by Feeps 研修管理</span><span>{FOOTER}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function MatchingHome({ goSub, role = "admin", themeColor = "#D97706" }) {
  const desc = role === "client"
    ? "自社受講生の実スキルから、サンプル案件へのマッチ度を確認します。"
    : "全受講生の実スキルから、サンプル案件へのマッチ度を確認します。";
  const cards = role === "client" ? MATCHING_HOME_CARDS.client : MATCHING_HOME_CARDS.admin;
  return (
    <div>
      <PageHeader
        product="matching"
        label="案件管理"
        title="スキルを、案件へつなげる。"
        description={desc}
        chips={[
          { label: "サンプル案件", value: OPENINGS.length, unit: "件" },
        ]}
        cta={{ label: "案件マッチングを開く", icon: Sparkles, onClick: () => goSub("mt_matching") }}
      />
      <div className="mb-5 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: T.warningSubtle, color: T.warning }}>
        <AlertCircle size={14} />案件マッチングの候補者は実データです。案件情報はサンプルで、案件一覧・現場参画状況・参画履歴は案件管理用のデータ基盤を追加後に対応予定です。
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ key, icon, label, desc: d, ready }, i) => (
          <ProductNavCard key={key} product="matching" icon={icon} title={label} desc={ready ? d : d + "（準備中）"}
            onClick={() => goSub(key)} highlight={key === "mt_matching"} badge={key === "mt_matching" ? "よく使う" : undefined} delay={650 + i * 60} />
        ))}
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl p-4" style={{ background: `${themeColor}08`, border: `1px solid ${themeColor}20` }}>
        <Sparkles size={15} style={{ color: themeColor, marginTop: 2 }} />
        <p className="text-sm" style={{ color: T.textMuted }}><span className="font-semibold" style={{ color: T.textPrimary }}>連携：</span>スキル・成長プロダクトのスキルシート（保有スキル・自己PR・案件履歴）が、そのまま案件マッチングの判定材料になります。</p>
      </div>
    </div>
  );
}

export function ProjectMatching({ role }) {
  const { oid, setOid, opening: o, ranked, loading, err, preview, setPreview } = useMatching();
  const title = "案件マッチング";
  const desc = role === "client"
    ? "自社受講生の実スキルシートから、案件にマッチする人材を選定します"
    : "受講生の実スキルシートから、案件にマッチする人材を選定します";
  if (preview) return (
    <div>
      <div className="mb-4"><Btn kind="ghost" size="sm" icon={ChevronLeft} onClick={() => setPreview(null)}>案件選定に戻る</Btn></div>
      <SkillSheetPreview data={candidateToSheet(preview)} onClose={() => setPreview(null)} />
    </div>
  );
  return (
    <div>
      <SectionHead title={title} desc={desc} />
      <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: T.warningSubtle, color: T.warning }}>
        <AlertCircle size={14} />案件情報はサンプルです。候補者は{role === "client" ? "自社の" : ""}実受講生・実スキルデータです。
      </div>
      <div className="-mx-1 mb-5 flex gap-3 overflow-x-auto px-1 pb-1">
        {OPENINGS.map(op => { const active = op.id === oid;
          return (
            <button key={op.id} onClick={() => setOid(op.id)} className="w-64 shrink-0 rounded-2xl p-4 text-left transition"
              style={{ background: active ? T.accentSubtle : "#fff", border: `1.5px solid ${active ? T.accent : T.border}` }}>
              <div className="flex items-center justify-between"><Badge tone="cyan">{op.industry}</Badge>
                <span className="text-xs font-semibold" style={{ color: T.textMuted }}>募集 {op.headcount}名</span></div>
              <div className="mt-2 text-sm font-bold leading-snug" style={{ color: T.textPrimary }}>{op.name}</div>
              <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{op.company} ・ {op.period}</div>
              <div className="mt-2 flex flex-wrap gap-1">{op.req.map(r => <span key={r.skill} className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ background: T.bgBase, color: T.textSecondary }}>{r.skill}</span>)}</div>
            </button>
          );
        })}
      </div>

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-bold" style={{ color: T.textPrimary }}>{o.name}</h3>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: T.textMuted }}>
              <span className="inline-flex items-center gap-1"><Building2 size={12} />{o.company}</span>
              <span className="inline-flex items-center gap-1"><Calendar size={12} />{o.period}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={12} />{o.location}</span>
              <span>単価 {o.rate}</span><span>募集 {o.headcount}名</span></div></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold" style={{ color: T.textMuted }}>必要スキル：</span>
          {o.req.map(r => <span key={r.skill} className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>{r.skill}（{r.level}+）</span>)}
          <span className="text-xs font-bold" style={{ color: T.textMuted }}>｜ 工程：</span>
          {o.phases.map(ph => <span key={ph} className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ background: T.successSubtle, color: T.success }}>{ph}</span>)}
        </div>
      </Card>

      {err && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{err}</div>}
      {loading ? <Card><SkeletonRows rows={5} /></Card> : ranked.length === 0 ? (
        <Card><EmptyState title="候補者がいません" desc={role === "client" ? "自社受講生が登録されると候補者として表示されます。" : "受講生が登録されると候補者として表示されます。"} /></Card>
      ) : (
      <div className="space-y-3">{ranked.map(({ c, score, matched, missing, hasSkills }, i) => (
          <Card key={c.userId} className="p-4" style={i === 0 && hasSkills ? { border: `1.5px solid ${T.accent}` } : undefined}>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={c.name || c.email} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold" style={{ color: T.textPrimary }}>{c.name || "氏名未設定"}</span>
                  {i === 0 && hasSkills && <Badge tone="cyan">最適</Badge>}</div>
                <div className="text-xs" style={{ color: T.textMuted }}>{c.company || "所属未設定"}</div>
              </div>
              {hasSkills ? (
                <div className="w-24 text-right">
                  <div className="text-lg font-bold" style={{ color: score >= 80 ? T.success : score >= 60 ? T.accentHover : score >= 40 ? T.warning : T.textMuted }}>{score}%</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>マッチ度</div>
                </div>
              ) : <Badge tone="muted">スキル未登録</Badge>}
            </div>
            {hasSkills && (<>
              <div className="mt-2"><Bar value={score} tone={matchTone(score)} /></div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {matched.map(s => <span key={s} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: T.successSubtle, color: T.success }}><CheckCircle2 size={11} />{s}</span>)}
                {missing.map(s => <span key={s} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: T.warningSubtle, color: T.warning }}><AlertCircle size={11} />{s} 不足</span>)}
              </div>
            </>)}
            <div className="mt-3 flex justify-end">
              <Btn kind="ghost" size="sm" icon={FileText} onClick={() => setPreview(c)}>スキルシート</Btn>
            </div>
          </Card>
        ))}</div>
      )}
      <p className="mt-3 text-xs" style={{ color: T.textMuted }}>※ マッチ度は候補者の実スキルシートと案件の必要スキル・レベルから算出します。不足スキルはEラーニングでの補強候補になります。案件へのアサイン・参画管理は今後の対応予定です。</p>
    </div>
  );
}

export function MatchingPlaceholder({ title, desc }) {
  return (
    <Card>
      <EmptyState title={title} desc={desc} />
    </Card>
  );
}
