import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PRODUCT_ACCENT } from "../../components/common";
import { useCloudLabProgress } from "./useCloudLab.js";
import { unitById, groupById, groupOfUnit } from "./CloudLabCatalog.js";
import CloudLabHub from "./CloudLabHub.jsx";
import CloudLabGroup from "./CloudLabGroup.jsx";
import CloudLabConsoleUnit from "./CloudLabConsoleUnit.jsx";
import AwsLabSlide from "./AwsLabSlide.jsx";

// クラウド実習（学習モードの3本目の柱）。正典: docs/specs/aws-lab-spec.md
//
// 画面は3段。**ハブ（グループ一覧） → グループ（単元一覧） → 単元（実習）**。
//
// **subViewを増やさない。** 行き来は activeGroupId / activeUnitId だけで切り替える。
// TrainingApp.jsx はナビに無いsubViewを検知するとホームへ戻すので、
// 画面ごとにキーを発行すると即座に弾かれる（DevLabのactiveProjectIdと同じ形）。

const A = PRODUCT_ACCENT.cloudlab;

function UnitView({ unit, backLabel, onBack, onPassed }) {
  // 単元に入っていた時間。**通過したときにだけ**記録するので、
  // 開いて閉じただけでは積算されない
  const startedAt = useRef(Date.now());
  useEffect(() => { startedAt.current = Date.now(); }, [unit.id]);

  const handlePassed = useCallback(() => {
    onPassed(unit.id, Math.round((Date.now() - startedAt.current) / 1000));
  }, [unit.id, onPassed]);

  const group = groupOfUnit(unit.id);

  return (
    <div>
      <button type="button" onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: A.deep }}>
        <ArrowLeft size={14} />{backLabel}
      </button>
      <AwsLabSlide
        slide={{ id: `cloudlab_${unit.id}`, title: unit.title }}
        content={{
          chapter: `${group ? group.label + " " : ""}単元 ${unit.no}`,
          chapterTitle: "クラウド実習",
          intro: unit.lab.intro,
          task: unit.lab.task,
          initial: unit.lab.initial,
          userDataStarter: unit.lab.userDataStarter,
        }}
        onPassed={handlePassed}
      />
    </div>
  );
}

export default function CloudLabProduct() {
  const { progress, loading, error, reload, markPassed } = useCloudLabProgress();
  const [activeGroupId, setActiveGroupId] = useState("");
  const [activeUnitId, setActiveUnitId] = useState("");

  const unit = activeUnitId ? unitById(activeUnitId) : null;
  const group = activeGroupId ? groupById(activeGroupId) : null;

  const onPassed = useCallback((unitId, seconds) => { markPassed(unitId, seconds); }, [markPassed]);

  // 単元を開く。**遊べない単元が指定されたら開かない**（データを直したときに壊れた画面を出さない）
  const openUnit = useCallback(id => {
    const u = unitById(id);
    if (u?.lab || u?.console) setActiveUnitId(id);
  }, []);

  // 単元7だけは模型ではなく本物のAWSへ入る。専用の画面を出す
  if (unit?.console) {
    return <CloudLabConsoleUnit unit={unit} onBack={() => setActiveUnitId("")} />;
  }

  if (unit?.lab) {
    // 「戻る」の行き先は、来た道に合わせる。グループ経由ならグループへ、
    // ハブの「続きから」で直に来たならハブへ
    const backToGroup = !!group;
    return (
      <UnitView
        unit={unit}
        backLabel={backToGroup ? `${group.label}の単元へ戻る` : "クラウド実習へ戻る"}
        onBack={() => setActiveUnitId("")}
        onPassed={onPassed}
      />
    );
  }

  if (group) {
    return (
      <CloudLabGroup
        group={group}
        progress={progress}
        onBack={() => setActiveGroupId("")}
        onOpenUnit={openUnit}
      />
    );
  }

  return (
    <CloudLabHub
      progress={progress}
      loading={loading}
      error={error}
      onRetry={reload}
      onOpenGroup={setActiveGroupId}
      onOpenUnit={openUnit}
    />
  );
}
