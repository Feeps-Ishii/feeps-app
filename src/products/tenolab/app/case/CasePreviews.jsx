import React from "react";

/* 案件体験の一覧のプレビュー（2026-10-15、モック docs/design/mockups/devhub-learning-2026-10/devhub-case-previews.html）。
   お客さまの画面・データの「いまの状態」を小さく描き、作るところは蛍光ペン（x-hl）、不具合のところは赤い丸（x-ring）で示す。
   案件の id ごとに絵を持つ。無い案件は cards.jsx の CasePreview がこれまでどおり（作る画面・サムネイル・チケット）出す。
   クラスは x- で始める（Tailwind の ring・grid などとぶつからないように） */

const Win = ({ url, children, cls = "" }) => (
  <div className={`x-win ${cls}`}><div className="x-bar"><i /><i /><i /><span>{url}</span></div><div className="x-pg">{children}</div></div>
);
const Say = ({ at, y, children }) => <span className={`x-say ${y ? "y" : ""}`} style={at}>{children}</span>;
const Ring = ({ at }) => <span className="x-ring" style={at} />;
const Lab = ({ children }) => <div className="x-lab">{children}</div>;
const In = ({ children, ghost, w, bad }) => <div className={`x-in ${ghost ? "ghost" : ""} ${bad ? "bad" : ""}`} style={w ? { width: w } : undefined}>{children}</div>;
const SiteHead = ({ name = "みなと文具", items = [], right }) => (
  <div className="x-sh"><b>{name}</b>{items.map(t => <span key={t}>{t}</span>)}<span className="gap" />{right && <span>{right}</span>}</div>
);

export const CASE_PREVIEWS = {
  "web-contact-form": () => (
    <>
      <Win url="minato-bungu.jp/contact.html">
        <SiteHead items={["商品", "店舗", "お知らせ"]} right="お問い合わせ" />
        <div className="x-h">お問い合わせ</div>
        <div className="x-hl" style={{ marginTop: 6, padding: "4px 6px", width: "66%" }}>
          <Lab>お名前</Lab><In ghost /><Lab>メールアドレス</Lab><In ghost /><Lab>種類</Lab><In ghost w="50%" />
        </div>
        <Say y at={{ left: "72%", top: "52%" }}>ここを作る</Say>
      </Win>
    </>
  ),
  "web-sidebar-layout": () => (
    <Win url="minato-bungu.jp/news.html ・ 1280px">
      <SiteHead items={["お知らせ"]} />
      <div className="x-lay">
        <div className="x-main"><div className="x-h s">秋の新商品フェア</div><div className="x-ln" /><div className="x-ln" style={{ width: "92%" }} /><div className="x-ln" style={{ width: "80%" }} /></div>
        <div className="x-side" style={{ width: "44%" }}><b>カテゴリ</b><div className="x-ln b" /><div className="x-ln b" style={{ width: "70%" }} /></div>
      </div>
      <Ring at={{ left: "3%", top: "48%", width: "54%", height: "46%" }} />
      <Say at={{ left: "58%", top: "62%" }}>横に並ばない</Say>
    </Win>
  ),
  "js-cart-total": () => (
    <Win url="minato-bungu.jp/cart.html">
      <table className="x-cart"><thead><tr><th>商品</th><th>単価</th><th>数量</th></tr></thead>
        <tbody><tr><td>方眼ノート A5</td><td>¥480</td><td><span className="x-qty">3</span></td></tr><tr><td>ゲルインクペン 0.5</td><td>¥220</td><td><span className="x-qty">5</span></td></tr></tbody></table>
      <div className="x-sum x-hl"><span>小計</span><b>¥ ---</b><span>送料</span><b>¥ ---</b><span className="t">合計</span><b>¥ ---</b></div>
      <Say y at={{ left: "6%", top: "70%" }}>自動で計算</Say>
    </Win>
  ),
  "js-signup-check": () => (
    <Win url="minato-bungu.jp/signup.html">
      <div className="x-h">会員登録</div>
      <div style={{ width: "62%" }}><Lab>お名前</Lab><In /><Lab>メールアドレス</Lab><In>sato@example.com</In><span className="x-btn">登録する</span></div>
      <span className="x-toast">✓ 登録しました</span>
      <Ring at={{ left: "1%", top: "22%", width: "68%", height: "34%" }} />
      <Say at={{ left: "46%", top: "16%" }}>空でも通る</Say>
    </Win>
  ),
  "rsv-validation": () => (
    <Win url="reserve.example.jp/form">
      <SiteHead name="炭火ダイニング 灯" items={["メニュー", "店舗"]} right="ご予約" />
      <div className="x-hl" style={{ marginTop: 4, padding: "3px 6px", width: "64%" }}>
        <Lab>お名前</Lab><In />
        <Lab>人数</Lab><In w="40%">0 名</In>
        <Lab>日付</Lab><In w="60%">2026/10/01</In>
      </div>
      <span className="x-btn" style={{ marginTop: 4 }}>予約する</span>
      <Say y at={{ left: "70%", top: "48%" }}>チェックを作る</Say>
    </Win>
  ),
  "java-estimate": () => (
    <Win url="localhost:8080/estimate">
      <SiteHead name="見積もりツール" items={["営業部"]} />
      <table className="x-cart"><thead><tr><th>品名</th><th>単価</th><th>数量</th></tr></thead>
        <tbody><tr><td>コピー用紙 A4</td><td>¥520</td><td><span className="x-qty">8</span></td></tr><tr><td>ファイル 10冊</td><td>¥980</td><td><span className="x-qty">4</span></td></tr></tbody></table>
      <div className="x-sum x-hl"><span>小計</span><b>---</b><span>割引</span><b>---</b><span>消費税</span><b>---</b><span className="t">合計</span><b>---</b></div>
      <Say y at={{ left: "6%", top: "68%" }}>計算を入れる</Say>
    </Win>
  ),
  "java-member-rank": () => (
    <Win url="localhost:8080/member/rank">
      <SiteHead name="みなと文具 会員ページ" />
      <div className="x-h s">会員ランクの確認</div>
      <Lab>年間の購入金額</Lab>
      <div style={{ display: "flex", gap: 6, alignItems: "center", width: "70%" }}><In w="60%">50,000 円</In><span className="x-btn" style={{ marginTop: 0 }}>確認</span></div>
      <div className="x-result">ランク：<b>シルバー</b></div>
      <Ring at={{ left: "0%", top: "42%", width: "46%", height: "28%" }} />
      <Say at={{ left: "48%", top: "48%" }}>ゴールドのはず</Say>
    </Win>
  ),
  "java-monthly-sales": () => (
    <Win url="localhost:8080/admin/sales">
      <SiteHead name="売上管理" items={["店長"]} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}><Lab>月</Lab><In w="22%">10 月</In><span className="x-btn" style={{ marginTop: 0 }}>集計</span></div>
      <div className="x-sum x-hl" style={{ marginLeft: 0, width: "60%" }}><span>合計</span><b>---</b><span>件数</span><b>---</b><span>平均</span><b>---</b></div>
      <Say y at={{ left: "66%", top: "56%" }}>月ごとに集計</Say>
    </Win>
  ),
  "db-dept-report": () => (
    <>
      <div className="x-xls"><div className="x-xbar">部署別人件費_10月.xlsx</div>
        <table><tbody><tr><th>部署</th><th>人数</th><th>人件費（月）</th></tr>
          {["経理部", "研究部", "営業部", "業務部"].map(d => <tr key={d}><td>{d}</td><td className="x-hl" /><td className="x-hl" /></tr>)}</tbody></table>
      </div>
      <div className="x-ref"><span>emp 14件</span><span>dept 4件</span></div>
      <Say y at={{ left: "58%", top: "30%" }}>SQLで出す</Say>
    </>
  ),
  "db-emp-list-bug": () => (
    <>
      <div className="x-term"><div className="x-tbar"><span className="on">社員一覧</span><span>結果 13件</span></div>
        <table className="x-grid"><thead><tr><th>社員番号</th><th>氏名</th><th>部署</th></tr></thead>
          <tbody><tr><td>7369</td><td>SMITH</td><td>研究部</td></tr><tr><td>7499</td><td>ALLEN</td><td>営業部</td></tr><tr><td>7521</td><td>WARD</td><td>営業部</td></tr><tr className="empty"><td>？</td><td>……</td><td>……</td></tr></tbody></table>
      </div>
      <Ring at={{ left: "8%", top: "64%", width: "60%", height: "20%" }} />
      <Say at={{ left: "56%", top: "82%" }}>社員は14人のはず</Say>
    </>
  ),
};
