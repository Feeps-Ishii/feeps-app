import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { normalizeCurriculumSections } from "../../training/TrainingComponents.jsx";
import { AttachPicker, MsgBody, dayLabel, hm } from "../../training/TeamsView.jsx";
import { useTeamChat, MAX_CHAT_FILES, MAX_CHAT_TEXT } from "../../training/useTeamChat.js";
import { takeTeamChatFocus, useChatUnread } from "../../training/ChatNotifier.jsx";
import { fmtSize, uploadToFolder } from "../../training/DevReview.jsx";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, FileIcon, Modal } from "../parts/ui.jsx";

const TeamBoard = lazy(() => import("../../training/TeamBoard.jsx"));
const MaterialViewer = lazy(() => import("../../training/MaterialViewer.jsx"));

/* 受講生のチーム（モック teamTrainee）：左にグループ（今・これまで）とメンバー、右にチャット・ボード・やること・フォルダ。
   読む・送る・既読の決まりは今の画面と同じ（useTeamChat）。終わったチームは見るだけ */

const arr = v => (Array.isArray(v) ? v : []);
const CATS = ["tm", "att", "tst", "cur", "rep", "dev"];
const isEnded = t => t?.status === "ended";
const md = v => { const s = String(v || ""); return s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : ""; };
const ini = n => String(n || "？").replace(/^講師 /, "").slice(0, 1);
const catOf = t => (isEnded(t) ? "gy" : CATS[(Number(t?.color) || 0) % CATS.length]);
const errText = (e, fb) => e?.errorMessage || e?.message || fb;

function F({ name, k }) {
  return <span className={`tm-f${k ? ` ${k}` : ""}`} title={name} aria-hidden="true">{ini(name)}</span>;
}

function Chat({ team, me, nameOf }) {
  const c = useTeamChat({ team });
  const { msgs, code, text, files } = c;
  if (msgs == null) {
    return c.err
      ? <div className="empty tm-pad"><b>チャットを確認できません</b><Btn kind="ghost sm" onClick={c.load}>再読み込み</Btn></div>
      : <div className="soon">読み込み中</div>;
  }
  let lastDay = "";
  return (
    <div className="tm-body">
      <div className="tm-chat" ref={c.listRef} onScroll={e => { const el = e.currentTarget; c.stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
        {c.hasMore && <div className="tm-more"><Btn kind="ghost sm" disabled={c.older} onClick={c.loadOlder}>{c.older ? "読み込み中" : "さらに読み込む"}</Btn></div>}
        {msgs.length === 0 && <div className="tm-more"><Chip>発言なし</Chip></div>}
        {msgs.map(m => {
          const day = dayLabel(m.createdAt), sep = day !== lastDay;
          lastDay = day;
          const mine = m.by === me, staff = arr(team.staff).includes(m.by);
          return (
            <React.Fragment key={m.id}>
              {sep && <span className="tm-day"><span>{day}</span></span>}
              <div className={`tm-m${mine ? " me" : ""}`}>
                {!mine && <F name={nameOf(m.by)} k={staff ? "st" : ""} />}
                <div className="tm-mb">
                  <div className="tm-mh">{!mine && <b>{nameOf(m.by)}</b>}{staff && <Chip tone="mk">講師</Chip>}<small className="num">{hm(m.createdAt)}</small>{mine && !m.deleted && !c.ended && <button type="button" className="tm-del" onClick={() => c.remove(m)}>消す</button>}</div>
                  {m.deleted ? <div className="tm-t tm-gone">消された発言</div> : m.text && <div className="tm-t"><MsgBody text={m.text} /></div>}
                  {!m.deleted && arr(m.attachments).map(f => (
                    <div key={f.nodeId} className="tm-file"><FileIcon name={f.name} /><span className="fd-fb"><b>{f.name}</b><small className="num">{f.sizeBytes ? fmtSize(f.sizeBytes) : ""}</small></span><Btn kind="ghost sm" onClick={() => c.openFile(f)}>開く</Btn></div>
                  ))}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {c.err && <div className="lms-err tm-cerr" role="alert">{c.err}</div>}
      {c.canPost && !c.ended ? (
        <div className="tm-cp">
          {files.length > 0 && <div className="row">{files.map(f => <span key={f.nodeId} className="tm-pick"><span>{f.name}</span><button type="button" aria-label={`${f.name} を外す`} onClick={() => c.setFiles(cur => cur.filter(x => x.nodeId !== f.nodeId))}>×</button></span>)}</div>}
          {code != null && (
            <div className="tm-code">
              <div><span>コード</span><button type="button" aria-label="コードの欄を閉じる" onClick={() => c.setCode(null)}>×</button></div>
              <textarea ref={c.codeRef} value={code} rows={6} spellCheck={false} placeholder="ここにコードを貼り付け" aria-label="コード" onChange={e => c.setCode(e.target.value)} onKeyDown={c.codeKey} />
            </div>
          )}
          <textarea ref={c.inputRef} className="msgin" value={text} rows={2} maxLength={MAX_CHAT_TEXT} placeholder={`${team.name}に送る`} aria-label={`${team.name}に送る`} onChange={e => c.setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !c.inFence(text, e.currentTarget.selectionStart)) { e.preventDefault(); c.send(); } }} />
          <div className="tm-ct">
            <button type="button" className="tb" aria-pressed={code != null} onClick={c.insertCode}>&lt;/&gt; コード</button>
            {team.folderNodeId && <button type="button" className="tb" disabled={files.length >= MAX_CHAT_FILES} onClick={() => c.setPicking(true)}>ファイル</button>}
            <span style={{ marginLeft: "auto" }} />
            <Btn kind="sm" disabled={(!text.trim() && !(code || "").trim() && !files.length) || c.sending} onClick={c.send}>送る</Btn>
          </div>
        </div>
      ) : <div className="tm-ro"><Chip>見るだけ</Chip></div>}
      {c.picking && <div className="lms-legacy"><AttachPicker team={team} picked={files} onClose={() => c.setPicking(false)} onDone={list => { c.setFiles(list); c.setPicking(false); }} /></div>}
    </div>
  );
}

function Todos({ team, me, nameOf }) {
  const [todos, setTodos] = useState(null);
  const [canWrite, setCanWrite] = useState(false);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [who, setWho] = useState("");
  const base = `/teams/${encodeURIComponent(team.teamId)}/todos`, cq = `courseId=${encodeURIComponent(team.courseId)}`;
  const load = useCallback(async () => {
    try { const d = await apiGet(`${base}?${cq}`); setTodos(arr(d?.todos)); setCanWrite(!!d?.canWrite); setErr(""); }
    catch (e) { setErr(errText(e, "やることを確認できません")); }
  }, [base, cq]);
  useEffect(() => { load(); }, [load]);
  const run = async fn => { try { await fn(); await load(); } catch (e) { setErr(errText(e, "保存できませんでした")); } };
  if (todos == null) return err ? <div className="empty tm-pad"><b>{err}</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div> : <div className="soon">読み込み中</div>;
  return (
    <div className="tm-fd">
      <div className="tm-fh"><b className="h3">やること</b><Chip><span className="num">{todos.filter(t => t.done).length} / {todos.length}</span></Chip></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {todos.length === 0 && <div><Chip>なし</Chip></div>}
      <div className="fd-l">
        {todos.map(t => (
          <label key={t.todoId} className={`tm-td${t.done ? " dn" : ""}`}>
            <input type="checkbox" checked={!!t.done} disabled={!canWrite} onChange={e => run(() => apiPut(`${base}/${encodeURIComponent(t.todoId)}`, { courseId: team.courseId, done: e.target.checked }))} />
            <span>{t.text}</span>
            {arr(t.assignees).length > 0 && <Chip>{t.assignees.map(id => (id === "all" ? "全員" : nameOf(id))).join("・")}</Chip>}
            {canWrite && <button type="button" className="tm-del" onClick={e => { e.preventDefault(); run(() => apiDelete(`${base}/${encodeURIComponent(t.todoId)}?${cq}`)); }}>消す</button>}
          </label>
        ))}
      </div>
      {canWrite && (
        <form className="tm-tf" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; run(() => apiPost(base, { courseId: team.courseId, text: text.trim(), assignees: who ? [who] : [] })); setText(""); }}>
          <input type="text" value={text} maxLength={120} placeholder="やることを足す" aria-label="やること" onChange={e => setText(e.target.value)} />
          <select className="in" value={who} aria-label="担当" onChange={e => setWho(e.target.value)}>
            <option value="">担当なし</option><option value="all">全員</option>
            {arr(team.members).map(id => <option key={id} value={id}>{nameOf(id)}{id === me ? "（自分）" : ""}</option>)}
          </select>
          <Btn kind="sm" type="submit" disabled={!text.trim()}>足す</Btn>
        </form>
      )}
    </div>
  );
}

function Files({ team, say }) {
  const spaceId = `course#${team.courseId}`;
  const [nodes, setNodes] = useState(null);
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState(false);
  const [path, setPath] = useState([team.folderNodeId]);
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState(null);
  const [val, setVal] = useState("");
  const [viewing, setViewing] = useState(null);
  const fileRef = useRef(null);
  const load = useCallback(async () => {
    try { const d = await apiGet(`/library?spaceId=${encodeURIComponent(spaceId)}`); setNodes(arr(d?.nodes)); setLoadErr(false); }
    catch { setLoadErr(true); }
  }, [spaceId]);
  useEffect(() => { if (team.folderNodeId) load(); }, [load, team.folderNodeId]);
  if (!team.folderNodeId) return <div className="tm-fd"><div><Chip>フォルダなし</Chip></div></div>;
  if (loadErr) return <div className="empty tm-pad"><b>フォルダを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div>;
  if (!nodes) return <div className="soon">読み込み中</div>;
  const here = path[path.length - 1], node = id => nodes.find(n => n.nodeId === id);
  const kids = id => nodes.filter(n => n.parentId === id).sort((a, b) => String(a.name).localeCompare(String(b.name), "ja"));
  const folders = kids(here).filter(n => n.type === "folder"), files = kids(here).filter(n => n.type === "file");
  const canWrite = !!node(here)?.canWrite && !isEnded(team);
  const run = async fn => { setBusy(true); setErr(""); try { await fn(); await load(); } catch (e) { setErr(errText(e, "うまくいきませんでした")); } finally { setBusy(false); } };
  const open = async (n, download) => {
    setErr("");
    if (!download && n.materialId && /\.pdf$/i.test(n.name)) { setViewing(n); return; }
    try { const r = await apiGet(`/library/download?spaceId=${encodeURIComponent(spaceId)}&nodeId=${encodeURIComponent(n.nodeId)}${download ? "&mode=download" : ""}`); window.open(r.url, "_blank", "noopener"); }
    catch (e) { setErr(errText(e, `「${n.name}」を開けませんでした`)); }
  };
  const confirm = () => {
    const { kind, n } = dlg, name = val.trim();
    if (kind !== "delete" && !name) return;
    setDlg(null);
    run(async () => {
      if (kind === "folder") await apiPost("/library/folders", { spaceId, parentId: here, name });
      if (kind === "rename") await apiPut(`/library/nodes/${encodeURIComponent(n.nodeId)}`, { spaceId, name });
      if (kind === "delete") await apiDelete(`/library/nodes/${encodeURIComponent(n.nodeId)}?spaceId=${encodeURIComponent(spaceId)}`);
    });
  };
  return (
    <div className="tm-fd">
      <div className="tm-fh">
        <div className="tm-fp">
          {path.length > 1 && <button type="button" className="tm-fc" onClick={() => setPath(path.slice(0, -1))}>{node(path[path.length - 2])?.name ? `← ${path.length === 2 ? "チームのフォルダ" : node(path[path.length - 2]).name}` : "← 戻る"}</button>}
          {folders.map(n => <button key={n.nodeId} type="button" className="tm-fc" onClick={() => setPath([...path, n.nodeId])}><span className="dv-folder" aria-hidden="true" />{n.name}<em className="num">{kids(n.nodeId).length}</em></button>)}
        </div>
        {canWrite
          ? <span className="row"><Btn kind="ghost sm" disabled={busy} onClick={() => { setVal(""); setDlg({ kind: "folder" }); }}>フォルダを作る</Btn><Btn kind="sm" disabled={busy} onClick={() => fileRef.current?.click()}>ファイルを置く</Btn><input ref={fileRef} type="file" multiple className="lms-sr" aria-label="置くファイル" onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) run(async () => { await uploadToFolder({ courseId: team.courseId, parentId: here, files: fs }); say?.(`${fs.length} ファイルを置きました`); }); }} /></span>
          : isEnded(team) && <Chip>見るだけ</Chip>}
      </div>
      {path.length > 1 && <b className="tm-fn">{node(here)?.name}</b>}
      {err && <div className="lms-err" role="alert">{err}</div>}
      {busy && <div className="dv-mt" role="status">処理しています</div>}
      {files.length > 0 ? (
        <div className="fd-l">
          {files.map(n => (
            <div key={n.nodeId} className="fd-f">
              <FileIcon name={n.name} />
              <span className="fd-fb"><b>{n.name}</b><small className="num">{md(n.updatedAt)}{n.sizeBytes ? ` ・ ${fmtSize(n.sizeBytes)}` : ""}</small></span>
              <span />
              <span className="fd-ac">
                <Btn kind="ghost sm" onClick={() => open(n)}>開く</Btn>
                <Btn kind="ghost sm" onClick={() => open(n, true)}>ダウンロード</Btn>
                {n.canWrite && !isEnded(team) && <><Btn kind="ghost sm" onClick={() => { setVal(n.name); setDlg({ kind: "rename", n }); }}>名前</Btn><Btn kind="ghost sm" onClick={() => setDlg({ kind: "delete", n })}>消す</Btn></>}
              </span>
            </div>
          ))}
        </div>
      ) : folders.length === 0 && <div><Chip>なし</Chip></div>}
      {viewing && <Suspense fallback={null}><div className="lms-legacy"><MaterialViewer courseId={team.courseId} material={{ materialId: viewing.materialId, title: viewing.name, mode: "view" }} onClose={() => setViewing(null)} canAnnotate /></div></Suspense>}
      {dlg && (
        <Modal title={dlg.kind === "folder" ? "フォルダを作る" : dlg.kind === "rename" ? "名前を変える" : "消す"} width={420} onClose={() => setDlg(null)} footer={<><Btn kind="ghost" onClick={() => setDlg(null)}>やめる</Btn><Btn onClick={confirm}>{dlg.kind === "delete" ? "消す" : "決める"}</Btn></>}>
          {dlg.kind === "delete" ? <b>{dlg.n.name}</b> : <input type="text" value={val} autoFocus aria-label="名前" onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") confirm(); }} />}
        </Modal>
      )}
    </div>
  );
}

export default function TraineeTeam({ go, say }) {
  const today = todayStr();
  const [data, setData] = useState(null);
  const [fail, setFail] = useState(false);
  const [openId, setOpenId] = useState("");
  const [tab, setTab] = useState("chat");
  const [exercises, setExercises] = useState([]);
  const unread = useChatUnread(true);

  const load = useCallback(async () => {
    setFail(false);
    try { const d = await apiGet("/teams"); setData({ me: d?.me || "", teams: arr(d?.teams), people: d?.people || {} }); }
    catch { setFail(true); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // チャットの新着通知から開いたとき：そのチームのチャットを開く
  useEffect(() => {
    if (!data) return undefined;
    const apply = () => { const id = takeTeamChatFocus(); if (id && data.teams.some(t => t.teamId === id)) { setOpenId(id); setTab("chat"); } };
    apply();
    window.addEventListener("feeps:team-chat-focus", apply);
    return () => window.removeEventListener("feeps:team-chat-focus", apply);
  }, [data]);

  const mineAll = (data?.teams || []).filter(t => arr(t.members).includes(data.me));
  const now = mineAll.filter(t => !isEnded(t));
  const past = mineAll.filter(isEnded).sort((a, b) => String(b.endedAt || "").localeCompare(String(a.endedAt || "")));
  const team = mineAll.find(t => t.teamId === openId) || now[0] || past[0] || null;

  // 今日のカリキュラムのチーム演習（あれば帯で出す）
  useEffect(() => {
    let alive = true;
    setExercises([]);
    if (!team || isEnded(team)) return undefined;
    apiGet(`/courses/${encodeURIComponent(team.courseId)}/curriculum`).then(item => {
      const inDay = u => { const s = String(u?.startDate || "").slice(0, 10), e = String(u?.endDate || u?.startDate || "").slice(0, 10); return s && s <= today && today <= e; };
      const out = [];
      normalizeCurriculumSections(item).forEach(sec => {
        const units = sec.unitMode === "section" ? [sec] : arr(sec.chapters).flatMap(ch => arr(ch.lessons));
        units.filter(inDay).forEach(u => arr(u.exercises).filter(x => x.type === "team").forEach(x => out.push({ unit: u.title || sec.title, title: x.title || "チーム演習" })));
      });
      if (alive) setExercises(out);
    }).catch(() => {});
    return () => { alive = false; };
  }, [team?.teamId, team?.status, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fail && !data) return <Card><div className="empty"><b>チームを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card>;
  if (!data) return <div className="soon card">読み込み中</div>;
  if (!team) return <Card><div className="empty"><b>チーム</b><Chip>未所属</Chip></div></Card>;

  const nameOf = id => data.people[id]?.name || "名前未設定";
  const unreadOf = id => arr(unread?.teams).find(t => t.teamId === id)?.unread || 0;
  const tabs = [["chat", "チャット"], ...(team.settings?.board ? [["board", "ボード"]] : []), ["todo", "やること"], ["files", "フォルダ"]];
  const cur = tabs.some(([k]) => k === tab) ? tab : "chat";
  const grp = t => (
    <button key={t.teamId} type="button" className={`tm-g c-${catOf(t)}`} aria-current={t === team} onClick={() => { setOpenId(t.teamId); setTab("chat"); }}>
      <span className="tm-gi" aria-hidden="true">{String(t.name).slice(0, 1)}</span>
      <span className="tm-gb"><b>{t.name}</b><small className="num">{isEnded(t) ? `〜${md(t.endedAt)}` : `${arr(t.members).length} 人`}</small></span>
      {unreadOf(t.teamId) > 0 ? <em className="num">{unreadOf(t.teamId)}</em> : <span />}
    </button>
  );
  const nUnread = now.reduce((a, t) => a + unreadOf(t.teamId), 0);

  return (
    <div className="th tm">
      <div className="th-top">
        <div><div className="eyebrow">{team.courseName || ""}</div><h1 className="h1">チーム</h1></div>
        <div className="th-att">
          {now[0] && <span className="th-pill"><i aria-hidden="true" style={{ background: "var(--tm-d)" }} />今は <b>{now[0].name}</b></span>}
          {nUnread > 0 && <span className="th-pill"><i aria-hidden="true" style={{ background: "var(--dev-d)" }} />未読 <b className="num">{nUnread}</b></span>}
        </div>
      </div>
      <div className="tm-w">
        <div className="tm-l">
          <nav className="card tm-nav" aria-label="グループ">
            {now.length > 0 && <span className="eyebrow tm-sec">今のグループ</span>}
            {now.map(grp)}
            {past.length > 0 && <span className="eyebrow tm-sec">これまでのグループ</span>}
            {past.map(grp)}
          </nav>
          <Card className="pad tm-mem">
            <div className="head"><h2 className="h3">メンバー</h2><span className="r"><Chip>{arr(team.members).length} 人</Chip></span></div>
            <div className="tm-ml">
              {arr(team.members).map(id => <div key={id}><F name={nameOf(id)} k={id === data.me ? "me" : ""} /><b>{nameOf(id)}{id === data.me && <small>自分</small>}</b>{team.leader === id ? <Chip tone="warn">リーダー</Chip> : <span />}</div>)}
              {arr(team.staff).map(id => <div key={id}><F name={nameOf(id)} k="st" /><b>{nameOf(id)}</b><Chip tone="mk">講師</Chip></div>)}
            </div>
          </Card>
        </div>
        <section className={`card tm-main c-${catOf(team)}`}>
          <header className="tm-h">
            <span className="tm-gi big" aria-hidden="true">{String(team.name).slice(0, 1)}</span>
            <div className="tm-hb"><b>{team.name}</b><small className="num">{isEnded(team) ? `終了 ${md(team.endedAt)}` : team.theme || `${arr(team.members).length} 人`}</small></div>
            <span className="tm-av" aria-label={arr(team.members).map(nameOf).join("、")}>{arr(team.members).slice(0, 8).map(id => <F key={id} name={nameOf(id)} />)}</span>
            <span className="tm-seg tm-tabs">{tabs.map(([k, t]) => <button key={k} type="button" aria-pressed={cur === k} onClick={() => setTab(k)}>{t}</button>)}</span>
          </header>
          {exercises.map((x, i) => <div key={i} className="tm-ex"><span className="fd-fb"><span className="eyebrow">今日の演習</span><b>{x.title}</b><small>{x.unit}</small></span><Btn kind="ghost sm" onClick={() => go("cur")}>開く</Btn></div>)}
          {cur === "chat" && <Chat key={team.teamId} team={team} me={data.me} nameOf={nameOf} />}
          {cur === "board" && <div className="tm-board lms-legacy"><Suspense fallback={<div className="soon">読み込み中</div>}><TeamBoard key={team.teamId} team={team} nameOf={nameOf} /></Suspense></div>}
          {cur === "todo" && <Todos key={team.teamId} team={team} me={data.me} nameOf={nameOf} />}
          {cur === "files" && <Files key={team.teamId} team={team} say={say} />}
        </section>
      </div>
    </div>
  );
}
