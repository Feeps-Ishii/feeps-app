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
  BookOpen, ChevronRight, Copy, Download, Eye, FileText, Folder, FolderPlus, Globe, HardDrive, HelpCircle, Link2, Lock,
  MoreHorizontal, Pencil, Plus, Rows3, Trash2, Upload, UserPlus, Users, X,
} from "lucide-react";
import { getActiveCourseId, setActiveCourseId, setLibraryTarget, takeLibraryTarget } from "../../utils/common/courseContext.js";

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
/* 見え方の印（2026-09-30）。どの画面でも同じ4種類の言葉と色にそろえる。
   講師・管理者はいつでも見られるので、印は「受講生・企業担当にどう見えるか」だけで決める */
const VIS = {
  all: { tone: "green", label: "受講生に見える", icon: Eye },
  client: { tone: "cyan", label: "企業担当にも見える", icon: Users },
  group: { tone: "cyan", label: "チームだけ", icon: Users },
  staff: { tone: "amber", label: "講師・運営だけ", icon: Lock },
};
const VIS_ORDER = ["all", "client", "group", "staff"];
function visKey(acl) {
  const r = acl?.roles || {};
  if (r.trainee && acl?.scope === "groups") return "group";
  if (r.client) return "client";
  if (r.trainee) return "all";
  return "staff";
}
// ショートカットは、コース側の指定と行き先の指定の狭い方
function nodeVisKey(n) {
  const own = visKey(n?.acl);
  if (n?.type !== "shortcut" || !n?.targetAcl) return own;
  const target = visKey(n.targetAcl);
  return VIS_ORDER.indexOf(target) > VIS_ORDER.indexOf(own) ? target : own;
}
function VisBadge({ k }) {
  const v = VIS[k] || VIS.staff;
  const Icon = v.icon;
  return <Badge tone={v.tone}><span className="inline-flex items-center gap-1"><Icon size={11} />{v.label}</span></Badge>;
}
function spaceLabel(spaceId, courses) {
  if (spaceId === "shared") return "共有（全社）";
  if (spaceId === "ops") return "運営だけ";
  if (spaceId === PERSONAL || String(spaceId).startsWith("user#")) return "マイフォルダ";
  const id = String(spaceId).replace(/^course#/, "");
  return courses.find(c => c.courseId === id)?.name || "コース";
}

/* scope：チームのページに埋め込むとき（2026-10-01）。{ courseId, nodeId } のフォルダから上へは行けず、
   コースの切り替え・左の一覧・見出しは出さない。ファイル管理の画面としては今までどおり全部を選べる */
export default function LibraryView({ role, go, scope = null }) {
  const staff = role === "admin" || role === "instructor";
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  /* 見え方の印・説明・変更は講師・管理者だけ（2026-10-01）。受講生・企業担当には見えるものしか出ないので印は要らない。
     マイフォルダは本人だけなので出さない */
  const isPersonalSpace = spaceId === PERSONAL || String(spaceId).startsWith("user#");
  const showVis = staff && !isPersonalSpace;
  /* 受講生・企業担当が共有（全社）を開くのは、コースのショートカット経由だけ。
     via はそのコースの置き場、anchor はショートカット先（そこより上は見せない） */
  const [via, setVia] = useState("");
  const [anchorId, setAnchorId] = useState(ROOT);
  const [side, setSide] = useState({ course: null, shared: null, ops: null });
  const [links, setLinks] = useState(null);      // 共有フォルダを使っているコース（講師・管理者）
  const [useFolder, setUseFolder] = useState(null); // { node, mode: "link"|"copy" }
  const [overview, setOverview] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);   // コース内のグループ（講師・管理者）
  const [quotaHelp, setQuotaHelp] = useState(false);
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
    if (scope?.courseId && scope?.nodeId) {
      setCourseId(scope.courseId);
      setSpaceId(`course#${scope.courseId}`);
      setAnchorId(scope.nodeId);
      setPath([scope.nodeId]);
      return undefined;
    }
    let alive = true;
    // 受講生だけ所属コース。企業担当は /courses 側で自社分に絞られる（既存画面と同じ）
    const pick = role === "trainee" ? "/me/courses" : "/courses";
    // カリキュラムのフォルダのカードから来たときは、そのフォルダを開く
    const target = takeLibraryTarget(false);
    apiGet(pick)
      .then(list => {
        if (!alive) return;
        const arr = (Array.isArray(list) ? list : []).filter(c => c?.courseId);
        setCourses(arr);
        const preferred = target?.courseId || getActiveCourseId();
        const first = arr.some(c => c.courseId === preferred) ? preferred : (arr[0]?.courseId || "");
        setCourseId(first);
        if (target) setLibraryTarget({});   // 使ったら消す（次に研修資料を開いたときに同じ場所へ飛ばない）
        if (first) {
          setSpaceId(`course#${first}`);
          setPath(target?.courseId === first ? [ROOT, target.nodeId] : [ROOT]);
          if (target?.courseId === first) pendingTargetRef.current = target.nodeId;
        } else setSpaceId(staff ? "shared" : "");
      })
      .catch(() => { if (alive) { setCourses([]); setSpaceId(staff ? "shared" : ""); } });
    return () => { alive = false; };
  }, [role, scope?.courseId, scope?.nodeId]);

  const pendingTargetRef = useRef("");
  const viaQuery = via ? `&via=${encodeURIComponent(via)}` : "";
  const load = useCallback(async () => {
    if (!spaceId) { setLoading(false); return; }
    setLoading(true); setErr("");
    try {
      const r = await apiGet(`/library?spaceId=${encodeURIComponent(spaceId)}${via ? `&via=${encodeURIComponent(via)}` : ""}`);
      setData(r);
    } catch (e) {
      setData(null);
      setErr(e?.errorMessage || e?.message || "教材フォルダを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [spaceId, via]);

  useEffect(() => { load(); }, [load]);

  /* 左の一覧用。選んでいるコースの置き場と、講師・管理者は共有（全社）・運営だけも読む */
  const loadSide = useCallback(async () => {
    if (scope) return;   // チームのページでは左の一覧を出さない
    const get = sid => apiGet(`/library?spaceId=${encodeURIComponent(sid)}`).catch(() => null);
    const [course, shared, ops] = await Promise.all([
      courseId ? get(`course#${courseId}`) : Promise.resolve(null),
      staff ? get("shared") : Promise.resolve(null),
      staff ? get("ops") : Promise.resolve(null),
    ]);
    setSide({ course, shared, ops });
    if (staff) {
      apiGet("/library/links?spaceId=shared").then(r => setLinks(r?.links || {})).catch(() => setLinks(null));
    }
  }, [courseId, staff, !!scope]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadSide(); }, [loadSide]);

  /* どこかを開く。space を変えるときは path も一緒に決める（読み込み後に先頭へ戻さない） */
  function openAt(nextSpace, nextPath, nextVia = "", nextAnchor = ROOT) {
    setOverview(false);
    setVia(nextVia);
    setAnchorId(nextAnchor);
    setSpaceId(nextSpace);
    setPath(nextPath && nextPath.length ? nextPath : [nextAnchor]);
    setMenuFor(null); setNotice(""); setActionErr("");
  }
  function chainTo(nodes, id) {
    const byIdLocal = new Map((nodes || []).map(n => [n.nodeId, n]));
    const out = [];
    let cur = byIdLocal.get(id);
    const guard = new Set();
    while (cur && !guard.has(cur.nodeId)) { guard.add(cur.nodeId); out.unshift(cur.nodeId); cur = cur.parentId ? byIdLocal.get(cur.parentId) : null; }
    return out.length ? out : [ROOT];
  }
  // ショートカットを開く。講師・管理者は共有（全社）の本来の場所で、受講生・企業担当はショートカット先から
  function openShortcut(n) {
    if (!n?.targetNodeId) return;
    if (staff) openAt("shared", chainTo(side.shared?.nodes, n.targetNodeId));
    else openAt("shared", [n.targetNodeId], `course#${courseId}`, n.targetNodeId);
  }
  function selectCourse(id) {
    setCourseId(id);
    setActiveCourseId(id);
    openAt(`course#${id}`, [ROOT]);
  }

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

  useEffect(() => {
    const id = pendingTargetRef.current;
    if (!id || !data || spaceId !== `course#${courseId}`) return;
    const n = (data.nodes || []).find(x => x.nodeId === id);
    pendingTargetRef.current = "";
    if (n?.type === "shortcut") openShortcut(n);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // 見えないフォルダに居座らないよう、辿れるところまで戻す
  const safePath = useMemo(() => {
    const out = [];
    for (const id of path) {
      if (!byId.has(id)) break;
      out.push(id);
    }
    return out.length ? out : [anchorId];
  }, [path, byId, anchorId]);

  const currentId = safePath[safePath.length - 1];
  const current = byId.get(currentId);
  const children = useMemo(() => {
    const list = (data?.nodes || []).filter(n => n.parentId === currentId);
    list.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "ja") : a.type === "folder" ? -1 : 1));
    return list;
  }, [data, currentId]);

  const courseName = useMemo(() => {
    if (!spaceId.startsWith("course#")) return spaceId === "shared" ? "全コース" : "";
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
      await load();
      loadSide();
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
      setNotice(`「${name.trim()}」を作りました。${showVis ? "公開範囲は入れ先から引き継ぎます。" : ""}`);
    });
  }

  function rename(n) {
    const name = window.prompt("新しい名前", n.name);
    if (!name || !name.trim() || name.trim() === n.name) return;
    run("rename", () => apiPut(`/library/nodes/${encodeURIComponent(n.nodeId)}`, { spaceId, name: name.trim() }));
  }

  function remove(n) {
    const kids = (data?.nodes || []).filter(x => x.parentId === n.nodeId).length;
    const warn = n.type === "shortcut"
      ? `「${n.targetName || n.name}」のショートカットを外します（共有（全社）の元のフォルダは消えません）。よろしいですか。`
      : n.type === "folder" && kids
        ? `「${n.name}」を中身ごと消します。よろしいですか。`
        : `「${n.name}」を消します。よろしいですか。`;
    if (!window.confirm(warn)) return;
    run("delete", async () => {
      await apiDelete(`/library/nodes/${encodeURIComponent(n.nodeId)}?spaceId=${encodeURIComponent(spaceId)}`);
      setNotice(n.type === "shortcut" ? `「${n.targetName || n.name}」の紐づけを外しました。元のフォルダはそのままです。` : `「${n.name}」を消しました。`);
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
      load();
      return;
    }
    try {
      const r = await apiGet(
        `/library/download?spaceId=${encodeURIComponent(spaceId)}&nodeId=${encodeURIComponent(n.nodeId)}${viaQuery}`
        + (forceDownload ? "&mode=download" : "")
      );
      window.open(r.url, "_blank", "noopener");
      load();
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
        + (done ? "各コースのファイル管理とテスト作成から使えます。" : "")
      );
    });
  }

  function placeFolderInCourses(node, mode, courseIds) {
    setUseFolder(null);
    run("use", async () => {
      const r = await apiPost(mode === "copy" ? "/library/copy-folder" : "/library/link-folder", { spaceId: "shared", nodeId: node.nodeId, courseIds });
      const done = (r.placed || []).length, already = (r.skipped || []).length;
      setNotice(
        (done ? `「${node.name}」を${done}件のコースで使えるようにしました（${mode === "copy" ? "コピー" : "ショートカット"}）。` : "")
        + (already ? `${already}件はすでに${mode === "copy" ? "コピー済み" : "紐づいて"}いました。` : "")
      );
    });
  }
  function unlinkShortcut(courseIdOfLink, shortcutNodeId, name) {
    if (!window.confirm(`「${name}」の紐づけを外します（元のフォルダは消えません）。よろしいですか。`)) return;
    run("unlink", async () => {
      await apiDelete(`/library/nodes/${encodeURIComponent(shortcutNodeId)}?spaceId=${encodeURIComponent(`course#${courseIdOfLink}`)}`);
      setNotice(`「${name}」の紐づけを外しました。`);
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

  // 左の一覧：選んでいるコース（受講生はマイフォルダも）、講師・管理者は共有（全社）と運営だけ
  const topOf = d => (d?.nodes || [])
    .filter(n => n.parentId === ROOT && (n.type === "folder" || n.type === "shortcut"))
    .sort((a, b) => (a.type === b.type ? (a.targetName || a.name).localeCompare(b.targetName || b.name, "ja") : a.type === "folder" ? -1 : 1));
  const firstLevel = safePath[1] || "";
  function renderTree() {
    const head = (key, Icon, color, label, onClick, active) => (
      <button key={key} type="button" onClick={onClick}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 pb-1 pt-2.5 text-left text-xs font-bold"
        style={{ color: active ? T.textPrimary : T.textMuted }}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white" style={{ background: color }}><Icon size={12} /></span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
    );
    // 件数はその置き場の中身で数える（共有・運営だけのフォルダをコースのデータで数えない）
    const row = (n, active, onClick, spaceNodes) => {
      const shortcut = n.type === "shortcut";
      const count = shortcut ? n.targetFiles : (spaceNodes || []).filter(x => x.parentId === n.nodeId).length;
      return (
        <button key={n.nodeId} type="button" onClick={onClick}
          className="grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px]"
          style={active ? { background: T.accentSubtle, color: T.textPrimary, fontWeight: 700, boxShadow: `inset 3px 0 0 ${T.accent}` } : { color: T.textSecondary }}>
          {shortcut ? <Link2 size={14} style={{ color: T.accent }} /> : <Folder size={14} style={{ color: T.textMuted }} />}
          <span className="truncate">{shortcut ? (n.targetName || n.name) : n.name}</span>
          <span className="text-[11px] tabular-nums" style={{ color: T.textMuted }}>{Number.isFinite(count) ? count : ""}</span>
        </button>
      );
    };
    const courseSpace = courseId ? `course#${courseId}` : "";
    const sharedTop = topOf(side.shared), opsTop = topOf(side.ops), courseTop = topOf(side.course);
    const inShortcut = spaceId === "shared" && (via || !staff);
    return (
      <Card className="p-2 xl:sticky xl:top-4">
        {courseId && head("course", BookOpen, "#339CFF", spaceLabel(courseSpace, courses), () => openAt(courseSpace, [ROOT]), spaceId === courseSpace)}
        {courseTop.map(n => row(n,
          n.type === "shortcut" ? (spaceId === "shared" && (inShortcut ? anchorId === n.targetNodeId : safePath.includes(n.targetNodeId))) : (spaceId === courseSpace && firstLevel === n.nodeId),
          () => (n.type === "shortcut" ? openShortcut(n) : openAt(courseSpace, [ROOT, n.nodeId])), side.course?.nodes))}
        {courseId && side.course && !courseTop.length && <div className="px-3 py-1 text-xs" style={{ color: T.textMuted }}>フォルダはまだありません</div>}
        <div className="mx-2.5 my-1.5 h-px" style={{ background: T.border }} />
        {head("me", Folder, "#9B79EC", "マイフォルダ", () => openAt(PERSONAL, [ROOT]), spaceId === PERSONAL)}
        {staff && <>
          <div className="mx-2.5 my-1.5 h-px" style={{ background: T.border }} />
          {head("shared", Globe, "#3AB9B1", "共有（全社）", () => openAt("shared", [ROOT]), spaceId === "shared" && !firstLevel)}
          {sharedTop.map(n => row(n, spaceId === "shared" && firstLevel === n.nodeId, () => openAt("shared", [ROOT, n.nodeId]), side.shared?.nodes))}
          <div className="mx-2.5 my-1.5 h-px" style={{ background: T.border }} />
          {head("ops", Lock, "#B07C2E", "運営だけ", () => openAt("ops", [ROOT]), spaceId === "ops" && !firstLevel)}
          {opsTop.map(n => row(n, spaceId === "ops" && firstLevel === n.nodeId, () => openAt("ops", [ROOT, n.nodeId]), side.ops?.nodes))}
        </>}
      </Card>
    );
  }

  const currentLinks = spaceId === "shared" && staff && current && current.nodeId !== ROOT && current.type === "folder" ? (links?.[current.nodeId] || { shortcuts: [], copies: [] }) : null;
  const courseNameOf = id => courses.find(c => c.courseId === id)?.name || id;

  return (
    <div onClick={() => setMenuFor(null)}>
      {!scope && <SectionHead
        title="ファイル管理"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {staff && (
              <Btn kind={overview ? "primary" : "ghost"} icon={overview ? Folder : Rows3} onClick={() => setOverview(v => !v)}>
                {overview ? "フォルダに戻る" : "見え方の一覧"}
              </Btn>
            )}
            {role === "admin" && (
              <Btn kind="ghost" icon={HardDrive} onClick={openUsage}>容量と費用</Btn>
            )}
          </div>
        }
      />}
      {!scope && !overview && courses.length > 0 && <CourseBar courses={courses} value={courseId} onChange={selectCourse} />}

      {overview ? (
        <VisibilityOverview
          courses={courses}
          initialCourseId={courseId}
          onOpen={(sid, nodeId, node) => {
            if (node?.type === "shortcut") { if (sid !== `course#${courseId}`) setCourseId(sid.replace(/^course#/, "")); openShortcut(node); }
            else openAt(sid, [ROOT, nodeId]);
          }}
        />
      ) : (
      <div className={scope ? "grid items-start gap-4" : "grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"}>
      {!scope && renderTree()}
      <div className="min-w-0">
      {err && <PrismErrorRetryCard message={err} onRetry={() => load()} />}
      {loading && !data && <Card className="mb-4 p-4"><SkeletonRows rows={5} /></Card>}
      {data && <>

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
            {staff && courseIdOfSpace && (
              <Btn size="sm" kind="ghost" icon={Users} onClick={() => (go ? go("teams") : setGroupsOpen(true))}>チーム</Btn>
            )}
            {mayWriteHere && <Btn size="sm" icon={Plus} onClick={newFolder} disabled={!!busy}>フォルダ</Btn>}
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
            {mayWriteHere && (
              <Btn kind="primary" size="sm" icon={Upload} onClick={pickFiles} disabled={!!busy}>
                {busy === "upload" ? "アップロード中…" : "アップロード"}
              </Btn>
            )}
            <input ref={fileInput} type="file" multiple hidden onChange={onFiles} />
          </div>
        </div>

        {/* このフォルダの公開範囲 */}
        {current && showVis && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>
            <VisBadge k={visKey(current.acl)} />
            <span>{describeAcl(current.acl, courseName, groupNames)}</span>
            {current.canWrite && (
              <Btn kind="ghost" size="sm" onClick={() => setAclTarget(current)}>見える人を変える</Btn>
            )}
          </div>
        )}

        {/* 共有（全社）のフォルダ：コースで使う・使っているコース（講師・管理者） */}
        {currentLinks && (
          <div className="grid gap-2 px-4 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold" style={{ color: T.textSecondary }}>このフォルダを使っているコース</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Btn size="sm" icon={Link2} onClick={() => setUseFolder({ node: current, mode: "link" })}>コースに紐づける</Btn>
                <Btn size="sm" kind="ghost" icon={Copy} onClick={() => setUseFolder({ node: current, mode: "copy" })}>コースへコピー</Btn>
              </div>
            </div>
            {!currentLinks.shortcuts.length && !currentLinks.copies.length && (
              <div className="text-xs" style={{ color: T.textMuted }}>まだどのコースにも紐づいていません</div>
            )}
            {currentLinks.shortcuts.map(l => (
              <div key={l.nodeId} className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ border: `1px solid ${T.border}` }}>
                <Link2 size={14} style={{ color: T.accent }} />
                <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: T.textPrimary }}>{courseNameOf(l.courseId)}</span>
                <Badge tone="cyan">ショートカット</Badge>
                <Btn size="sm" kind="ghost" onClick={() => unlinkShortcut(l.courseId, l.nodeId, current.name)}>外す</Btn>
              </div>
            ))}
            {currentLinks.copies.map(l => (
              <div key={l.nodeId} className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ border: `1px solid ${T.border}` }}>
                <Copy size={14} style={{ color: T.textMuted }} />
                <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: T.textPrimary }}>{courseNameOf(l.courseId)}</span>
                <Badge tone="muted">コピー{l.createdAt ? ` ${fmtDate(l.createdAt)}` : ""}</Badge>
                <Btn size="sm" kind="ghost" onClick={() => { setCourseId(l.courseId); openAt(`course#${l.courseId}`, [ROOT, l.nodeId]); }}>開く</Btn>
              </div>
            ))}
          </div>
        )}

        {/* マイフォルダの残り（2026-10-01）。上限はマイフォルダだけ。研修の資料には上限なし */}
        {(data?.quotaBytes > 0 || data?.transfer?.capBytes > 0) && (() => {
          const MB = 1024 * 1024;
          const left = Math.max(0, (data.quotaBytes || 0) - (data.usedBytes || 0));
          const dlLeft = Math.max(0, (data.transfer?.capBytes || 0) - (data.transfer?.usedBytes || 0));
          const meter = (label, used, cap, warnAt) => (
            <div>
              <div className="flex items-center justify-between text-xs" style={{ color: T.textSecondary }}>
                <span>{label}</span>
                <span className="tabular-nums">残り {fmtSize(Math.max(0, cap - used))} <span style={{ color: T.textMuted }}>/ {fmtSize(cap)}</span></span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: T.border }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / cap) * 100).toFixed(1)}%`, background: used > cap * warnAt ? T.warning : T.accent }} />
              </div>
            </div>
          );
          return (
            <div className="grid gap-2.5 px-4 py-3" style={{ background: T.bgBase, borderTop: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: T.textSecondary }}>マイフォルダの残り</span>
                <button type="button" onClick={() => setQuotaHelp(v => !v)} aria-expanded={quotaHelp} aria-label="使うとどれくらい減るか" className="rounded-full" style={{ color: quotaHelp ? T.accent : T.textMuted }}><HelpCircle size={15} /></button>
              </div>
              {data.quotaBytes > 0 && meter("保存できる量", data.usedBytes || 0, data.quotaBytes, 0.9)}
              {data.transfer?.capBytes > 0 && meter("今月のダウンロード", data.transfer.usedBytes || 0, data.transfer.capBytes, 0.8)}
              {quotaHelp && (
                <div className="grid gap-1 rounded-xl px-3 py-2.5 text-xs leading-5" style={{ background: T.bgSurface, border: `1px solid ${T.border}`, color: T.textSecondary }}>
                  <div><b style={{ color: T.textPrimary }}>保存</b>：置いたファイルの大きさだけ減ります。残りで PDF（5MB）なら約 {Math.floor(left / (5 * MB)).toLocaleString()} 個、動画（100MB）なら約 {Math.floor(left / (100 * MB)).toLocaleString()} 本。消せば戻ります。</div>
                  <div><b style={{ color: T.textPrimary }}>ダウンロード</b>：開くたび・落とすたびに、そのファイルの大きさだけ減ります。残りで PDF（5MB）なら約 {Math.floor(dlLeft / (5 * MB)).toLocaleString()} 回。毎月1日に戻ります。</div>
                  <div style={{ color: T.textMuted }}>コースや共有（全社）の研修資料には上限はありません。</div>
                </div>
              )}
            </div>
          );
        })()}

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
                  {(showVis ? ["名前", "公開範囲", "サイズ", "更新", ""] : ["名前", "サイズ", "更新", ""]).map((h, i) => (
                    <th key={h || i} className={"px-4 py-2 text-left text-[11px] font-bold" + (h === "サイズ" ? " text-right" : "")}
                      style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {children.map(n => {
                  const shortcut = n.type === "shortcut";
                  const size = n.type === "folder" ? folderSize(n.nodeId) : shortcut ? 0 : n.sizeBytes;
                  const kids = shortcut ? (n.targetFiles || 0) : (data?.nodes || []).filter(x => x.parentId === n.nodeId).length;
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
                          onClick={() => (shortcut ? openShortcut(n) : n.type === "folder" ? setPath([...safePath, n.nodeId]) : openFile(n))}
                          className="flex min-w-0 items-center gap-2.5 text-left text-sm font-semibold"
                          style={{ color: T.textPrimary }}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                            style={{ background: n.type === "file" ? T.bgBase : T.accentSubtle, color: n.type === "file" ? T.textMuted : T.accentHover }}>
                            {shortcut ? <Link2 size={13} /> : n.type === "folder" ? <Folder size={13} /> : <FileText size={13} />}
                          </span>
                          <span className="truncate">{shortcut ? (n.targetName || n.name) : n.name}</span>
                          {n.type !== "file" && <span className="text-[11px] font-normal" style={{ color: T.textMuted }}>{kids}件</span>}
                          {shortcut && <span className="text-[11px] font-semibold" style={{ color: T.accentHover }}>共有（全社）</span>}
                        </button>
                      </td>
                      {showVis && <td className="px-4 py-2.5">
                        <VisBadge k={nodeVisKey(n)} />
                        {n.acl?.scope === "groups" && (
                          <span className="ml-1.5 text-[11px]" style={{ color: T.accentHover }}>
                            {(n.acl.groups || []).map(g => groupNames[g]).filter(Boolean).join("・") || "グループ指定"}
                          </span>
                        )}
                        {n.acl?.traineeWrite && n.acl?.roles?.trainee && (
                          <span className="ml-1.5 text-[11px]" style={{ color: T.textMuted }}>受講生も置ける</span>
                        )}
                      </td>}
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
      </>}
      </div>
      </div>
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
            {n.type === "file" && spaceId === "shared" && staff && (
              <MenuItem icon={FolderPlus} label="コースに置く" onClick={() => { setMenuFor(null); setLinkFile(n); }} />
            )}
            {n.type === "folder" && spaceId === "shared" && staff && (
              <>
                <MenuItem icon={Link2} label="コースに紐づける" onClick={() => { setMenuFor(null); setUseFolder({ node: n, mode: "link" }); }} />
                <MenuItem icon={Copy} label="コースへコピー" onClick={() => { setMenuFor(null); setUseFolder({ node: n, mode: "copy" }); }} />
              </>
            )}
            {n.canWrite ? (
              <>
                {showVis && <MenuItem icon={Users} label="見える人を変える" onClick={() => { setMenuFor(null); setAclTarget(n); }} />}
                {n.type !== "shortcut" && <MenuItem icon={Pencil} label="名前を変える" onClick={() => { setMenuFor(null); rename(n); }} />}
                <MenuItem icon={n.type === "shortcut" ? X : Trash2} label={n.type === "shortcut" ? "紐づけを外す" : "削除"} danger onClick={() => { setMenuFor(null); remove(n); }} />
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

      {groupsOpen && courseIdOfSpace && (
        <GroupsModal
          courseId={courseIdOfSpace}
          courseName={courseName}
          onClose={() => { setGroupsOpen(false); loadGroups(); }}
        />
      )}

      {useFolder && (
        <UseFolderModal
          node={useFolder.node}
          initialMode={useFolder.mode}
          courses={courses}
          linked={links?.[useFolder.node.nodeId]}
          onClose={() => setUseFolder(null)}
          onSubmit={(mode, ids) => placeFolderInCourses(useFolder.node, mode, ids)}
        />
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

/* コース内のグループ（2026-10-01）。講師・管理者が名前を付けて作り、コースの受講生を割り当てる。
   フォルダの「見える人を変える」でグループを選ぶと、そのグループの人だけが見られる（チーム開発演習など） */
function GroupsModal({ courseId, courseName, onClose }) {
  const [groups, setGroups] = useState(null);
  const [trainees, setTrainees] = useState([]);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([
        apiGet(`/library/groups?courseId=${encodeURIComponent(courseId)}`),
        apiGet(`/courses/${encodeURIComponent(courseId)}/trainees`).catch(() => []),
      ]);
      const list = Array.isArray(g?.groups) ? g.groups : [];
      setGroups(list);
      setTrainees(Array.isArray(t) ? t : []);
      return list;
    } catch (e) { setMsg(e?.errorMessage || e?.message || "グループを読み込めませんでした。"); setGroups([]); return []; }
  }, [courseId]);
  useEffect(() => { load(); }, [load]);
  const current = (groups || []).find(g => g.groupId === selected);
  useEffect(() => { setDraft(current?.members || []); }, [current?.groupId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(fn, done) {
    setBusy(true); setMsg("");
    try { await fn(); const list = await load(); done?.(list); }
    catch (e) { setMsg(e?.errorMessage || e?.message || "うまくいきませんでした。"); }
    finally { setBusy(false); }
  }
  const nameOf = id => { const t = trainees.find(x => x.userId === id); return t?.name || t?.email || "（コース外の人）"; };
  return (
    <Modal title={`${courseName || "このコース"}のグループ`} onClose={onClose}>
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="グループ名（例：Aグループ）" aria-label="グループ名"
            className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
          <Btn icon={Plus} disabled={!name.trim() || busy} onClick={() => act(
            () => apiPost("/library/groups", { courseId, name: name.trim() }).then(g => { setSelected(g.groupId); }),
            () => setName(""))}>作る</Btn>
        </div>
        {groups === null ? <SkeletonRows rows={3} /> : (
          <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className="grid content-start gap-1">
              {groups.length === 0 && <div className="text-xs" style={{ color: T.textMuted }}>グループはまだありません</div>}
              {groups.map(g => (
                <button key={g.groupId} type="button" onClick={() => setSelected(g.groupId)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"
                  style={selected === g.groupId ? { background: T.accentSubtle, color: T.textPrimary, fontWeight: 700 } : { color: T.textSecondary }}>
                  <Users size={14} /><span className="min-w-0 flex-1 truncate">{g.name}</span>
                  <span className="text-[11px] tabular-nums" style={{ color: T.textMuted }}>{g.memberCount}人</span>
                </button>
              ))}
            </div>
            <div className="min-w-0">
              {!current ? <div className="rounded-xl px-3 py-6 text-center text-xs" style={{ color: T.textMuted, border: `1px dashed ${T.border}` }}>左でグループを選ぶと、メンバーを割り当てられます</div> : (
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold" style={{ color: T.textPrimary }}><UserPlus size={15} />{current.name} のメンバー</div>
                  <div className="grid max-h-72 gap-1 overflow-y-auto">
                    {trainees.length === 0 && <div className="text-xs" style={{ color: T.textMuted }}>このコースの受講生がいません</div>}
                    {trainees.map(t => (
                      <label key={t.userId} className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm" style={{ border: `1px solid ${T.border}` }}>
                        <input type="checkbox" checked={draft.includes(t.userId)} style={{ accentColor: T.accent }}
                          onChange={() => setDraft(d => d.includes(t.userId) ? d.filter(x => x !== t.userId) : [...d, t.userId])} />
                        <span className="min-w-0 flex-1 truncate" style={{ color: T.textPrimary }}>{t.name || t.email || t.userId}</span>
                      </label>
                    ))}
                    {draft.filter(id => !trainees.some(t => t.userId === id)).map(id => (
                      <div key={id} className="px-3 text-xs" style={{ color: T.textMuted }}>{nameOf(id)}（講師など）</div>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <Btn kind="ghost" size="sm" icon={Trash2} disabled={busy} onClick={() => {
                      if (!window.confirm(`「${current.name}」を消します。このグループだけに見せていたフォルダは、誰にも見えなくなります（管理者は見られます）。`)) return;
                      act(() => apiDelete(`/library/groups/${encodeURIComponent(current.groupId)}?courseId=${encodeURIComponent(courseId)}`), () => setSelected(""));
                    }}>グループを消す</Btn>
                    <Btn size="sm" disabled={busy} onClick={() => act(
                      () => apiPut(`/library/groups/${encodeURIComponent(current.groupId)}`, { courseId, members: draft }),
                      () => setMsg(`「${current.name}」のメンバーを保存しました。`))}>メンバーを保存</Btn>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {msg && <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: T.bgBase, color: T.textSecondary }}>{msg}</div>}
        <div className="text-xs" style={{ color: T.textMuted }}>フォルダの「見える人を変える」でグループを選ぶと、そのグループの人だけが見られます。</div>
      </div>
    </Modal>
  );
}

/* コースの選択（2026-09-30）。どの役割でも研修資料の上の同じ場所に置く。1コースなら名前だけ */
function CourseBar({ courses, value, onChange, withAll = false }) {
  if (courses.length <= 1 && !withAll) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-2.5" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
        <span className="text-xs font-bold" style={{ color: T.textMuted }}>コース</span>
        <span className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: T.textPrimary }}><BookOpen size={15} style={{ color: T.accent }} />{courses[0]?.name || "—"}</span>
      </div>
    );
  }
  const items = withAll ? [{ courseId: "all", name: "すべて" }, ...courses] : courses;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
      <span className="pl-1 text-xs font-bold" style={{ color: T.textMuted }}>コース</span>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="コース">
        {items.map(c => {
          const on = c.courseId === value;
          return (
            <button key={c.courseId} type="button" role="tab" aria-selected={on} onClick={() => onChange(c.courseId)}
              className="rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors"
              style={on ? { background: T.accentSubtle, color: T.accentHover, boxShadow: `inset 0 0 0 1px ${T.accent}40` } : { color: T.textSecondary }}>
              {c.name || c.courseId}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 共有（全社）のフォルダをコースで使う。ショートカットは元を直せば全コースに反映、コピーはコース用に複製 */
function UseFolderModal({ node, initialMode, courses, linked, onClose, onSubmit }) {
  const [mode, setMode] = useState(initialMode || "link");
  const [picked, setPicked] = useState([]);
  const already = new Set(((mode === "copy" ? linked?.copies : linked?.shortcuts) || []).map(x => x.courseId));
  const toggle = id => setPicked(xs => xs.includes(id) ? xs.filter(x => x !== id) : [...xs, id]);
  const options = [
    ["link", Link2, "ショートカット", "元を1か所で直せば、全コースに反映"],
    ["copy", Copy, "コピー", "コース用に複製。元とは別に直せる"],
  ];
  return (
    <Modal title={`「${node.name}」をコースで使う`} onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn icon={mode === "copy" ? Copy : Link2} disabled={!picked.length} onClick={() => onSubmit(mode, picked)}>{mode === "copy" ? "コピーする" : "紐づける"}</Btn></>}>
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map(([key, Icon, label, desc]) => (
            <button key={key} type="button" onClick={() => setMode(key)} className="grid gap-1 rounded-xl px-3.5 py-3 text-left"
              style={{ border: `1.5px solid ${mode === key ? T.accent : T.border}`, background: mode === key ? T.accentSubtle : T.bgSurface }}>
              <span className="flex items-center gap-2 text-sm font-bold" style={{ color: T.textPrimary }}><Icon size={15} />{label}</span>
              <span className="text-xs" style={{ color: T.textSecondary }}>{desc}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <div className="text-xs font-bold" style={{ color: T.textSecondary }}>使うコース</div>
          {courses.length === 0 && <div className="text-xs" style={{ color: T.textMuted }}>選べるコースがありません</div>}
          {courses.map(c => {
            const done = already.has(c.courseId);
            return (
              <label key={c.courseId} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm" style={{ border: `1px solid ${T.border}`, opacity: done ? 0.6 : 1 }}>
                <input type="checkbox" disabled={done} checked={done || picked.includes(c.courseId)} onChange={() => toggle(c.courseId)} style={{ accentColor: T.accent }} />
                <span className="min-w-0 flex-1 truncate" style={{ color: T.textPrimary }}>{c.name || c.courseId}</span>
                {done && <Badge tone="cyan">{mode === "copy" ? "コピー済み" : "紐づけ済み"}</Badge>}
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

/* 見え方の一覧（2026-09-30）。役割×フォルダの表にせず、見え方ごとにまとめる。
   講師・管理者はいつでも見られるので列にしない。選んだコースで使うフォルダと、運営だけのフォルダを出す */
function VisibilityOverview({ courses, initialCourseId, onOpen }) {
  const [courseSel, setCourseSel] = useState(initialCourseId || "all");
  const [filter, setFilter] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setRows(null); setError("");
    const targets = courseSel === "all" ? courses.map(c => c.courseId) : [courseSel];
    Promise.all([
      ...targets.map(id => apiGet(`/library?spaceId=${encodeURIComponent(`course#${id}`)}`).then(d => ({ sid: `course#${id}`, place: courses.find(c => c.courseId === id)?.name || id, d }))),
      apiGet("/library?spaceId=ops").then(d => ({ sid: "ops", place: "運営だけ", d })),
    ]).then(list => {
      if (!alive) return;
      const out = [];
      list.forEach(({ sid, place, d }) => (d?.nodes || []).forEach(n => {
        if (n.nodeId === ROOT || (n.type !== "folder" && n.type !== "shortcut")) return;
        const parent = (d.nodes || []).find(x => x.nodeId === n.parentId);
        out.push({
          key: `${sid}:${n.nodeId}`, sid, node: n, place: n.type === "shortcut" ? `${place} ・ 共有（全社）` : place,
          name: n.type === "shortcut" ? (n.targetName || n.name) : (parent && parent.nodeId !== ROOT ? `${parent.name} ／ ${n.name}` : n.name),
          k: nodeVisKey(n), shortcut: n.type === "shortcut",
        });
      }));
      setRows(out);
    }).catch(e => { if (alive) setError(e?.errorMessage || e?.message || "一覧を読み込めませんでした。"); });
    return () => { alive = false; };
  }, [courseSel, courses]);

  const counts = {};
  (rows || []).forEach(r => { counts[r.k] = (counts[r.k] || 0) + 1; });
  return (
    <div>
      <CourseBar courses={courses} value={courseSel} onChange={setCourseSel} withAll />
      {error && <PrismErrorRetryCard message={error} onRetry={() => setCourseSel(v => v)} />}
      {!rows && !error && <Card className="p-4"><SkeletonRows rows={5} /></Card>}
      {rows && <>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[["", "すべて", rows.length], ...VIS_ORDER.map(k => [k, null, counts[k] || 0])].map(([k, label, n]) => (
            <button key={`vis-${k || "*"}`} type="button" onClick={() => setFilter(k)}
              className="inline-flex items-center gap-2 rounded-full py-1 pl-3 pr-2 text-sm font-bold"
              style={{ background: T.bgSurface, border: `1px solid ${filter === k ? T.textPrimary : T.border}`, boxShadow: filter === k ? `inset 0 0 0 1px ${T.textPrimary}` : undefined, color: T.textPrimary }}>
              {label || <VisBadge k={k} />}<span className="text-xs tabular-nums" style={{ color: T.textMuted }}>{n}</span>
            </button>
          ))}
        </div>
        <div className="mb-3 flex items-center gap-1.5 text-xs" style={{ color: T.textMuted }}><Lock size={12} />講師・管理者は、すべてのフォルダを見られます</div>
        <div className="grid gap-3">
          {VIS_ORDER.filter(k => !filter || filter === k).map(k => {
            const list = rows.filter(r => r.k === k);
            if (!list.length) return null;
            return (
              <Card key={k} className="overflow-hidden p-0">
                <div className="flex items-center gap-2 px-4 pb-2 pt-3"><VisBadge k={k} /><span className="text-xs font-bold tabular-nums" style={{ color: T.textMuted }}>{list.length}</span></div>
                {list.map(r => (
                  <div key={r.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5" style={{ borderTop: `1px solid ${T.border}` }}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: T.bgBase, color: r.shortcut ? T.accent : T.textMuted }}>{r.shortcut ? <Link2 size={15} /> : <Folder size={15} />}</span>
                    <div className="min-w-0"><div className="truncate text-sm font-bold" style={{ color: T.textPrimary }}>{r.name}</div><div className="truncate text-xs" style={{ color: T.textMuted }}>{r.place}</div></div>
                    <Btn size="sm" kind="ghost" onClick={() => onOpen(r.sid, r.node.nodeId, r.node)}>開く</Btn>
                  </div>
                ))}
              </Card>
            );
          })}
          {!rows.length && <Card className="p-4 text-sm" style={{ color: T.textMuted }}>フォルダはまだありません</Card>}
        </div>
      </>}
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
      desc={`「${node.name}」を、選んだコースのフォルダに置きます`}
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
