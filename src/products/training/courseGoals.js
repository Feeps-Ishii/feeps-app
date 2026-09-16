/* コースごとの目標と、受講生が自分で足した目標の合わせ方（2026-09-16 打合せ）。
 *
 * **コースの目標が土台。** 講師が直したら、次に開いたときに反映される。
 * そのうえで、**受講生が自分で足したものは消さない**。消えると「自分で書く意味がない」と
 * 思われて、以後だれも書かなくなる。
 *
 * 達成の記録(done)はタスクidのマップなので、idさえ変えなければ合わせても壊れない。 */

const arr = v => (Array.isArray(v) ? v : []);

export function mergeCourseGoals(courseGoals, personalGoals) {
  const course = arr(courseGoals).filter(g => g && g.id);
  const personal = arr(personalGoals);
  // コース側が未設定なら、これまでどおり本人のものだけを使う
  if (!course.length) return personal;

  const personalById = new Map(personal.map(g => [g.id, g]));
  const merged = course.map(cg => {
    const mine = personalById.get(cg.id);
    const courseTaskIds = new Set(arr(cg.tasks).map(t => t.id));
    // 同じ目標に自分で足したタスクは後ろに残す
    const extra = arr(mine?.tasks).filter(t => t && t.id && !courseTaskIds.has(t.id));
    return {
      ...(mine || {}),
      id: cg.id,
      title: cg.title,
      sub: cg.sub || mine?.sub || "",
      fromCourse: true,
      tasks: [...arr(cg.tasks).map(t => ({ ...t, fromCourse: true })), ...extra],
    };
  });

  const courseIds = new Set(course.map(g => g.id));
  const own = personal.filter(g => g && !courseIds.has(g.id));
  return [...merged, ...own];
}

/* コースの目標として保存する形。表示用の付随情報（アイコン・由来）は落とす */
export function toCourseGoalsPayload(goals) {
  return arr(goals).map(g => ({
    id: g.id,
    title: g.title || "",
    sub: g.sub || "",
    tasks: arr(g.tasks).map(t => ({ id: t.id, t: t.t || "" })),
  }));
}
