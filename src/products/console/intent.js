/* 頼む欄のルール（2026-10-20）。移動のほとんどはここで決まり、AI は呼ばない（速く・お金がかからない）。
   決まらなかった文・何かを変える文だけ /console/assist（AI）へ送る */

// コースの中のタブ。key は ConsoleCourse の TABS と同じ
export const TAB_WORDS = [
  ["report", /日報/],
  ["att", /勤怠|出欠|出席|遅刻|欠席|早退|打刻/],
  ["test", /テスト|採点|試験/],
  ["practice", /練習問題|問題集|問題/],
  ["curriculum", /カリキュラム|日程|単元|時間割/],
  ["doc", /資料|フォルダ|ファイル|PDF|スライド|教材/],
  ["dev", /個人開発|課題|レビュー/],
  ["announce", /お知らせ|アナウンス|連絡/],
  ["teams", /チーム/],
  ["seating", /席替え|座席|席/],
  ["completion", /修了|レポート/],
  ["students", /受講生|名簿|生徒/],
  ["today", /今日|きょう|様子/],
];
const AREA_WORDS = [
  ["people", /企業|会社|ユーザー|アカウント|講師(を|の)?(一覧|探|登録)|管理者/],
  ["library", /教材|公開先|見せる人|共有フォルダ/],
];
// 見る・開く・作りたい、は移動。誰かを・何かを「〜して」は変える内容なので AI へ
const WANT_TO_SEE = /(見|確認|開|一覧|画面|行|チェック|したい|たい$|追加したい|作りたい|直したい)/;
const DO_IT = /(して(ください|下さい)?$|してほしい|お願いします?$|登録して|入れて|外して|変えて|直して|出して|書いて|送って|付けて|担当に)/;

const norm = s => String(s || "").replace(/[\s　]/g, "").toLowerCase();

// 文に入っているコース（名前が長く合うものを優先）。企業名だけで1つに決まるときも使う
export function matchCourse(text, courses) {
  const t = norm(text);
  let best = null;
  for (const c of courses) {
    const n = norm(c.name);
    if (n.length >= 2 && t.includes(n) && (!best || n.length > best.len)) best = { c, len: n.length };
  }
  if (best) return best.c;
  // 名前の頭の語（「Java研修 2026秋」の「Java研修」）で1つに決まるとき
  const head = c => norm(String(c.name || "").split(/[\s　(（]/)[0]);
  const byHead = courses.filter(c => head(c).length >= 2 && t.includes(head(c)));
  if (byHead.length === 1) return byHead[0];
  const byCompany = courses.filter(c => c.company && norm(c.company).length >= 2 && t.includes(norm(c.company)));
  return byCompany.length === 1 ? byCompany[0] : null;
}

/* 返すもの：
   { kind: "navigate", area, courseId, tab }   … すぐ移動
   { kind: "pick", tab }                        … コースが決まらない（ホームでコースを選んでもらう）
   null                                         … AI へ */
export function ruleIntent(text, { courses, scopeCourseId }) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  // お客様の名簿で登録：受講生のタブで名簿の読み込みを開く（中身は画面で確かめる）
  if (/名簿/.test(raw) && /(登録|読み込|取り込|入れ|作)/.test(raw)) {
    const c = matchCourse(raw, courses);
    const courseId = c?.id || scopeCourseId || (courses.length === 1 ? courses[0].id : "");
    return courseId ? { kind: "navigate", area: "course", courseId, tab: "students", roster: true } : { kind: "pick", tab: "students", roster: true };
  }
  if (DO_IT.test(raw) && !/^(.*)(見せて|開いて)$/.test(raw)) return null;
  const course = matchCourse(raw, courses);
  if (!course) for (const [area, re] of AREA_WORDS) if (re.test(raw) && (WANT_TO_SEE.test(raw) || raw.length <= 8)) return { kind: "navigate", area };
  const tab = TAB_WORDS.find(([, re]) => re.test(raw))?.[0] || "";
  const short = raw.length <= 14;
  if (!tab && course && short) return { kind: "navigate", area: "course", courseId: course.id, tab: "today" };
  if (!tab) return null;
  if (!WANT_TO_SEE.test(raw) && !short) return null;
  const courseId = course?.id || scopeCourseId || (courses.length === 1 ? courses[0].id : "");
  // 資料・フォルダはコースを決めずに頼まれたら、教材のフォルダ（置き場ごとの一覧）へ
  if (!courseId && tab === "doc") return { kind: "navigate", area: "library", sub: "folders" };
  if (!courseId) return { kind: "pick", tab };
  return { kind: "navigate", area: "course", courseId, tab };
}
