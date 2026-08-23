import { apiPost } from "../../api.js";

// 2026-08-24: 教材の音声を1か所で管理する。
//
// 画面には読み上げボタンが複数あり（解説・ノート）、さらに講義プレイヤーが連続再生する。
// それぞれが勝手に Audio を作ると**同時に鳴る**ので、再生中のものは常に1つだけにする。
//
// 音声そのものは Backend(POST /learning/tts) が S3 へキャッシュ済み。ここでは
// URL の取得結果だけを画面内で使い回して、同じ文章で2回問い合わせないようにする。
//
// 2026-08-24追記: Backendは音声と一緒に**文ごとの開始時刻(marks)**を返す。
// 再生位置から「いま読んでいる文」を割り出して subscribeSpeech で配るので、
// 画面側はそれを見て本文にマーカーを引ける（＝どこを説明しているかが分かる）。

let current = null;          // 再生中の Audio
let currentToken = 0;        // 再生ごとの世代。古い再生の onended を無視するために使う
const speechCache = new Map(); // text -> { urls, chunks }（同一画面内での再取得を防ぐ）

// いま読んでいる文。画面側は subscribeSpeech で受け取る。
const IDLE_CUE = { sourceText: "", sentence: "", index: -1, speaking: false };
let cue = IDLE_CUE;
const listeners = new Set();

function emitCue(next) {
  cue = next;
  for (const listener of listeners) {
    try { listener(cue); } catch (e) { /* 1つの購読者の失敗で他を止めない */ }
  }
}

// 戻り値は購読解除。呼んだ時点の状態をすぐ1回渡す。
export function subscribeSpeech(listener) {
  listeners.add(listener);
  try { listener(cue); } catch (e) { /* 同上 */ }
  return () => listeners.delete(listener);
}

export function getSpeechCue() {
  return cue;
}

export function stopSpeech() {
  currentToken += 1;
  if (current) {
    try { current.pause(); } catch (e) { /* 既に破棄済み */ }
    current = null;
  }
  if (cue.speaking) emitCue(IDLE_CUE);
}

export function isSpeaking() {
  return Boolean(current);
}

// 音声URLと文ごとの開始時刻をまとめて取る。
export async function fetchSpeech(text) {
  const key = String(text || "");
  if (!key.trim()) return { urls: [], chunks: [] };
  if (speechCache.has(key)) return speechCache.get(key);
  const res = await apiPost("/learning/tts", { text: key });
  const urls = Array.isArray(res?.urls) ? res.urls : [];
  // chunks は2026-08-24以降のBackendのみ返す。古い応答でも読み上げは動くようにする。
  const chunks = Array.isArray(res?.chunks) && res.chunks.length
    ? res.chunks
    : urls.map(url => ({ url, marks: [] }));
  const speech = { urls, chunks };
  speechCache.set(key, speech);
  return speech;
}

export async function fetchSpeechUrls(text) {
  return (await fetchSpeech(text)).urls;
}

// 長い文章は複数のmp3に分かれて返るので、順番に再生する。
// 戻り値の Promise は「最後まで鳴り終わったか」を返す（途中で止めたら false）。
// sourceText を渡すと、マーカーを引く側が「どの文章の再生か」を見分けられる。
export function playSpeech(speech, { rate = 1, sourceText = "" } = {}) {
  stopSpeech();
  const token = currentToken;
  const list = (Array.isArray(speech?.chunks) ? speech.chunks : []).filter(c => c && c.url);
  if (!list.length) return Promise.resolve(false);

  // 文の通し番号。チャンクをまたいでも1本の連番にする。
  const offsets = [];
  let running = 0;
  for (const chunk of list) {
    offsets.push(running);
    running += (chunk.marks || []).length;
  }

  return new Promise(resolve => {
    let index = 0;
    const playNext = () => {
      if (token !== currentToken) { resolve(false); return; }
      if (index >= list.length) { current = null; emitCue(IDLE_CUE); resolve(true); return; }
      const chunk = list[index];
      const marks = Array.isArray(chunk.marks) ? chunk.marks : [];
      const offset = offsets[index];
      const audio = new Audio(chunk.url);
      audio.playbackRate = rate;
      current = audio;

      // marks の time は「音声の中での経過ms」。再生速度を変えても currentTime は
      // 音声側の時間で進むので、そのまま突き合わせてよい。
      let markIndex = -1;
      const syncCue = () => {
        if (token !== currentToken || !marks.length) return;
        const nowMs = audio.currentTime * 1000;
        let next = markIndex;
        // 前へ戻ることは無いので、追いついた分だけ進める。
        while (next + 1 < marks.length && marks[next + 1].time <= nowMs) next += 1;
        if (next < 0 && marks.length && marks[0].time <= nowMs) next = 0;
        if (next !== markIndex && next >= 0) {
          markIndex = next;
          emitCue({ sourceText, sentence: marks[next].text || "", index: offset + next, speaking: true });
        }
      };
      audio.ontimeupdate = syncCue;

      audio.onended = () => { index += 1; playNext(); };
      // 音声が壊れていても講義を止めない。次へ進める。
      audio.onerror = () => { index += 1; playNext(); };
      // marks が無くても「読み上げ中」であることだけは伝える。
      if (!marks.length) emitCue({ sourceText, sentence: "", index: -1, speaking: true });
      audio.play().catch(() => { if (token === currentToken) { index += 1; playNext(); } });
    };
    playNext();
  });
}

// 旧シグネチャ（URLの配列だけ）。marks が要らない場所のために残す。
export function playUrls(urls, options) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  return playSpeech({ chunks: list.map(url => ({ url, marks: [] })) }, options);
}

export async function speak(text, options) {
  const speech = await fetchSpeech(text);
  return playSpeech(speech, { ...options, sourceText: String(text || "") });
}
