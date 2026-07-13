import React from "react";
import { FileText, ShieldCheck, ArrowLeft } from "lucide-react";
import { T } from "./theme.js";

// Phase7-4b: 利用規約・プライバシーポリシーのドラフト。
// 正式な法務文書ではなく、公開前に専門家確認が必要な「法務確認前ドラフト」として扱う
// （docs/specs/legal-docs-review-todo.md にレビューTODOを記録済み）。
// 会社名・住所・問い合わせ先等、未確定の情報は「正式情報要確認」と明記し、架空情報は入れない。

const REVISION_DATE = "2026-07-13（ドラフト作成日）";

function DraftNotice() {
  return (
    <div className="rounded-xl px-4 py-3 text-xs font-semibold leading-relaxed" style={{ background: T.warningSubtle, color: T.warning }}>
      本ページは法務確認前のドラフトです。正式版として公開する前に、弁護士等の専門家によるレビューが必要です。
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

export function TermsOfServiceContent() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: T.accentHover }}><FileText size={18} /></span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: T.textPrimary }}>利用規約</h1>
          <p className="text-xs" style={{ color: T.textMuted }}>改定日: {REVISION_DATE}</p>
        </div>
      </div>
      <DraftNotice />
      <Section title="第1条（適用）">
        <p>本規約は、株式会社Feeps（以下「当社」といいます。会社住所・登記情報は正式情報要確認）が提供する「Feeps One」（以下「本サービス」）の利用条件を定めるものです。本サービスを利用するすべてのお客様（以下「利用者」）は、本規約に同意のうえ本サービスを利用するものとします。</p>
      </Section>
      <Section title="第2条（アカウント管理）">
        <p>利用者は、本サービスの利用にあたり発行されるアカウント情報（メールアドレス・パスワード等）を自己の責任において適切に管理するものとし、第三者に利用させ、または貸与、譲渡、名義変更、売買等をしてはならないものとします。</p>
      </Section>
      <Section title="第3条（禁止事項）">
        <p>利用者は本サービスの利用にあたり、法令または公序良俗に違反する行為、当社または第三者の知的財産権・プライバシー・名誉その他の権利を侵害する行為、本サービスの運営を妨害する行為、不正アクセスその他コンピュータウイルス等有害なプログラムを使用または提供する行為を行ってはならないものとします。</p>
      </Section>
      <Section title="第4条（サービス提供）">
        <p>当社は、利用者にあらかじめ通知することなく、本サービスの内容を変更し、または本サービスの提供を中断・停止することがあります。当社は、これによって利用者に生じた損害について、当社に故意または重過失がある場合を除き、責任を負わないものとします。</p>
      </Section>
      <Section title="第5条（知的財産権）">
        <p>本サービスに関する知的財産権は、当社または当社にライセンスを許諾している者に帰属し、利用者に対して本サービスの利用に必要な範囲を超えて許諾されるものではありません。</p>
      </Section>
      <Section title="第6条（利用停止・登録抹消）">
        <p>当社は、利用者が本規約のいずれかの条項に違反した場合、事前の通知なく、当該利用者に対して本サービスの全部もしくは一部の利用を制限し、またはアカウントを削除することができるものとします。</p>
      </Section>
      <Section title="第7条（免責事項）">
        <p>当社は、本サービスに事実上または法律上の瑕疵がないことを明示的にも黙示的にも保証しておりません。当社は、本サービスに起因して利用者に生じたあらゆる損害について、当社の故意または重過失による場合を除き、一切の責任を負わないものとします。</p>
      </Section>
      <Section title="第8条（規約の変更）">
        <p>当社は、必要と判断した場合には、利用者への事前の通知をもって本規約を変更できるものとします。変更後の利用規約は、当社が別途定める場合を除いて、本サービス上に表示した時点より効力を生じるものとします。</p>
      </Section>
      <Section title="第9条（準拠法・管轄裁判所）">
        <p>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします（管轄裁判所の詳細は正式情報要確認）。</p>
      </Section>
      <Section title="第10条（お問い合わせ）">
        <p>本規約に関するお問い合わせは、以下の窓口までご連絡ください（問い合わせ先は正式情報要確認）。</p>
      </Section>
    </div>
  );
}

export function PrivacyPolicyContent() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: T.accentHover }}><ShieldCheck size={18} /></span>
        <div>
          <h1 className="text-xl font-bold" style={{ color: T.textPrimary }}>プライバシーポリシー</h1>
          <p className="text-xs" style={{ color: T.textMuted }}>改定日: {REVISION_DATE}</p>
        </div>
      </div>
      <DraftNotice />
      <Section title="1. 取得する情報">
        <p>当社は、本サービスの提供にあたり、氏名、メールアドレス、所属企業名、研修・学習履歴、勤怠・日報等の業務データ、スキル・ポートフォリオ情報、その他利用者が本サービスに入力する情報を取得します。</p>
      </Section>
      <Section title="2. 利用目的">
        <p>取得した情報は、本サービスの提供・維持・改善、利用者からのお問い合わせへの対応、本サービスに関する重要なお知らせの通知、利用規約に違反する行為への対応のために利用します。</p>
      </Section>
      <Section title="3. 第三者提供">
        <p>当社は、法令に基づく場合を除き、あらかじめ利用者の同意を得ることなく、第三者に個人情報を提供しません。ただし、本サービスの提供に必要な範囲でクラウドインフラ事業者等の業務委託先に取り扱いを委託する場合があります。</p>
      </Section>
      <Section title="4. 外部サービス">
        <p>本サービスは、認証基盤（Amazon Cognito）、AI機能（Amazon Bedrock）等のクラウドサービスを利用しています。これらのサービス事業者における個人情報の取り扱いは、各社のプライバシーポリシーに従います。</p>
      </Section>
      <Section title="5. 安全管理措置">
        <p>当社は、取得した個人情報の漏えい、滅失またはき損の防止その他の安全管理のために必要かつ適切な措置を講じます。</p>
      </Section>
      <Section title="6. 保存期間">
        <p>個人情報は、利用目的の達成に必要な期間、または法令で定める期間保存し、期間経過後は適切に削除します（具体的な保存期間は正式情報要確認）。</p>
      </Section>
      <Section title="7. 開示・訂正・削除等の請求">
        <p>利用者は、当社が保有する自己の個人情報について、開示、訂正、利用停止、削除を請求することができます。請求の方法は、以下のお問い合わせ窓口までご連絡ください（正式情報要確認）。</p>
      </Section>
      <Section title="8. Cookie / localStorageの利用">
        <p>本サービスは、ログイン状態の維持、表示設定（サイドバー開閉状態、直近閲覧画面等）の保持のためにブラウザのlocalStorageを利用します。研修進捗・日報・勤怠等の業務データは、localStorageではなく当社サーバー（DynamoDB）に保存されます（詳細は<code>docs/specs/db-first-persistence-policy.md</code>参照）。</p>
      </Section>
      <Section title="9. ポリシーの変更">
        <p>当社は、必要に応じて本ポリシーを変更することがあります。変更後のプライバシーポリシーは、本サービス上に表示した時点から効力を生じるものとします。</p>
      </Section>
      <Section title="10. お問い合わせ">
        <p>本ポリシーに関するお問い合わせは、以下の窓口までご連絡ください（問い合わせ先は正式情報要確認）。</p>
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
