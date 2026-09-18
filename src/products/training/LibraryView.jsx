import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../../api.js";
import {
  T, NOVA, Z, Card, Btn, Badge, Field, Modal, EmptyState, SectionHead, SkeletonRows, PrismErrorRetryCard,
} from "../../components/common";
import MaterialViewer from "./MaterialViewer.jsx";
import {
  addMaterialToCurriculumTarget, normalizeCurriculumSections, sessionsFromSections,
} from "./TrainingComponents.jsx";
import {
  ChevronRight, Download, FileText, Folder, FolderPlus, HardDrive, MoreHorizontal, Pencil, Plus,
  Trash2, Upload, Users,
} from "lucide-react";

/* 研修資料をフォルダで整理する（2026-09-18 打合せ）。
   これまではコース直下のフラットな一覧だったので、章立てや演習ごとにまとめられなかった。

   置き場は「コース教材」と「共有ライブラリ」の2つ（個人フォルダはPhase 2）。
   公開範囲は**フォルダごと**に決め、中のものは指定が無ければ引き継ぐ。
   **見える範囲は親より広くできない**（漏れを仕組みで防ぐ）。判定はBackendが正で、
   ここでの表示は画面用の写しにすぎない。 */

const ROOT = "root";

const ROLE_KEYS = [
  ["trainee", "受講生"],
  ["instructor", "講師"],
  ["client", "企業担当"],
];
const PERSONAL = "me";

function fmtSize(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(0) + " KB";
  return b ? b + " B" : "—";
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`;
}
/** 誰が見られるかを一文で返す。**設定した結果を言葉で見せる**のが肝 */
function describeAcl(acl, courseName, groupNames) {
  if (!acl) return "";
  const who = ROLE_KEYS.filter(([k]) => acl.roles?.[k]).map(([, label]) => label);
  if (!who.length) return "管理者だけが見られます。";
  let where;
  if (acl.scope === "org") where = "全コース";
  else if (acl.scope === "groups") {
    const names = (acl.groups || []).map(g => groupNames?.[g]).filter(Boolean);
    where = names.length
      ? `${courseName || "このコース"}の${names.join("・")}`
      : `${courseName || "このコース"}の指定グループ`;
  } else where = courseName || "このコース";
  return `${where}の${who.join("・")}が見られます。管理者はいつでも見られます。` +
    (acl.roles?.trainee ? (acl.traineeWrite ? "受講生もここに置けます。" : "受講生は見るだけです。") : "");
}
function aclChip(acl) {
  const r = acl?.roles || {};
  if (r.trainee) return { tone: "green", label: "受講生まで" };
  if (r.client) return { tone: "cyan", label: "企業担当まで" };
  if (r.instructor) return { tone: "amber", label: "講師のみ" };
  return { tone: "red", label: "管理者のみ" };
}

export default function LibraryView({ role }) {
  const [courses, setCourses] = useState([]);
  const [spaceId, setSpaceId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [path, setPath] = useState([ROOT]);
  const [menuFor, setMenuFor] = useState(null);
  const [aclTarget, setAclTarget] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [viewing, setViewing] = useState(null);
  const [groups, setGroups] = useState([]);
  const [usage, setUsage] = useState(null);      // 管理者だけが開ける「容量と費用」
  const [usageOpen, setUsageOpen] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    let alive = true;
    // 受講生だけ所属コース。企業担当は /courses 側で自社分に絞られる（既存画面と同じ）
    const pick = role === "trainee" ? "/me/courses" : "/courses";
    apiGet(pick)
      .then(list => {
        if (!alive) return;
        const arr = Array.isArray(list) ? list : [];
        setCourses(arr);
        setSpaceId(prev => prev || (arr[0]?.courseId ? `course#${arr[0].courseId}` : "shared"));
      })
      .catch(() => { if (alive) { setCourses([]); setSpaceId(prev => prev || "shared"); } });
    return () => { alive = false; };
  }, [role]);

  const load = useCallback(async (keepPath) => {
    if (!spaceId) return;
    setLoading(true); setErr("");
    try {
      const r = await apiGet(`/library?spaceId=${encodeURIComponent(spaceId)}`);
      setData(r);
      if (!keepPath) setPath([ROOT]);
    } catch (e) {
      setData(null);
      setErr(e?.message || "教材フォルダを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => { load(false); }, [load]);

  // グループはコース単位。公開範囲でチームを選ぶときに要る
  const courseIdOfSpace = spaceId.startsWith("course#") ? spaceId.slice("course#".length) : "";
  const loadGroups = useCallback(async () => {
    if (!courseIdOfSpace) { setGroups([]); return; }
    try {
      const r = await apiGet(`/library/groups?courseId=${encodeURIComponent(courseIdOfSpace)}`);
      setGroups(Array.isArray(r?.groups) ? r.groups : []);
    } catch { setGroups([]); }
  }, [courseIdOfSpace]);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  const groupNames = useMemo(
    () => Object.fromEntries(groups.map(g => [g.groupId, g.name])),
    [groups]
  );

  /* アップロードと同時にカリキュラムの単元へ紐づけられるようにする（2026-09-18）。
     フォルダに入れるだけだと、カリキュラム画面から選び直す手間が残るため。
     紐づけ先は MaterialsTable の materialId を見ているので、コース教材のときだけ。 */
  const [curriculum, setCurriculum] = useState([]);
  const [linkTarget, setLinkTarget] = useState("");
  useEffect(() => {
    setLinkTarget("");
    if (!courseIdOfSpace || role === "trainee" || role === "client") { setCurriculum([]); return; }
    let alive = true;
    apiGet(`/courses/${encodeURIComponent(courseIdOfSpace)}/curriculum`)
      .then(d => { if (alive) setCurriculum(normalizeCurriculumSections(d)); })
      .catch(() => { if (alive) setCurriculum([]); });
    return () => { alive = false; };
  }, [courseIdOfSpace, role]);

  const linkOptions = useMemo(() => {
    const out = [];
    (curriculum || []).forEach(section => {
      out.push({ value: `section:${section.id}`, label: `大項目：${section.title || "名称未設定"}` });
      (section.chapters || []).forEach(chapter => {
        (chapter.lessons || []).forEach(lesson => {
          out.push({
            value: `lesson:${lesson.id}`,
            label: `　${chapter.title || "章"} / ${lesson.title || "名称未設定"}`,
          });
        });
      });
    });
    return out;
  }, [curriculum]);

  const byId = useMemo(() => {
    const m = new Map();
    (data?.nodes || []).forEach(n => m.set(n.nodeId, n));
    return m;
  }, [data]);

  // 見えないフォルダに居座らないよう、辿れるところまで戻す
  const safePath = useMemo(() => {
    const out = [];
    for (const id of path) {
      if (!byId.has(id)) break;
      out.push(id);
    }
    return out.length ? out : [ROOT];
  }, [path, byId]);

  const currentId = safePath[safePath.length - 1];
  const current = byId.get(currentId);
  const children = useMemo(() => {
    const list = (data?.nodes || []).filter(n => n.parentId === currentId);
    list.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "ja") : a.type === "folder" ? -1 : 1));
    return list;
  }, [data, currentId]);

  const courseName = useMemo(() => {
    if (!spaceId.startsWith("course#")) return "";
    const id = spaceId.slice("course#".length);
    return courses.find(c => c.courseId === id)?.name || "";
  }, [spaceId, courses]);

  const folderSize = useCallback((nodeId) => {
    let total = 0;
    const walk = (id) => {
      const n = byId.get(id);
      if (!n) return;
      if (n.type === "file") { total += Number(n.sizeBytes) || 0; return; }
      (data?.nodes || []).filter(x => x.parentId === id).forEach(x => walk(x.nodeId));
    };
    walk(nodeId);
    return total;
  }, [byId, data]);

  const mayWriteHere = !!current?.canWrite;

  /* 操作の失敗は、読み込みの失敗と分けて出す。
     「データを取得できませんでした」と書かれると、権限で断られたのか読めなかったのか分からない */
  async function run(label, fn) {
    setBusy(label); setNotice(""); setActionErr("");
    try {
      await fn();
      await load(true);
    } catch (e) {
      setActionErr(e?.errorMessage || e?.message || "うまくいきませんでした。");
    } finally {
      setBusy("");
    }
  }

  function newFolder() {
    const name = window.prompt("フォルダの名前", "新しいフォルダ");
    if (!name || !name.trim()) return;
    run("folder", async () => {
      await apiPost("/library/folders", { spaceId, parentId: currentId, name: name.trim() });
      setNotice(`「${name.trim()}」を作りました。公開範囲は入れ先から引き継ぎます。`);
    });
  }

  function rename(n) {
    const name = window.prompt("新しい名前", n.name);
    if (!name || !name.trim() || name.trim() === n.name) return;
    run("rename", () => apiPut(`/library/nodes/${encodeURIComponent(n.nodeId)}`, { spaceId, name: name.trim() }));
  }

  function remove(n) {
    const kids = (data?.nodes || []).filter(x => x.parentId === n.nodeId).length;
    const warn = n.type === "folder" && kids
      ? `「${n.name}」を中身ごと消します。よろしいですか。`
      : `「${n.name}」を消します。よろしいですか。`;
    if (!window.confirm(warn)) return;
    run("delete", async () => {
      await apiDelete(`/library/nodes/${encodeURIComponent(n.nodeId)}?spaceId=${encodeURIComponent(spaceId)}`);
      setNotice(`「${n.name}」を消しました。`);
    });
  }

  function move(dragId, targetId) {
    if (!dragId || dragId === targetId) return;
    run("move", () => apiPut(`/library/nodes/${encodeURIComponent(dragId)}`, { spaceId, parentId: targetId }));
  }

  /* PDFは**これまでの教材ビューアをそのまま使う**（手書き・ノートが続けて使えるように）。
     共有ライブラリのファイルや、PDF以外は署名付きURLで開く。 */
  function isPdf(n) { return /\.pdf$/i.test(n.name || "") || n.contentType === "application/pdf"; }

  async function openFile(n, forceDownload) {
    setActionErr("");
    if (!forceDownload && courseIdOfSpace && n.materialId && isPdf(n)) {
      setViewing(n);
      // 開いたぶんは通信量に入るので、メーターを追いつかせる
      load(true);
      return;
    }
    try {
      const r = await apiGet(
        `/library/download?spaceId=${encodeURIComponent(spaceId)}&nodeId=${encodeURIComponent(n.nodeId)}`
        + (forceDownload ? "&mode=download" : "")
      );
      window.open(r.url, "_blank", "noopener");
      load(true);
    } catch (e) {
      setActionErr(e?.errorMessage || e?.message || "ファイルを開けませんでした。");
    }
  }

  /* アップロードは3手順。URLをもらう → S3へPUT → 登録を確定。
     途中でやめた分の行を残さないよう、確定は最後に1回だけ呼ぶ */
  function pickFiles() { fileInput.current?.click(); }
  async function onFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    for (const f of files) {
      // eslint-disable-next-line no-await-in-loop
      await run("upload", async () => {
        const got = await apiPost("/library/upload-url", {
          spaceId, parentId: currentId, filename: f.name,
          contentType: f.type || "application/octet-stream", sizeBytes: f.size,
        });
        const put = await fetch(got.uploadUrl, {
          method: "PUT",
          headers: { "content-type": got.contentType },
          body: f,
        });
        if (!put.ok) throw new Error(`アップロードに失敗しました（${put.status}）。`);
        await apiPost("/library/files", {
          spaceId, parentId: currentId, nodeId: got.nodeId, s3key: got.s3key,
          materialId: got.materialId, name: f.name, sizeBytes: f.size,
          contentType: got.contentType,
        });
        // カリキュラムへの紐づけは、失敗してもアップロード自体は成功として扱う
        let linked = "";
        if (linkTarget && got.materialId && courseIdOfSpace) {
          try {
            const next = addMaterialToCurriculumTarget(curriculum, linkTarget, got.materialId);
            await apiPut(`/courses/${encodeURIComponent(courseIdOfSpace)}/curriculum`, {
              sections: next, sessions: sessionsFromSections(next),
            });
            setCurriculum(next);
            linked = "カリキュラムにも紐づけました。";
          } catch (e) {
            linked = "ただし、カリキュラムへの紐づけはできませんでした（カリキュラム画面から選べます）。";
          }
        }
        setNotice(`「${f.name}」を追加しました。${linked}`);
      });
    }
  }

  /* 共有ライブラリのファイルを、必要なコースへ置く（2026-09-18）。
     全コース共通で1回だけ上げて、そこから配る使い方にするため。
     実体はコピーせず、同じものを指すだけ。 */
  const [linkFile, setLinkFile] = useState(null);
  function placeToCourses(node, courseIds) {
    setLinkFile(null);
    run("link", async () => {
      const r = await apiPost("/library/link-to-course", { spaceId, nodeId: node.nodeId, courseIds });
      const done = (r.placed || []).length, already = (r.skipped || []).length;
      setNotice(
        (done ? `「${node.name}」を${done}件のコースに置きました。` : "")
        + (already ? `${already}件はすでに置かれていました。` : "")
        + (done ? "各コースの研修資料とテスト作成から使えます。" : "")
      );
    });
  }

  async function openUsage() {
    setUsageOpen(true);
    setUsage(null);
    try {
      setUsage(await apiGet("/library/usage"));
    } catch (e) {
      setUsage({ error: e?.errorMessage || e?.message || "集計を取得できませんでした。" });
    }
  }

  if (loading && !data) {
    return <div><SectionHead title="研修資料" desc="読み込んでいます" /><SkeletonRows rows={6} /></div>;
  }

  return (
    <div onClick={() => setMenuFor(null)}>
      <SectionHead
        title="研修資料"
        desc="コース教材と全社の共有ライブラリを、フォルダで整理します。公開範囲はフォルダごとに決められます。"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {role === "admin" && (
              <Btn kind="ghost" icon={HardDrive} onClick={openUsage}>容量と費用</Btn>
            )}
            <select
              value={spaceId}
              onChange={e => setSpaceId(e.target.value)}
              aria-label="置き場"
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }}
            >
              {courses.map(c => <option key={c.courseId} value={`course#${c.courseId}`}>{c.name || c.courseId}</option>)}
              <option value="shared">共有ライブラリ（全社）</option>
              {role === "trainee" && <option value={PERSONAL}>マイフォルダ（自分だけ）</option>}
            </select>
          </div>
        }
      />

      {err && <PrismErrorRetryCard message={err} onRetry={() => load(true)} />}

      <Card className="mb-4">
        {/* パンくずと操作 */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm" aria-label="いまの場所">
            {safePath.map((id, i) => {
              const n = byId.get(id);
              const last = i === safePath.length - 1;
              return (
                <React.Fragment key={id}>
                  {i > 0 && <ChevronRight size={13} style={{ color: T.textMuted }} />}
                  <button
                    type="button"
                    disabled={last}
                    onClick={() => setPath(safePath.slice(0, i + 1))}
                    className="rounded-lg px-2 py-1 font-semibold disabled:cursor-default"
                    style={{ color: last ? T.textPrimary : T.accent }}
                  >
                    {n?.name || "—"}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
          <div className="ml-auto flex flex-wrap gap-2">
            {/* 「既存の資料を取り込む」ボタンは置かない（2026-09-18）。
                コースを初めて開いたときに自動で取り込まれるので、押す場面が無い。
                取りこぼしたときの手動実行は POST /library/migrate が残してある */}
            <Btn size="sm" icon={Plus} onClick={newFolder} disabled={!mayWriteHere || !!busy}
              title={mayWriteHere ? "" : "このフォルダに作る権限がありません。"}>フォルダ</Btn>
            {mayWriteHere && linkOptions.length > 0 && (
              <select
                value={linkTarget}
                onChange={e => setLinkTarget(e.target.value)}
                aria-label="アップロードしたものをカリキュラムへ紐づける"
                title="アップロードと同時に、カリキュラムの単元へ紐づけます"
                className="max-w-56 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                style={{ border: `1px solid ${linkTarget ? T.accent : T.border}`, color: linkTarget ? T.accentHover : T.textMuted, background: T.bgSurface }}
              >
                <option value="">カリキュラムに紐づけない</option>
                {linkOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            <Btn kind="primary" size="sm" icon={Upload} onClick={pickFiles} disabled={!mayWriteHere || !!busy}
              title={mayWriteHere ? "" : "このフォルダに置く権限がありません。"}>
              {busy === "upload" ? "アップロード中…" : "アップロード"}
            </Btn>
            <input ref={fileInput} type="file" multiple hidden onChange={onFiles} />
          </div>
        </div>

        {/* このフォルダの公開範囲 */}
        {current && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>
            <Users size={13} />
            <span>{describeAcl(current.acl, courseName, groupNames)}</span>
            {current.canWrite && (
              <Btn kind="ghost" size="sm" onClick={() => setAclTarget(current)}>公開範囲を変える</Btn>
            )}
          </div>
        )}

        {/* 今月のダウンロード。**上限に達すると開けなくなる**ので、先に見せておく */}
        {data?.transfer?.capBytes > 0 && (
          <div className="px-4 py-2.5" style={{ background: T.bgBase, borderTop: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between text-xs" style={{ color: T.textSecondary }}>
              <span>今月のダウンロード</span>
              <span className="tabular-nums">{fmtSize(data.transfer.usedBytes)} / {fmtSize(data.transfer.capBytes)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: T.border }}>
              <div className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (data.transfer.usedBytes / data.transfer.capBytes) * 100).toFixed(1)}%`,
                  background: data.transfer.usedBytes > data.transfer.capBytes * 0.8 ? T.warning : T.accent,
                }} />
            </div>
            <div className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
              資料の取り出しにも通信料がかかるため、月ごとの上限があります。
              上限に達すると、来月まで新しく開けません。
            </div>
          </div>
        )}

        {/* 個人フォルダの残り。**超えるアップロードは通らない**ので、先に見せておく */}
        {data?.quotaBytes > 0 && (
          <div className="px-4 py-2.5" style={{ background: T.bgBase }}>
            <div className="flex items-center justify-between text-xs" style={{ color: T.textSecondary }}>
              <span>マイフォルダの使用量</span>
              <span className="tabular-nums">{fmtSize(data.usedBytes)} / {fmtSize(data.quotaBytes)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: T.border }}>
              <div className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (data.usedBytes / data.quotaBytes) * 100).toFixed(1)}%`,
                  background: data.usedBytes > data.quotaBytes * 0.9 ? T.danger : T.accent,
                }} />
            </div>
            <div className="mt-1 text-[11px]" style={{ color: T.textMuted }}>
              上限まで {fmtSize(Math.max(0, data.quotaBytes - data.usedBytes))}。超えるアップロードは通りません。
            </div>
          </div>
        )}

        {notice && (
          <div className="px-4 py-2 text-xs font-semibold" style={{ background: T.successSubtle, color: T.success }}>{notice}</div>
        )}
        {actionErr && (
          <div className="px-4 py-2 text-xs font-semibold" style={{ background: T.dangerSubtle, color: T.danger }}>{actionErr}</div>
        )}

        {/* 中身 */}
        {children.length === 0 ? (
          <EmptyState
            title="まだ何もありません"
            desc={mayWriteHere ? "「フォルダ」で章立てを作るか、「アップロード」で資料を置いてください。" : "このフォルダに置かれた資料はまだありません。"}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
                  {["名前", "公開範囲", "サイズ", "更新", ""].map((h, i) => (
                    <th key={h || i} className={"px-4 py-2 text-left text-[11px] font-bold" + (i === 2 ? " text-right" : "")}
                      style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {children.map(n => {
                  const chip = aclChip(n.acl);
                  const size = n.type === "folder" ? folderSize(n.nodeId) : n.sizeBytes;
                  const kids = (data?.nodes || []).filter(x => x.parentId === n.nodeId).length;
                  return (
                    <tr
                      key={n.nodeId}
                      draggable={n.canWrite}
                      onDragStart={e => e.dataTransfer.setData("text/plain", n.nodeId)}
                      onDragOver={n.type === "folder" ? (e => e.preventDefault()) : undefined}
                      onDrop={n.type === "folder" ? (e => { e.preventDefault(); move(e.dataTransfer.getData("text/plain"), n.nodeId); }) : undefined}
                      style={{ borderBottom: `1px solid ${T.border}` }}
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => (n.type === "folder" ? setPath([...safePath, n.nodeId]) : openFile(n))}
                          className="flex min-w-0 items-center gap-2.5 text-left text-sm font-semibold"
                          style={{ color: T.textPrimary }}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                            style={{ background: n.type === "folder" ? T.accentSubtle : T.bgBase, color: n.type === "folder" ? T.accentHover : T.textMuted }}>
                            {n.type === "folder" ? <Folder size={13} /> : <FileText size={13} />}
                          </span>
                          <span className="truncate">{n.name}</span>
                          {n.type === "folder" && <span className="text-[11px] font-normal" style={{ color: T.textMuted }}>{kids}件</span>}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={chip.tone}>{chip.label}</Badge>
                        {n.acl?.scope === "groups" && (
                          <span className="ml-1.5 text-[11px]" style={{ color: T.accentHover }}>
                            {(n.acl.groups || []).map(g => groupNames[g]).filter(Boolean).join("・") || "グループ指定"}
                          </span>
                        )}
                        {n.acl?.scope === "org" && <span className="ml-1.5 text-[11px]" style={{ color: T.textMuted }}>全コース</span>}
                        {n.acl?.traineeWrite && n.acl?.roles?.trainee && (
                          <span className="ml-1.5 text-[11px]" style={{ color: T.textMuted }}>受講生も置ける</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums" style={{ color: T.textSecondary }}>{fmtSize(size)}</td>
                      <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: T.textMuted }}>{fmtDate(n.updatedAt)}</td>
                      <td className="px-2 py-2.5 text-right">
                        <button
                          type="button"
                          aria-label={`${n.name} の操作`}
                          aria-haspopup="menu"
                          aria-expanded={menuFor?.nodeId === n.nodeId}
                          onClick={e => {
                            e.stopPropagation();
                            if (menuFor?.nodeId === n.nodeId) { setMenuFor(null); return; }
                            // 表の overflow に切られないよう、画面に対する位置で開く
                            setMenuFor({ nodeId: n.nodeId, rect: e.currentTarget.getBoundingClientRect() });
                          }}
                          className="rounded-lg p-1.5"
                          style={{ color: T.textMuted }}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data?.truncated && (
        <Card className="mb-4 p-3 text-xs" style={{ color: T.warning, background: T.warningSubtle }}>
          このコースのフォルダが多くなりすぎています。整理してください。
        </Card>
      )}

      {/* 行のメニュー。**表の外に出す**（overflow-x-auto の中だと下が切れる） */}
      {menuFor && (() => {
        const n = byId.get(menuFor.nodeId);
        if (!n) return null;
        return (
          <RowMenu anchor={menuFor.rect} onClose={() => setMenuFor(null)}>
            {n.type === "file" && (
              <MenuItem icon={Download} label="ダウンロード" onClick={() => { setMenuFor(null); openFile(n, true); }} />
            )}
            {n.type === "file" && spaceId === "shared" && role !== "trainee" && role !== "client" && (
              <MenuItem icon={FolderPlus} label="コースに置く" onClick={() => { setMenuFor(null); setLinkFile(n); }} />
            )}
            {n.canWrite ? (
              <>
                <MenuItem icon={Users} label="公開範囲を変える" onClick={() => { setMenuFor(null); setAclTarget(n); }} />
                <MenuItem icon={Pencil} label="名前を変える" onClick={() => { setMenuFor(null); rename(n); }} />
                <MenuItem icon={Trash2} label="削除" danger onClick={() => { setMenuFor(null); remove(n); }} />
              </>
            ) : (
              <div className="px-2.5 py-2 text-[11px]" style={{ color: T.textMuted }}>
                {n.type === "folder" ? "このフォルダは見るだけです。" : "この資料は見るだけです。"}
              </div>
            )}
          </RowMenu>
        );
      })()}

      {linkFile && (
        <PlaceToCoursesModal
          node={linkFile}
          courses={courses}
          onClose={() => setLinkFile(null)}
          onPlace={ids => placeToCourses(linkFile, ids)}
        />
      )}

      {usageOpen && (
        <UsageModal data={usage} onClose={() => setUsageOpen(false)} />
      )}

      {viewing && (
        <MaterialViewer
          courseId={courseIdOfSpace}
          material={{ materialId: viewing.materialId, title: viewing.name, mode: "view" }}
          onClose={() => setViewing(null)}
          canAnnotate={role === "trainee"}
        />
      )}

      {aclTarget && (
        <AclModal
          node={aclTarget}
          courseName={courseName}
          isRoot={aclTarget.nodeId === ROOT}
          groups={groups}
          groupNames={groupNames}
          canUseGroups={!!courseIdOfSpace}
          onCreateGroup={async name => {
            const g = await apiPost("/library/groups", { courseId: courseIdOfSpace, name });
            await loadGroups();
            return g;
          }}
          onClose={() => setAclTarget(null)}
          onSave={acl => {
            const target = aclTarget;
            setAclTarget(null);
            run("acl", async () => {
              await apiPut(`/library/nodes/${encodeURIComponent(target.nodeId)}`, { spaceId, acl });
              setNotice(`「${target.name}」の公開範囲を変えました。`);
            });
          }}
        />
      )}
    </div>
  );
}

/* 共有ライブラリのファイルを、どのコースへ置くか選ぶ。
   **実体はコピーしない**ので、容量は増えない。それを画面でも言っておく。 */
function PlaceToCoursesModal({ node, courses, onClose, onPlace }) {
  const [picked, setPicked] = useState([]);
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  return (
    <Modal
      title="コースに置く"
      desc={`「${node.name}」を、選んだコースの研修資料に置きます`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Btn kind="ghost" onClick={onClose}>やめる</Btn>
          <Btn disabled={!picked.length} onClick={() => onPlace(picked)}>置く（{picked.length}件）</Btn>
        </div>
      }
    >
      {courses.length === 0 ? (
        <p className="text-sm" style={{ color: T.textMuted }}>置けるコースがありません。</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {courses.map(c => {
            const on = picked.includes(c.courseId);
            return (
              <label key={c.courseId} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5"
                style={{ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accentSubtle : "transparent" }}>
                <input type="checkbox" checked={on} onChange={() => toggle(c.courseId)} />
                <span className="text-sm font-semibold" style={{ color: on ? T.accentHover : T.textPrimary }}>
                  {c.name || c.courseId}
                </span>
              </label>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: T.textMuted }}>
        ファイルは<b>コピーされません</b>。同じものを各コースから見られるようにするだけなので、容量は増えません。
        置いたあとは、そのコースのカリキュラムへの紐づけやテスト作成からも使えます。
      </p>
    </Modal>
  );
}

/* 容量と費用（管理者）。**実測値で出す。**
   最初に見せた試算ページは仮の数字だったが、ここは本番のデータそのもの。
   誰が何GB落としたかは出さない。運用に要るのは「上限に近い人が何人か」まで。 */
function UsageModal({ data, onClose }) {
  const yen = v => "¥" + Math.round(Number(v) || 0).toLocaleString("ja-JP");
  const gb = b => (Number(b || 0) / 1024 / 1024 / 1024).toFixed(2) + " GB";
  return (
    <Modal
      title="容量と費用"
      desc={data?.period ? `${data.period} の実測値です` : "集計しています"}
      size="lg"
      onClose={onClose}
      footer={<div className="flex justify-end"><Btn kind="ghost" onClick={onClose}>閉じる</Btn></div>}
    >
      {!data && <SkeletonRows rows={5} />}
      {data?.error && (
        <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: T.dangerSubtle, color: T.danger }}>
          {data.error}
        </div>
      )}
      {data && !data.error && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { l: "保管の合計", v: gb(data.totalBytes), s: yen(data.cost.storageYen) + " / 月" },
              { l: "今月の通信量", v: gb(data.transfer.bytes), s: data.transfer.billableGb > 0 ? yen(data.cost.transferYen) + " / 月" : "無料枠の中" },
              { l: "月額の目安", v: yen(data.cost.totalYen), s: "保管＋通信" },
            ].map(x => (
              <div key={x.l} className="rounded-xl p-3" style={{ background: T.bgBase }}>
                <div className="text-[11px] font-bold" style={{ color: T.textMuted }}>{x.l}</div>
                <div className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: T.textPrimary }}>{x.v}</div>
                <div className="text-[11px]" style={{ color: T.textSecondary }}>{x.s}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
            style={{ background: data.transfer.billableGb > 0 ? T.warningSubtle : T.successSubtle, color: data.transfer.billableGb > 0 ? T.warning : T.success }}>
            {data.transfer.billableGb > 0
              ? `今月の通信量が無料枠（${data.transfer.freeGb} GB）を ${data.transfer.billableGb.toFixed(1)} GB 超えています。`
              : `今月の通信量は無料枠（${data.transfer.freeGb} GB）の中に収まっています。通信費はかかっていません。`}
            {data.transfer.overCap > 0 && ` 上限に達した人が ${data.transfer.overCap} 人います。`}
            {data.transfer.nearCap > 0 && ` 上限が近い人が ${data.transfer.nearCap} 人います。`}
          </div>

          <div className="mt-4 text-xs font-bold" style={{ color: T.textMuted }}>コース別の保管量</div>
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-[380px] border-collapse">
              <thead>
                <tr>
                  {["コース", "ファイル", "容量"].map((h, i) => (
                    <th key={h} className={"py-1.5 text-left text-[11px] font-bold" + (i ? " text-right" : "")}
                      style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.courses.map(c => (
                  <tr key={c.courseId} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td className="py-2 text-sm" style={{ color: T.textPrimary }}>{c.name}</td>
                    <td className="py-2 text-right text-xs tabular-nums" style={{ color: T.textMuted }}>{c.files}</td>
                    <td className="py-2 text-right text-xs font-semibold tabular-nums" style={{ color: T.textSecondary }}>{gb(c.bytes)}</td>
                  </tr>
                ))}
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td className="py-2 text-sm" style={{ color: T.textPrimary }}>共有ライブラリ</td>
                  <td className="py-2 text-right text-xs tabular-nums" style={{ color: T.textMuted }}>{data.shared.files}</td>
                  <td className="py-2 text-right text-xs font-semibold tabular-nums" style={{ color: T.textSecondary }}>{gb(data.shared.bytes)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-sm" style={{ color: T.textPrimary }}>
                    個人フォルダ<span className="ml-1.5 text-[11px]" style={{ color: T.textMuted }}>{data.personal.people}人が使用</span>
                  </td>
                  <td className="py-2 text-right text-xs tabular-nums" style={{ color: T.textMuted }}>{data.personal.files}</td>
                  <td className="py-2 text-right text-xs font-semibold tabular-nums" style={{ color: T.textSecondary }}>{gb(data.personal.bytes)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: T.textMuted }}>
            {data.cost.note} アプリ本体の配信・API・DB・AI生成の費用は入っていません。
            通信量は<b>URLを出した時点</b>で数えているため、実際に落とした量より多めに出ます。
            個人フォルダの中身は本人以外に見えません（ここでは容量だけを集計しています）。
          </p>
        </>
      )}
    </Modal>
  );
}

/* 行の「⋯」メニュー。**body直下に出す。**
   表の中に置くと `overflow-x-auto` に切られて、下の項目が読めなくなる。
   画面の下端に近いときは上へ開く。 */
function RowMenu({ anchor, onClose, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const { width, height } = el.getBoundingClientRect();
    const gap = 4;
    const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
    const below = anchor.bottom + gap;
    const top = below + height > window.innerHeight - 8
      ? Math.max(8, anchor.top - height - gap)
      : below;
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    // 開いたまま裏がスクロールすると位置がずれるので、動いたら閉じる
    const close = () => onClose();
    const onKey = e => { if (e.key === "Escape") onClose(); };
    // 本体の外（ヘッダーやレールなど）を押しても閉じるようにする。
    // 開いたその click で閉じないよう、次のフレームから見はじめる
    const id = requestAnimationFrame(() => document.addEventListener("click", close));
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onClick={e => e.stopPropagation()}
      className="fixed w-56 rounded-xl p-1.5 text-left"
      style={{
        left: pos.left, top: pos.top, zIndex: Z.modal,
        background: T.bgSurface, border: `1px solid ${T.border}`, boxShadow: NOVA.shadowMd,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold"
      style={{ color: danger ? T.danger : T.textPrimary }}
    >
      <Icon size={14} />{label}
    </button>
  );
}

/* 公開範囲は「どの範囲に」×「だれに」。**選んだ結果を必ず文章で出す**。
   グループ（チーム開発演習の班分けなど）は誰でも作れる。作った人はそこに入る。 */
function AclModal({ node, courseName, isRoot, groups, groupNames, canUseGroups, onCreateGroup, onClose, onSave }) {
  const inherited = !node.ownAcl;
  const [mode, setMode] = useState(inherited && !isRoot ? "inherit" : "own");
  const [groupErr, setGroupErr] = useState("");
  const [draft, setDraft] = useState(() => ({
    scope: ["org", "groups"].includes(node.acl?.scope) ? node.acl.scope : "course",
    groups: Array.isArray(node.acl?.groups) ? node.acl.groups : [],
    roles: {
      trainee: !!node.acl?.roles?.trainee,
      instructor: !!node.acl?.roles?.instructor,
      client: !!node.acl?.roles?.client,
    },
    traineeWrite: !!node.acl?.traineeWrite,
  }));

  async function addGroup() {
    const name = window.prompt("グループの名前", "チームA");
    if (!name || !name.trim()) return;
    setGroupErr("");
    try {
      const g = await onCreateGroup(name.trim());
      // **作ったグループは、そのまま選んでおく。** 選び直させない
      setDraft(d => ({ ...d, scope: "groups", groups: [...new Set([...d.groups, g.groupId])] }));
    } catch (e) {
      setGroupErr(e?.errorMessage || e?.message || "グループを作れませんでした。");
    }
  }

  const result = mode === "inherit" ? null : draft;
  return (
    <Modal
      title="公開範囲"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Btn kind="ghost" onClick={onClose}>やめる</Btn>
          <Btn
            onClick={() => onSave(result)}
            disabled={mode === "own" && draft.scope === "groups" && draft.groups.length === 0}
          >保存</Btn>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: T.textPrimary }}>
        {node.type === "folder" ? <Folder size={15} /> : <FileText size={15} />}{node.name}
      </div>

      {!isRoot && (
        <label className="mb-2 flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5"
          style={{ border: `1px solid ${mode === "inherit" ? T.accent : T.border}`, background: mode === "inherit" ? T.accentSubtle : "transparent" }}>
          <input type="radio" name="aclmode" checked={mode === "inherit"} onChange={() => setMode("inherit")} className="mt-1" />
          <span>
            <b className="block text-sm">親フォルダから引き継ぐ</b>
            <span className="text-xs" style={{ color: T.textMuted }}>入れ先を変えると、ここも一緒に変わります。</span>
          </span>
        </label>
      )}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5"
        style={{ border: `1px solid ${mode === "own" ? T.accent : T.border}`, background: mode === "own" ? T.accentSubtle : "transparent" }}>
        <input type="radio" name="aclmode" checked={mode === "own"} onChange={() => setMode("own")} className="mt-1" />
        <span>
          <b className="block text-sm">ここで決める</b>
          <span className="text-xs" style={{ color: T.textMuted }}>この{node.type === "folder" ? "フォルダ" : "ファイル"}専用の範囲にします。</span>
        </span>
      </label>

      {mode === "own" && (
        <div className="mt-3">
          <Field label="どの範囲に">
            <select
              value={draft.scope}
              onChange={e => setDraft(d => ({ ...d, scope: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}
            >
              <option value="course">{courseName || "このコース"}の中だけ</option>
              {canUseGroups && <option value="groups">コース内のグループだけ</option>}
              <option value="org">全コース共通</option>
            </select>
          </Field>

          {draft.scope === "groups" && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-bold" style={{ color: T.textMuted }}>どのグループに</div>
              <div className="flex flex-wrap gap-2">
                {groups.map(g => {
                  const on = draft.groups.includes(g.groupId);
                  return (
                    <label key={g.groupId} className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                      style={{ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accentSubtle : "transparent", color: on ? T.accentHover : T.textSecondary }}>
                      <input type="checkbox" checked={on}
                        onChange={e => setDraft(d => ({
                          ...d,
                          groups: e.target.checked ? [...d.groups, g.groupId] : d.groups.filter(x => x !== g.groupId),
                        }))} />
                      {g.name}
                      <span style={{ color: T.textMuted }}>{g.memberCount}人</span>
                    </label>
                  );
                })}
                <button type="button" onClick={addGroup}
                  className="rounded-full px-3 py-1.5 text-xs font-bold"
                  style={{ border: `1px dashed ${T.accent}`, color: T.accentHover }}>＋ 新しいグループ</button>
              </div>
              {groupErr && <div className="mt-1.5 text-[11px] font-semibold" style={{ color: T.danger }}>{groupErr}</div>}
              <div className="mt-1.5 text-[11px]" style={{ color: T.textMuted }}>
                グループは誰でも作れます。作った人はそのグループに入ります。
                {draft.groups.length === 0 && <b style={{ color: T.warning }}> 1つ以上選んでください。</b>}
              </div>
            </div>
          )}
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-bold" style={{ color: T.textMuted }}>だれに見せるか</div>
            <div className="flex flex-wrap gap-2">
              {ROLE_KEYS.map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ border: `1px solid ${draft.roles[k] ? T.accent : T.border}`, background: draft.roles[k] ? T.accentSubtle : "transparent", color: draft.roles[k] ? T.accentHover : T.textSecondary }}>
                  <input type="checkbox" checked={draft.roles[k]}
                    onChange={e => setDraft(d => ({ ...d, roles: { ...d.roles, [k]: e.target.checked } }))} />
                  {label}
                </label>
              ))}
              <span className="rounded-full px-3 py-1.5 text-xs" style={{ border: `1px dashed ${T.border}`, color: T.textMuted }}>管理者（いつでも）</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-bold" style={{ color: T.textMuted }}>受講生が置けるか</div>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ width: "fit-content", border: `1px solid ${draft.traineeWrite ? T.accent : T.border}`, background: draft.traineeWrite ? T.accentSubtle : "transparent", color: draft.traineeWrite ? T.accentHover : T.textSecondary }}>
              <input type="checkbox" checked={draft.traineeWrite}
                onChange={e => setDraft(d => ({ ...d, traineeWrite: e.target.checked }))} />
              受講生もここに置ける
            </label>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl px-3 py-2.5 text-xs" style={{ background: T.accentSubtle, color: T.accentHover }}>
        <b>結果：</b>
        {mode === "inherit"
          ? "親フォルダの範囲をそのまま使います。"
          : describeAcl(draft, courseName, groupNames)}
        <div className="mt-1" style={{ color: T.textMuted }}>
          親より広くはできません。親が狭い場合は、そちらに合わせて狭くなります。
        </div>
      </div>

    </Modal>
  );
}
