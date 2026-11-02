import React from "react";

// 画面のアイコン（モックの SIC と同じ線）
const P = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  task: "M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5",
  report: "M6 3h9l3 3v15H6zM9 11h6M9 15h6",
  att: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  cur: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5",
  test: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 11l2 2 4-4",
  prac: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  dev: "M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12",
  doc: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  team: "M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM17 6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M14 20c0-2.6 1.3-4.6 3-4.6s4 2 4 4.6",
  note: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3",
  goal: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z",
  ann: "M4 10v4h3l5 4V6L7 10zM16 9a4 4 0 0 1 0 6",
  seat: "M4 10h16M6 10v8M18 10v8M8 6h8v4H8z",
  people: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 3.6-7 8-7s8 3 8 7",
  done: "M6 3h12v18l-6-4-6 4z",
  eval: "M4 19h16M7 16V9M12 16V5M17 16v-4",
  setting: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
  state: "M4 19V9M10 19V5M16 19v-7M22 19H2",
  grant: "M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6",
  course: "M4 5h16v4H4zM4 13h10v6H4zM17 13h3v6h-3z",
  users: "M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 11h6M19 8v6",
  ana: "M4 19V9M10 19V5M16 19v-7",
  cos: "M4 21V6l8-3 8 3v15M2 21h20M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21h4",
  menu: "M4 7h16M4 12h16M4 17h16",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  down: "M6 9l6 6 6-6",
  right: "M5 12h14M13 6l6 6-6 6",
};
P.sann = P.ann; P.lcur = P.cur; P.ltest = P.test; P.lprac = P.prac; P.cdoc = P.doc;

export function Icon({ k, size = 17, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[k] || P.home} />
    </svg>
  );
}
