import React, { useState } from "react";
import { Btn, Modal } from "../parts/ui.jsx";
import { DevHubMark } from "../../../components/common/DevHubMark.jsx";

/* 修了証（モック certModal）：確定した修了レポートから、受講生ごとに。PDF は印刷の「PDF に保存」で全員分を 1 人 1 ページに */

const jp = v => { const [y, m, d] = String(v || "").slice(0, 10).split("-").map(Number); return y ? `${y}年${m}月${d}日` : ""; };

function Sheet({ name, course, period, date }) {
  return (
    <div className="cr">
      <div className="cr-in">
        <div className="cr-mark"><DevHubMark product="teal" size={30} /><span>DevHub LMS</span></div>
        <b className="cr-t">修了証</b>
        <span className="cr-n">{name} 殿</span>
        <p>{course}{period ? `（${period}）` : ""}の<br />すべての課程を修了したことを証します。</p>
        <span className="cr-d">{date}</span>
        <span className="cr-i">株式会社 Feeps</span>
      </div>
    </div>
  );
}

export function CertModal({ people, course, start, end, confirmedAt, onClose }) {
  const [i, setI] = useState(0);
  const period = start && end ? `${jp(start)}〜${jp(end)}` : "";
  const date = jp(confirmedAt) || jp(end);
  const cur = people[i];
  return (
    <Modal title="修了証" width={720} onClose={onClose} footer={<><span className="mpos num">{i + 1} / {people.length}</span><Btn kind="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>‹ 前の人</Btn><Btn kind="ghost" disabled={i >= people.length - 1} onClick={() => setI(i + 1)}>次の人 ›</Btn><Btn onClick={() => window.print()}>PDF で受け取る（{people.length} 人分）</Btn></>}>
      <style>{"@media print{@page{size:A4 landscape;margin:10mm} body *{visibility:hidden !important} #cert-print,#cert-print *{visibility:visible !important} #cert-print{display:block !important;position:absolute;left:0;top:0;width:100%} #cert-print .cr{break-after:page;box-shadow:none}}"}</style>
      {cur && <Sheet name={cur.name} course={course} period={period} date={date} />}
      <div id="cert-print" style={{ display: "none" }}>{people.map(p => <Sheet key={p.id} name={p.name} course={course} period={period} date={date} />)}</div>
    </Modal>
  );
}
