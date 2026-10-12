// LMS から DevHub Learning を開くときのアドレス（2026-10-12、ADR 0026）。
// app.devhub-lms.com で開いているときは learn.devhub-lms.com へ。それ以外（今の CloudFront のアドレス・ローカル）は同じサイトの lab.html。
// 別のサイトになるので、learn. ではログインし直しになる。
export function learningHref(hash = "#/home") {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (host === "app.devhub-lms.com") return `https://learn.devhub-lms.com/${hash}`;
  return `/lab.html${hash}`;
}
