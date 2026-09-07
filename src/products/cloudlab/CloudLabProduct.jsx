import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PRODUCT_ACCENT } from "../../components/common";
import { useCloudLabProgress } from "./useCloudLab.js";
import { unitById } from "./CloudLabCatalog.js";
import CloudLabHub from "./CloudLabHub.jsx";
import AwsLabSlide from "./AwsLabSlide.jsx";

// クラウド実習（学習モードの3本目の柱）。正典: docs/specs/aws-lab-spec.md
//
// **subViewを増やさない。** ハブと単元の行き来は activeUnitId だけで切り替える。
// TrainingApp.jsx はナビに無いsubViewを検知するとホームへ戻すので、
// 単元ごとにキーを発行すると即座に弾かれる（DevLabのactiveProjectIdと同じ形）。

const A = PRODUCT_ACCENT.cloudlab;

function UnitView({ unit, onBack, onPassed }) {
  // 単元に入っていた時間。**通過したときにだけ**記録するので、
  // 開いて閉じただけでは積算されない
  const startedAt = useRef(Date.now());
  useEffect(() => { startedAt.current = Date.now(); }, [unit.id]);

  const handlePassed = useCallback(() => {
    onPassed(unit.id, Math.round((Date.now() - startedAt.current) / 1000));
  }, [unit.id, onPassed]);

  return (
    <div>
      <button type="button" onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: A.deep }}>
        <ArrowLeft size={14} />クラウド実習へ戻る
      </button>
      <AwsLabSlide
        slide={{ id: `cloudlab_${unit.id}`, title: unit.title }}
        content={{
          chapter: `単元 ${unit.no}`,
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
  const [activeUnitId, setActiveUnitId] = useState("");

  const unit = activeUnitId ? unitById(activeUnitId) : null;
  // 遊べない単元が指定されたらハブへ落とす（データを直したときに壊れた画面を出さない）
  const openable = unit && unit.lab;

  const onPassed = useCallback((unitId, seconds) => { markPassed(unitId, seconds); }, [markPassed]);

  if (openable) {
    return <UnitView unit={unit} onBack={() => setActiveUnitId("")} onPassed={onPassed} />;
  }

  return (
    <CloudLabHub
      progress={progress}
      loading={loading}
      error={error}
      onRetry={reload}
      onOpenUnit={id => {
        const u = unitById(id);
        if (u?.lab) setActiveUnitId(id);
      }}
    />
  );
}
