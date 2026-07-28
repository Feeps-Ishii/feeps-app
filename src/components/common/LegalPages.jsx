import React from "react";
import { FileText, ShieldCheck, ArrowLeft } from "lucide-react";
import { T } from "./theme.js";

// 利用規約・プライバシーポリシー。
// 2026-07-28に「法務確認前ドラフト」から実運用向けへ書き直した（本サービスの実装に即した内容へ）。
// プライバシーポリシーは個人情報保護法の公表事項（法32条・利用目的の特定・開示等の請求手続）に沿った構成にしている。
//
// 事業者情報だけは実在の情報が必要なため OPERATOR に集約した。**ここを埋めれば全ページへ反映される。**
// 未記入の項目がある間は、その旨の注意書きを自動で表示する（架空の住所・窓口は絶対に書かない）。

const OPERATOR = {
  name: "株式会社Feeps",
  address: "〒150-0002　東京都渋谷区渋谷1-1-3 第35荒井ビル7F",
  representative: "代表取締役　寺田 正哉",
  tel: "03-6821-6039",
  email: "info@feeps.co.jp",
  privacyManager: "",    // 任意。個人情報の管理責任者（部署名・役職。未設定なら表示しない）
  court: "",             // 任意。専属的合意管轄裁判所。未設定なら管轄の条文を出さない
};

// 社外公開に必須の項目。ここが空のときだけ画面に注意書きを出す
const REQUIRED_OPERATOR_FIELDS = { address: "本店所在地", representative: "代表者", email: "メールアドレス" };
const MISSING_OPERATOR_FIELDS = Object.keys(REQUIRED_OPERATOR_FIELDS).filter(key => !OPERATOR[key]);

// 同意の記録に使う版。内容を改定したらこの日付を更新する（利用者へ再同意を求める）
export const TERMS_VERSION = "2026-07-28";

const REVISION_DATE = "2026年7月28日";

function value(key) {
  return OPERATOR[key] || "（未設定）";
}

function PendingNotice() {
  if (MISSING_OPERATOR_FIELDS.length === 0) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-xs font-semibold leading-relaxed" style={{ background: T.warningSubtle, color: T.warning }}>
      次の事業者情報が未設定です: {MISSING_OPERATOR_FIELDS.map(key => REQUIRED_OPERATOR_FIELDS[key]).join("・")}。
      社外への公開前に登記情報・窓口を確認して設定してください。
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="py-4" style={{ borderTop: `1px solid ${T.border}` }}>
      <h2 className="text-sm font-bold" style={{ color: T.textPrimary }}>{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed" style={{ color: T.textSecondary }}>{children}</div>
    </div>
  );
}

function DocHeader({ icon: Icon, title }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: T.accentHover }}><Icon size={18} /></span>
      <div>
        <h1 className="text-xl font-bold" style={{ color: T.textPrimary }}>{title}</h1>
        <p className="text-xs" style={{ color: T.textMuted }}>制定日: {REVISION_DATE}</p>
      </div>
    </div>
  );
}

function DefList({ items }) {
  return (
    <dl className="space-y-1.5">
      {items.map(([term, description]) => (
        <div key={term} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-sm font-semibold sm:w-44" style={{ color: T.textPrimary }}>{term}</dt>
          <dd className="text-sm" style={{ color: T.textSecondary }}>{description}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TermsOfServiceContent() {
  return (
    <div>
      <DocHeader icon={FileText} title="利用規約" />
      <PendingNotice />

      <Section title="第1条（適用範囲）">
        <p>本規約は、{OPERATOR.name}（以下「当社」といいます）が提供する研修管理サービス「Feeps One」（以下「本サービス」といいます）の利用条件を定めるものです。利用者は、本規約に同意のうえ本サービスを利用するものとします。</p>
        <p>当社が本サービス上で個別に定める案内・注意書きは、本規約の一部を構成します。個別の規定と本規約の内容が異なる場合は、個別の規定が優先します。</p>
      </Section>

      <Section title="第2条（定義）">
        <DefList items={[
          ["利用者", "当社が発行したアカウントにより本サービスを利用する個人"],
          ["契約企業", "当社との間で研修に関する契約を締結し、自社の従業員等に本サービスを利用させる法人"],
          ["受講生", "研修を受講する目的で本サービスを利用する利用者"],
          ["講師", "研修の実施・指導を担当する利用者"],
          ["企業担当者", "契約企業において自社の受講生の状況を確認する利用者"],
          ["管理者", "当社において本サービスの運営管理を行う利用者"],
          ["登録データ", "利用者が本サービスへ入力・送信した日報、勤怠、テストの解答、提出物その他の情報"],
        ]} />
      </Section>

      <Section title="第3条（アカウント）">
        <p>本サービスのアカウントは、当社または契約企業からの申込みに基づき当社が発行します。利用者による自己登録はできません。</p>
        <p>利用者は、アカウント情報（メールアドレス、パスワード、二要素認証の認証情報等）を自己の責任において管理するものとし、第三者に利用させ、貸与し、譲渡し、名義を変更し、または売買してはなりません。</p>
        <p>アカウント情報の管理不十分、使用上の過誤、第三者の使用等によって生じた損害の責任は利用者が負うものとし、当社は責任を負いません。ただし、当社の故意または過失による場合を除きます。</p>
        <p>利用者は、アカウント情報の漏えいまたは第三者による不正利用を知った場合、直ちに当社へ連絡するものとします。</p>
      </Section>

      <Section title="第4条（管理者・講師・企業担当者の権限）">
        <p>本サービスは、利用者の役割に応じて閲覧・編集できる範囲を制限しています。契約企業の企業担当者は自社に所属する受講生の情報のみを閲覧できます。</p>
        <p>受講生は、自らが提出した日報・勤怠等について、研修期間中は自ら修正することができます。研修期間の経過後、または誤りの訂正が必要な場合は、講師または管理者が訂正・削除を行うことがあります。</p>
      </Section>

      <Section title="第5条（登録データの取扱い）">
        <p>登録データに関する権利は、利用者または契約企業に帰属します。</p>
        <p>当社は、本サービスの提供、利用者への指導・フィードバック、研修の運営管理、契約企業への報告、および助成金申請等の法令上必要な手続のために登録データを利用します。</p>
        <p>当社は、登録データを個人が特定できない形に加工したうえで、本サービスの改善および統計情報の作成に利用することがあります。</p>
        <p>個人情報の取扱いは、別途定めるプライバシーポリシーによります。</p>
      </Section>

      <Section title="第6条（AI機能の利用）">
        <p>本サービスは、テスト問題の候補作成、記述式解答の採点補助、日報へのコメント案の作成等にAIを利用しています。</p>
        <p>AIによる出力は補助的なものであり、テストの合否、修了の可否その他の評価は、講師または管理者の確認を経て確定します。当社は、AIによる出力の正確性・完全性を保証しません。</p>
      </Section>

      <Section title="第7条（禁止事項）">
        <p>利用者は、本サービスの利用にあたり、次の行為を行ってはなりません。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>法令または公序良俗に違反する行為</li>
          <li>犯罪行為に関連する行為</li>
          <li>当社、他の利用者、契約企業その他の第三者の知的財産権、肖像権、プライバシー、名誉その他の権利または利益を侵害する行為</li>
          <li>本サービスのサーバーまたはネットワークの機能を破壊し、または妨害する行為</li>
          <li>本サービスの運営を妨害するおそれのある行為</li>
          <li>不正アクセスを行い、またはこれを試みる行為</li>
          <li>他の利用者に関する個人情報等を、本サービスの利用目的を超えて収集または蓄積する行為</li>
          <li>他の利用者に成りすます行為、および自己のアカウントを第三者に利用させる行為</li>
          <li>本サービスを通じて取得した情報を、権限なく複製し、または外部へ持ち出す行為</li>
          <li>本サービスの解析、リバースエンジニアリング、その他これに類する行為</li>
          <li>反社会的勢力に対して直接または間接に利益を供与する行為</li>
          <li>その他、当社が不適切と合理的に判断する行為</li>
        </ul>
      </Section>

      <Section title="第8条（本サービスの提供の停止等）">
        <p>当社は、次のいずれかの事由があると判断した場合、利用者へ事前に通知することなく、本サービスの全部または一部の提供を停止または中断することができます。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスにかかるシステムの保守点検または更新を行う場合</li>
          <li>地震、落雷、火災、停電、天災その他の不可抗力により本サービスの提供が困難となった場合</li>
          <li>コンピュータまたは通信回線等が事故により停止した場合</li>
          <li>その他、当社が本サービスの提供が困難と判断した場合</li>
        </ul>
        <p>当社は、本条に基づく提供の停止または中断により利用者に生じた損害について、当社の故意または重過失による場合を除き、責任を負いません。</p>
      </Section>

      <Section title="第9条（利用の制限および登録の抹消）">
        <p>当社は、利用者が本規約のいずれかの条項に違反した場合、または契約企業との契約が終了した場合、事前に通知することなく、当該利用者について本サービスの利用を制限し、またはアカウントを削除することができます。</p>
        <p>アカウント削除後の登録データの取扱いは、契約企業との契約およびプライバシーポリシーの定めによります。</p>
      </Section>

      <Section title="第10条（保証の否認および免責事項）">
        <p>当社は、本サービスが利用者の特定の目的に適合すること、期待する機能・正確性・有用性を有すること、および不具合が生じないことを保証しません。</p>
        <p>当社は、本サービスに関して利用者に生じた損害について、当社の故意または重過失による場合を除き、責任を負いません。</p>
        <p>当社が損害賠償責任を負う場合であっても、その範囲は、通常生じうる直接かつ現実の損害に限られ、かつ当該損害が発生した月に当社が当該利用者に係る契約企業から受領した利用料相当額を上限とします。</p>
      </Section>

      <Section title="第11条（サービス内容の変更・終了）">
        <p>当社は、利用者に通知したうえで、本サービスの内容を変更し、または本サービスの提供を終了することができます。提供を終了する場合、当社は、契約企業に対し、登録データの取扱いについて事前に協議します。</p>
      </Section>

      <Section title="第12条（反社会的勢力の排除）">
        <p>利用者は、自らが暴力団、暴力団員、暴力団準構成員、暴力団関係企業、総会屋その他これらに準ずる者（以下「反社会的勢力」といいます）に該当しないこと、および反社会的勢力と社会的に非難されるべき関係を有しないことを表明し、保証します。</p>
      </Section>

      <Section title="第13条（本規約の変更）">
        <p>当社は、次の場合に本規約を変更することができます。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>本規約の変更が、利用者の一般の利益に適合するとき</li>
          <li>本規約の変更が、契約の目的に反せず、かつ変更の必要性、変更後の内容の相当性その他の事情に照らして合理的なものであるとき</li>
        </ul>
        <p>当社は、本規約を変更する場合、変更後の内容および効力発生日を、本サービス上への掲示または契約企業を通じた通知により、効力発生日の相当期間前に周知します。</p>
      </Section>

      <Section title="第14条（準拠法）">
        <p>本規約の解釈にあたっては、日本法を準拠法とします。</p>
        {OPERATOR.court && <p>本サービスに関して紛争が生じた場合には、{OPERATOR.court}を第一審の専属的合意管轄裁判所とします。</p>}
      </Section>

      <Section title="第15条（事業者情報・お問い合わせ）">
        <DefList items={[
          ["事業者名", OPERATOR.name],
          ["本店所在地", value("address")],
          ["代表者", value("representative")],
          ["電話番号", value("tel")],
          ["メールアドレス", value("email")],
        ]} />
      </Section>
    </div>
  );
}

export function PrivacyPolicyContent() {
  return (
    <div>
      <DocHeader icon={ShieldCheck} title="プライバシーポリシー" />
      <PendingNotice />

      <Section title="1. 基本方針">
        <p>{OPERATOR.name}（以下「当社」といいます）は、研修管理サービス「Feeps One」（以下「本サービス」といいます）の提供にあたり取得する個人情報を、個人情報の保護に関する法律その他の関係法令およびガイドラインを遵守して取り扱います。</p>
      </Section>

      <Section title="2. 取得する個人情報">
        <DefList items={[
          ["利用者に関する情報", "氏名、メールアドレス、所属企業名、役割（受講生・講師・企業担当者・管理者）"],
          ["研修の記録", "出退勤の打刻時刻、日報の内容、講師のコメント、指導記録（カルテ）"],
          ["学習の記録", "教材の閲覧・進捗状況、テストの解答および得点、演習の提出内容"],
          ["助成金申請に関する情報", "雇用形態、新卒・既卒の区分、実務経験、提出書類"],
          ["契約企業に関する情報", "会社名、所在地、電話番号、担当者名、法人番号、資本金、代表者"],
          ["接続に関する情報", "アクセス日時、操作の記録、ブラウザおよび端末に関する情報"],
        ]} />
        <p>当社は、クレジットカード番号等の決済情報、個人番号（マイナンバー）、および要配慮個人情報を本サービスでは取得しません。</p>
      </Section>

      <Section title="3. 利用目的">
        <p>当社は、取得した個人情報を次の目的の範囲内で利用します。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの提供、本人確認および利用者の認証</li>
          <li>研修の運営、受講状況・出欠の管理、指導およびフィードバックの実施</li>
          <li>学習到達度の評価、修了判定および修了証の発行</li>
          <li>契約企業に対する、当該企業に所属する受講生の受講状況の報告</li>
          <li>助成金の申請その他法令に基づく手続に必要な書類の作成</li>
          <li>利用者からの問い合わせへの対応</li>
          <li>本サービスに関する重要な連絡・通知</li>
          <li>不正利用の防止および本規約に違反する行為への対応</li>
          <li>本サービスの品質向上および新機能の検討（個人を特定できない形へ加工したうえで行います）</li>
        </ul>
        <p>当社は、利用目的を変更する場合、変更前の目的と関連性を有すると合理的に認められる範囲で行い、変更後の目的を本人へ通知または公表します。</p>
      </Section>

      <Section title="4. 第三者提供">
        <p>当社は、次の場合を除き、あらかじめ本人の同意を得ることなく個人情報を第三者へ提供しません。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>法令に基づく場合</li>
          <li>人の生命、身体または財産の保護のために必要があり、本人の同意を得ることが困難であるとき</li>
          <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要があるとき</li>
        </ul>
        <p>契約企業の企業担当者に対して、当該企業に所属する受講生の受講状況を開示することは、研修の委託契約の履行として行うものであり、第三者提供にはあたりません。なお、講師が記録する指導記録のうち、当社内部の検討のために作成したものは企業担当者へ開示しません。</p>
      </Section>

      <Section title="5. 業務の委託">
        <p>当社は、利用目的の達成に必要な範囲で個人情報の取扱いを外部へ委託することがあります。委託先に対しては、必要かつ適切な監督を行います。</p>
        <p>本サービスの稼働基盤には、アマゾン ウェブ サービス（AWS）を利用しています。データはいずれも日本国内のリージョンに保存されます。AI機能にはAWSが提供する Amazon Bedrock を利用しており、処理は日本国内のリージョンで完結します。入力した内容がAIモデルの学習に利用されることはありません。</p>
      </Section>

      <Section title="6. 外国にある第三者への提供">
        <p>当社は、本サービスの提供にあたり、個人情報を外国にある第三者へ提供していません。</p>
      </Section>

      <Section title="7. 安全管理措置">
        <p>当社は、個人情報の漏えい、滅失または毀損の防止その他の安全管理のために、次の措置を講じています。</p>
        <DefList items={[
          ["組織的措置", "役割に応じてアクセスできる範囲を限定し、日報・勤怠の編集・削除・復元および権限付与の操作を記録しています"],
          ["人的措置", "個人情報を取り扱う従業者に対し、取扱いに関する周知を行っています"],
          ["物理的措置", "自社でサーバーを保有せず、AWSのデータセンターの管理策に依拠しています"],
          ["技術的措置", "通信はすべて暗号化（HTTPS/TLS）し、保存データも暗号化しています。閲覧・編集の可否はサーバー側で判定し、認証アプリによる二要素認証を利用できます"],
        ]} />
      </Section>

      <Section title="8. 保存期間">
        <p>当社は、個人情報を利用目的の達成に必要な期間、または法令で定められた期間保存します。</p>
        <p>研修の記録は、助成金の支給申請および契約企業への報告の根拠資料となるため、契約企業との契約が終了した後も、法令上必要とされる期間は保存します。保存期間の経過後は、適切な方法で削除します。</p>
        <p>本サービスにおける日報・勤怠等の削除は、記録の追跡可能性を確保するため、一覧および集計から除外する方式（論理削除）で行われます。この場合もデータは上記の保存期間に従って管理されます。</p>
      </Section>

      <Section title="9. 開示等の請求">
        <p>利用者は、当社が保有する自己の個人情報について、利用目的の通知、開示、内容の訂正・追加・削除、利用の停止・消去、および第三者への提供の停止を請求することができます。</p>
        <p>請求は、下記のお問い合わせ窓口へご連絡ください。ご本人であることを確認したうえで、法令の定めに従い、合理的な期間内に対応します。なお、法令により開示等の義務を負わない場合は、その旨とその理由をご連絡します。</p>
      </Section>

      <Section title="10. Cookie・localStorageの利用">
        <p>本サービスは、ログイン状態の維持および表示設定（サイドバーの開閉状態、直近に閲覧していた画面等）の保持のために、ブラウザのlocalStorageを利用します。</p>
        <p>ログイン状態は、最後の認証から24時間で終了します。以後は再度ログインが必要です。</p>
        <p>広告配信および行動ターゲティングを目的としたCookieの利用、ならびに第三者への情報提供は行っていません。</p>
        <p>日報・勤怠・学習の記録等の業務データは、ブラウザではなく当社のサーバーに保存されます。</p>
      </Section>

      <Section title="11. 本ポリシーの変更">
        <p>当社は、法令の改正または本サービスの内容の変更に応じて、本ポリシーを変更することがあります。重要な変更を行う場合は、本サービス上への掲示または契約企業を通じた通知により周知します。</p>
      </Section>

      <Section title="12. お問い合わせ窓口">
        <DefList items={[
          ["事業者名", OPERATOR.name],
          ["本店所在地", value("address")],
          ["代表者", value("representative")],
          ["電話番号", value("tel")],
          ["メールアドレス", value("email")],
          ...(OPERATOR.privacyManager ? [["個人情報の管理責任者", OPERATOR.privacyManager]] : []),
        ]} />
        <p>個人情報の取扱いに関する苦情の申出先として、個人情報保護委員会へ申し出ることもできます。</p>
      </Section>
    </div>
  );
}

// ログイン後（認証済み）画面用。アプリのヘッダー/サイドバーは呼び出し元(TrainingApp.jsx)が描画するため、
// ここではコンテンツ本体のみを1枚のカードで返す。
export function LegalPageView({ doc }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl p-6 sm:p-8" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
        {doc === "privacy" ? <PrivacyPolicyContent /> : <TermsOfServiceContent />}
      </div>
    </div>
  );
}

// ログイン前（未認証）画面用のスタンドアロン表示。アプリのヘッダー/サイドバーを持たない。
export function StandaloneLegalPage({ doc, onBack }) {
  return (
    <div className="min-h-screen" style={{ background: T.bgBase, minHeight: "100dvh" }}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: T.accent }}>
          <ArrowLeft size={16} />ログインへ戻る
        </button>
        <div className="rounded-2xl p-6 sm:p-8" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
          {doc === "privacy" ? <PrivacyPolicyContent /> : <TermsOfServiceContent />}
        </div>
      </div>
    </div>
  );
}
