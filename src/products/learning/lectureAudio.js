import { apiPost } from "../../api.js";

// 2026-08-24: 教材の音声を1か所で管理する。
//
// 画面には読み上げボタンが複数あり（解説・ノート）、さらに講義プレイヤーが連続再生する。
// それぞれが勝手に Audio を作ると**同時に鳴る**ので、再生中のものは常に1つだけにする。
//
// 音声そのものは Backend(POST /learning/tts) が S3 へキャッシュ済み。ここでは
// URL の取得結果だけを画面内で使い回して、同じ文章で2回問い合わせないようにする。

let current = null;          // 再生中の Audio
let currentToken = 0;        // 再生ごとの世代。古い再生の onended を無視するために使う
const urlCache = new Map();  // text -> string[]（同一画面内での再取得を防ぐ）

export function stopSpeech() {
  currentToken += 1;
  if (current) {
    try { current.pause(); } catch (e) { /* 既に破棄済み */ }
    current = null;
  }
}

export function isSpeaking() {
  return Boolean(current);
}

export async function fetchSpeechUrls(text) {
  const key = String(text || "");
  if (!key.trim()) return [];
  if (urlCache.has(key)) return urlCache.get(key);
  const res = await apiPost("/learning/tts", { text: key });
  const urls = Array.isArray(res?.urls) ? res.urls : [];
  urlCache.set(key, urls);
  return urls;
}

// 長い文章は複数のmp3に分かれて返るので、順番に再生する。
// 戻り値の Promise は「最後まで鳴り終わったか」を返す（途中で止めたら false）。
export function playUrls(urls, { rate = 1 } = {}) {
  stopSpeech();
  const token = currentToken;
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (!list.length) return Promise.resolve(false);

  return new Promise(resolve => {
    let index = 0;
    const playNext = () => {
      if (token !== currentToken) { resolve(false); return; }
      if (index >= list.length) { current = null; resolve(true); return; }
      const audio = new Audio(list[index]);
      audio.playbackRate = rate;
      current = audio;
      audio.onended = () => { index += 1; playNext(); };
      // 音声が壊れていても講義を止めない。次へ進める。
      audio.onerror = () => { index += 1; playNext(); };
      audio.play().catch(() => { if (token === currentToken) { index += 1; playNext(); } });
    };
    playNext();
  });
}

export async function speak(text, options) {
  const urls = await fetchSpeechUrls(text);
  return playUrls(urls, options);
}
