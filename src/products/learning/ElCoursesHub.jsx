import React, { useState } from "react";
import { Seg, PRODUCT_ACCENT } from "../../components/common";
import { ElCourseView, ElInProgressView, ElCompletedView, ElRecommendView } from "./LearningComponents.jsx";

// コースの一覧をひとつにまとめた画面（2026-09-05）。承認モック: mock/learning-inventory
//
// それまでサイドナビに「コース一覧」「おすすめ」「学習中」「修了済み」が並んでいたが、
// **4つとも同じカタログを条件で絞って並べているだけ**だった（画面の作りも同じ）。
// 受講生が同じ形の画面に4回出会うことになるため、1項目＋タブへまとめた。
// 「修了証」を「修了済み」へ寄せたとき（2026-08-21）と同じ畳み方。
//
// 中身の4画面はそのまま使う。**絞り込みの条件はどれも既存のまま**で、置き場所だけを変えている。

const TABS = [
  { value: "all", label: "すべて" },
  { value: "inprogress", label: "学習中" },
  { value: "completed", label: "修了" },
  { value: "recommend", label: "おすすめ" },
];

export default function ElCoursesHub({ initialTab = "all", ...sp }) {
  const [tab, setTab] = useState(TABS.some(t => t.value === initialTab) ? initialTab : "all");

  return (
    <div>
      <div className="mb-3">
        <Seg
          value={tab}
          onChange={setTab}
          options={TABS}
          activeFg={PRODUCT_ACCENT.learning.deep}
        />
      </div>
      {tab === "all" && <ElCourseView {...sp} />}
      {tab === "inprogress" && <ElInProgressView {...sp} />}
      {tab === "completed" && <ElCompletedView {...sp} />}
      {tab === "recommend" && <ElRecommendView {...sp} />}
    </div>
  );
}
