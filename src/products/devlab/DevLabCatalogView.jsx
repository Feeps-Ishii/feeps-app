import React, { useMemo, useState } from "react";
import { Card, Badge, Btn, T } from "../../components/common";
import { methodOf, roleSlotsFor, stepsForRole, findRoleSlot, hasRoleSetup } from "./roles/phases.js";
import { sortDevLabProjects, devLabWorkspaceStackLabel, devLabLevelLabel } from "./DevLabCatalog.js";

// 開発演習の一覧（2026-09-05）。承認モック: mock/devlab-catalog
//
// それまでは案件とベースプロジェクトがカードで並んでいるだけで、
// **どれが自分向けか・何が身につくか・どこまでやったか**が分からなかった。
//
// - 進めている案件を一番上に出す（次のタスク名と残り件数まで）
// - 案件は**やりたい役割**で絞る。コードの練習は**言語**で絞る。選び方を変えて役割の違いを出す
// - 並びは 進行中 → 未着手 → 完了

const ROLE_FILTERS = [
  { v: "all", nm: "すべて" },
  { v: "upstream", nm: "要件を決める", match: ["upstream", "po"] },
  { v: "front", nm: "画面をつくる", match: ["front", "dev"] },
  { v: "back", nm: "処理とデータ", match: ["back", "dev"] },
  { v: "qa", nm: "確かめる", match: ["qa"] },
];
const LEVELS = [
  { v: "all", nm: "すべて" }, { v: "beginner", nm: "初級" },
  { v: "intermediate", nm: "中級" }, { v: "advanced", nm: "上級" },
];
const METHODS = [
  { v: "all", nm: "すべて" }, { v: "waterfall", nm: "決めてから作る" }, { v: "agile", nm: "作りながら決める" },
];
const LAB_LEVELS = LEVELS;

function Chips({ list, value, onChange, countOf }) {
  return (
    <div className="flex flex-wrap gap-2">
      {list.map(o => {
        const on = value === o.v;
        const n = countOf ? countOf(o.v) : null;
        return (
          <button
            key={o.v} type="button" aria-pressed={on} onClick={() => onChange(o.v)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
            style={{
              borderColor: on ? T.accent : T.border,
              background: on ? T.accentSubtle : T.bgSurface,
              color: on ? T.accentHover : T.textSecondary,
              fontWeight: on ? 700 : 400,
            }}
          >
            {o.nm}
            {n != null && <span className="text-[10.5px]" style={{ color: on ? T.accentHover : T.textMuted }}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

function FilterRow({ label, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-[64px] shrink-0 text-[11px] font-bold" style={{ color: T.textMuted }}>{label}</span>
      {children}
    </div>
  );
}

// 進めている案件を上に出すための情報。担当のタスクだけを数える
function progressOf(project, byProject) {
  const slot = hasRoleSetup(project) ? findRoleSlot(project, project.myAssignment?.roleSlotId || "") : null;
  const steps = slot ? stepsForRole(project.steps, slot) : (project.steps || []);
  const passed = byProject.get(project.id) || new Set();
  const done = steps.filter(s => passed.has(s.stepId)).length;
  const next = steps.find(s => !passed.has(s.stepId));
  return { slot, total: steps.length, done, next };
}

function ResumeCard({ project, prog, onOpen }) {
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{
        background: `linear-gradient(135deg, ${T.accentSubtle}, ${T.aiSubtle})`,
        border: `1px solid ${T.accent}55`,
      }}
    >
      <div className="text-[11px] font-bold tracking-wider" style={{ color: T.accentHover }}>進めている案件</div>
      <h3 className="mt-1 text-lg font-bold" style={{ color: T.textPrimary }}>{project.title}</h3>
      <p className="mt-0.5 text-xs" style={{ color: T.textSecondary }}>
        {[project.clientName, prog.slot?.name].filter(Boolean).join("　／　")}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-3"
        style={{ borderColor: T.border, background: T.bgSurface }}>
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold" style={{ color: T.textMuted }}>次にやること</div>
          <div className="text-sm font-bold" style={{ color: T.textPrimary }}>
            {prog.next ? prog.next.title : "担当分は終わりました"}
          </div>
        </div>
        {prog.total > 0 && (
          <div className="w-[150px]">
            <div className="h-[7px] overflow-hidden rounded-full" style={{ background: T.bgBase }}>
              <div className="h-full rounded-full"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.aiAccentDeep})` }} />
            </div>
            <div className="mt-1 text-[11px] tabular-nums" style={{ color: T.textMuted }}>
              {prog.done} / {prog.total} タスク
            </div>
          </div>
        )}
        <span className="flex-1" />
        <Btn onClick={() => onOpen(project.id)}>続きから</Btn>
      </div>
    </div>
  );
}

function ProjectCard({ project, prog, onOpen }) {
  const method = methodOf(project);
  const slots = hasRoleSetup(project)
    ? roleSlotsFor(project).filter(s => !s.premium).map(s => [s.name, stepsForRole(project.steps, s).length])
    : [];
  const total = (project.steps || []).length;
  const done = project.myStatus === "completed";
  const running = project.myStatus === "in_progress";

  return (
    <button
      type="button" onClick={() => onOpen(project.id)}
      className="flex flex-col overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: T.border, background: T.bgSurface }}
    >
      <span className="h-1 w-full"
        style={{ background: done ? T.success : `linear-gradient(90deg, ${T.accent}, ${T.aiAccentDeep})` }} />
      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-[11.5px]" style={{ color: T.textMuted }}>{project.clientName || "案件"}</span>
        <span className="text-base font-bold leading-snug" style={{ color: T.textPrimary }}>{project.title}</span>
        {project.background && (
          <span className="line-clamp-2 text-xs leading-relaxed" style={{ color: T.textSecondary }}>
            {project.background}
          </span>
        )}
        <span className="flex flex-wrap gap-1.5">
          <Badge tone="muted">{devLabLevelLabel(project.level)}</Badge>
          {project.estimatedHours > 0 && <Badge tone="muted">約{project.estimatedHours}時間</Badge>}
          {hasRoleSetup(project) && (
            <Badge tone="muted">{method === "waterfall" ? "決めてから作る" : "作りながら決める"}</Badge>
          )}
          {(project.techStack || []).slice(0, 3).map(t => <Badge key={t} tone="muted">{t}</Badge>)}
        </span>

        {/* 身につくこと。設定されていない案件では出さない */}
        {(project.gains || []).length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {project.gains.map(g => (
              <span key={g} className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                style={{ background: T.successSubtle, color: T.success }}>{g}</span>
            ))}
          </span>
        )}

        <span className="mt-auto border-t border-dashed pt-2.5" style={{ borderColor: T.border }}>
          <span className="text-[10.5px] font-bold" style={{ color: T.textMuted }}>担当できる役割</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {slots.length
              ? slots.map(([nm, n]) => (
                <span key={nm} className="rounded-md px-2 py-0.5 text-[11.5px] font-bold"
                  style={{ background: T.accentSubtle, color: T.accentHover }}>{nm} {n}件</span>
              ))
              : <span className="text-[11.5px]" style={{ color: T.textMuted }}>担当の設定なし（全タスクを進めます）</span>}
          </span>
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-2.5 border-t px-4 py-2.5"
        style={{ borderColor: T.border, background: T.bgBase }}>
        <Badge tone={done ? "green" : running ? "amber" : "muted"}>
          {done ? "完了" : running ? "進行中" : "未着手"}
        </Badge>
        <span className="text-[11.5px]" style={{ color: T.textMuted }}>
          {running && prog ? `${prog.done} / ${prog.total} タスク` : `全 ${total} タスク`}
        </span>
        <span className="flex-1" />
        <span className="text-xs font-bold" style={{ color: T.accentHover }}>
          {done ? "別の担当でもう一周" : running ? "続きから" : "この案件を見る"}
        </span>
      </span>
    </button>
  );
}

export default function DevLabCatalogView({ projects, templates, submissions, onOpenProject, onOpenTemplate }) {
  const [role, setRole] = useState("all");
  const [level, setLevel] = useState("all");
  const [method, setMethod] = useState("all");
  const [lang, setLang] = useState("all");
  const [labLevel, setLabLevel] = useState("all");

  // 合格した提出だけを案件ごとに引く（進捗の表示に使う）
  const passedByProject = useMemo(() => {
    const map = new Map();
    (submissions || []).forEach(s => {
      if (s.passed !== true) return;
      const set = map.get(s.projectId) || new Set();
      set.add(s.stepId);
      map.set(s.projectId, set);
    });
    return map;
  }, [submissions]);

  const sorted = useMemo(() => sortDevLabProjects(projects), [projects]);
  const resume = useMemo(() => sorted.find(p => p.myStatus === "in_progress") || null, [sorted]);
  const resumeProg = useMemo(
    () => (resume ? progressOf(resume, passedByProject) : null),
    [resume, passedByProject],
  );

  function matchProject(p, f) {
    if (f.level !== "all" && (p.level || "beginner") !== f.level) return false;
    if (f.method !== "all") {
      if (!hasRoleSetup(p)) return false;   // 進め方を持たない案件は、進め方で絞ったら出さない
      if (methodOf(p) !== f.method) return false;
    }
    if (f.role !== "all") {
      const want = ROLE_FILTERS.find(x => x.v === f.role);
      const slots = hasRoleSetup(p) ? roleSlotsFor(p) : [];
      if (!slots.some(s => want.match.includes(s.roleSlotId) && !s.premium)) return false;
    }
    return true;
  }
  const filtered = sorted.filter(p => matchProject(p, { role, level, method }));
  const countProjects = (kind, v) => sorted.filter(p => matchProject(p, { role, level, method, [kind]: v })).length;

  function matchLab(t, f) {
    if (f.lang !== "all" && t.stack !== f.lang) return false;
    if (f.level !== "all" && (t.level || "beginner") !== f.level) return false;
    return true;
  }
  const labs = (templates || []).filter(t => matchLab(t, { lang, level: labLevel }));
  const countLabs = (kind, v) => (templates || []).filter(t => matchLab(t, { lang, level: labLevel, [kind]: v })).length;
  // 言語の選択肢は、実際にあるテンプレートから作る（無い言語のボタンを出さない）
  const langs = useMemo(() => {
    const seen = [...new Set((templates || []).map(t => t.stack).filter(Boolean))];
    return [{ v: "all", nm: "すべて" }, ...seen.map(v => ({ v, nm: devLabWorkspaceStackLabel(v) }))];
  }, [templates]);

  return (
    <div>
      {resume && resumeProg && (
        <div className="mb-4">
          <ResumeCard project={resume} prog={resumeProg} onOpen={onOpenProject} />
        </div>
      )}

      {projects.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <FilterRow label="やること">
              <Chips list={ROLE_FILTERS} value={role} onChange={setRole} countOf={v => countProjects("role", v)} />
            </FilterRow>
            <FilterRow label="レベル">
              <Chips list={LEVELS} value={level} onChange={setLevel} countOf={v => countProjects("level", v)} />
            </FilterRow>
            <FilterRow label="進め方">
              <Chips list={METHODS} value={method} onChange={setMethod} countOf={v => countProjects("method", v)} />
            </FilterRow>
          </div>

          <p className="mt-3 text-xs" style={{ color: T.textMuted }}>
            <b style={{ color: T.textPrimary }}>{filtered.length}</b> 件の案件
            {filtered.length < sorted.length && `（全 ${sorted.length} 件から絞り込み）`}
          </p>

          <div className="mt-2 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(p => (
              <ProjectCard
                key={p.id} project={p}
                prog={p.myStatus === "in_progress" ? progressOf(p, passedByProject) : null}
                onOpen={onOpenProject}
              />
            ))}
          </div>

          {!filtered.length && (
            <Card className="mt-2 p-6 text-center">
              <p className="text-sm" style={{ color: T.textMuted }}>この条件に合う案件がありません。条件を減らしてください。</p>
              <Btn kind="ghost" size="sm" className="mt-2"
                onClick={() => { setRole("all"); setLevel("all"); setMethod("all"); }}>条件をすべて外す</Btn>
            </Card>
          )}
        </>
      )}

      {(templates || []).length > 0 && (
        <div className="mt-7 rounded-2xl border p-4 sm:p-5" style={{ borderColor: T.border, background: T.bgBase }}>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h4 className="text-[15px] font-bold" style={{ color: T.textPrimary }}>まずコードを書いて練習したい人へ</h4>
            <span className="text-xs" style={{ color: T.textSecondary }}>
              言語を選んで、その場で書いて動かせます。案件のような提出・レビューはありません
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <FilterRow label="言語">
              <Chips list={langs} value={lang} onChange={setLang} countOf={v => countLabs("lang", v)} />
            </FilterRow>
            <FilterRow label="レベル">
              <Chips list={LAB_LEVELS} value={labLevel} onChange={setLabLevel} countOf={v => countLabs("level", v)} />
            </FilterRow>
          </div>

          <p className="mt-3 text-xs" style={{ color: T.textMuted }}>
            <b style={{ color: T.textPrimary }}>{labs.length}</b> 件
            {labs.length < templates.length && `（全 ${templates.length} 件から絞り込み）`}
          </p>

          <div className="mt-2 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {labs.map(t => (
              <button
                key={t.id} type="button" onClick={() => onOpenTemplate(t.id)}
                className="rounded-xl border p-3 text-left transition hover:shadow-sm"
                style={{ borderColor: T.border, background: T.bgSurface }}
              >
                <span className="block text-[13.5px] font-bold" style={{ color: T.textPrimary }}>{t.title}</span>
                {t.description && (
                  <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed" style={{ color: T.textSecondary }}>
                    {t.description}
                  </span>
                )}
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="muted">{devLabWorkspaceStackLabel(t.stack)}</Badge>
                  <Badge tone="muted">{devLabLevelLabel(t.level)}</Badge>
                </span>
              </button>
            ))}
          </div>

          {!labs.length && (
            <p className="mt-2 rounded-xl border border-dashed p-5 text-center text-xs"
              style={{ borderColor: T.border, color: T.textMuted }}>
              この言語・レベルの練習はまだありません。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
