import React, { useState } from "react";
import {
  Activity, AlertCircle, ArrowUpRight, ChevronRight, Download,
  Receipt, ShieldCheck, Sparkles, Upload
} from "lucide-react";
import { ANALYTICS_HOME_CARDS, RISK_SIG_LABEL } from "./AnalyticsCatalog.js";
import { useAwsCosts, useRiskAnalysis } from "./useAnalytics.js";
import { Card, Badge, Btn, Avatar, Stat, SectionHead, PageHeader, ProductNavCard, T, EmptyState as CommonEmptyState } from "../../components/common";

const GRAD = `linear-gradient(135deg, ${T.accent} 0%, #5B8CFF 100%)`;
const adminPanelStyle = { background: T.bgBase, color: T.textMuted };

function Bar({ value, tone = "cyan" }) {
  const t = { cyan: T.accent, green: T.success, amber: T.warning };
  return <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: T.border }}>
    <div className="h-full rounded-full" style={{ width: `${value}%`, background: t[tone], transition: "width .8s ease" }} /></div>;
}
function EmptyState({ title, desc }) {
  return <CommonEmptyState icon={Activity} title={title} desc={desc} />;
}
function riskLevel(s) {
  return s >= 70 ? { k: "高", tone: "red", col: T.danger } : s >= 40 ? { k: "中", tone: "amber", col: T.warning } : { k: "低", tone: "green", col: T.success };
}
const fmtAmt = (amount) => {
  const n = parseFloat(amount || 0);
  if (n === 0) return "$0.00";
  return n < 0.01 ? "< $0.01" : `$${n.toFixed(2)}`;
};
const featureLabel = (f) => ({ quizGenerate: "テスト問題生成", testEvaluate: "テスト採点" })[f] || f || "その他";
const fmtTokens = (n) => !n ? "0" : n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

export function AnalyticsHome({ goSub, themeColor = T.danger }) {
  return (
    <div>
      <PageHeader
        product="analytics"
        label="分析・レポート"
        title="育成の成果を、データで見る。"
        description="AWS利用料金・月次レポート・リスク分析を一元管理します。研修の運用状況を数値で把握できます。"
      />
      <div className="grid gap-4 md:grid-cols-3">
        {ANALYTICS_HOME_CARDS.map(({ key, icon, label, desc, ready }, i) => (
          <ProductNavCard key={key} product="analytics" icon={icon} title={label}
            desc={ready ? desc : desc + "（準備中）"}
            onClick={() => goSub(key)} delay={650 + i * 60} />
        ))}
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl p-4" style={{ background: `${themeColor}08`, border: `1px solid ${themeColor}20` }}>
        <Activity size={15} style={{ color: themeColor, marginTop: 2 }} />
        <p className="text-sm" style={{ color: T.textMuted }}><span className="font-semibold" style={{ color: T.textPrimary }}>管理者専用：</span>この画面は管理者のみが閲覧できます。研修管理プロダクトのホームでもリスクアラートを確認できます。</p>
      </div>
    </div>
  );
}

export function AwsCostDashboard() {
  const { data, loading, err, aiData, aiErr, month, setMonth } = useAwsCosts();

  if (loading) return (
    <div>
      <SectionHead title="AWS利用料金" desc="Cost Explorerからリアルタイムでお使いのAWS料金を取得します" />
      <div className="rounded-xl px-4 py-10 text-center text-sm" style={{ background: T.bgBase, color: T.textMuted }}>データを取得中...</div>
    </div>
  );

  return (
    <div>
      <SectionHead title="AWS利用料金" desc="Feeps One リソース（Project=FeepsOne タグ）の利用料金と AI コストを確認します（最大24時間遅延）" />
      {err && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{err}</div>}
      {data && !data.tagEnabled && data.tagNote && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: T.warningSubtle, color: T.warning }}>
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{data.tagNote}</span>
          </div>
        </div>
      )}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-semibold" style={{ color: T.textPrimary }}>対象月</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="rounded-lg border px-3 py-1.5 text-sm outline-none" style={{ borderColor: T.border, color: T.textPrimary, background: "#fff" }} />
      </div>
      {data && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Receipt} label="今月合計" value={fmtAmt(data.total?.amount)} tone="cyan" />
            <Stat icon={Sparkles} label="Bedrock料金" value={fmtAmt(data.bedrock?.amount)} tone="amber" />
            <Stat icon={Activity} label="Cost Explorer API料金" value={fmtAmt(data.costExplorerApi?.amount)} tone="amber" />
            <Stat icon={Activity} label="サービス数" value={`${data.byService?.length || 0}件`} tone="green" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                <span className="text-sm font-bold" style={{ color: T.textPrimary }}>サービス別料金</span>
              </div>
              {(data.byService || []).length === 0 ? (
                <div className="px-4 py-6 text-center text-sm" style={{ color: T.textMuted }}>
                  {data.tagEnabled ? "データなし" : "タグが有効化されると表示されます"}
                </div>
              ) : (
                <div>
                  {(data.byService || []).slice(0, 15).map((s, i) => (
                    <div key={s.service} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: i ? `1px solid ${T.border}` : "none" }}>
                      <span className="truncate text-sm" style={{ color: T.textSecondary, maxWidth: "65%" }}>{s.service}</span>
                      <span className="shrink-0 text-sm font-semibold" style={{ color: parseFloat(s.amount) > 0 ? T.textPrimary : T.textMuted }}>{fmtAmt(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <div className="flex flex-col gap-4">
              <Card>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span className="text-sm font-bold" style={{ color: T.textPrimary }}>Amazon Bedrock</span>
                </div>
                <div className="px-4 py-4">
                  <div className="text-2xl font-extrabold" style={{ color: T.accentHover }}>{fmtAmt(data.bedrock?.amount)}</div>
                  <div className="mt-1 text-xs" style={{ color: T.textMuted }}>AI機能利用料金（{month.replace("-", "/")}）</div>
                  {(data.bedrock?.services || []).length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {(data.bedrock.services || []).slice(0, 3).map(s => (
                        <div key={s.service} className="flex justify-between gap-3 text-xs">
                          <span className="truncate" style={{ color: T.textMuted }}>{s.service}</span>
                          <span className="shrink-0 font-semibold" style={{ color: T.textSecondary }}>{fmtAmt(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {data.bedrockNote && <div className="mt-2 text-xs leading-relaxed" style={{ color: T.textMuted }}>{data.bedrockNote}</div>}
                </div>
              </Card>
              <Card>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span className="text-sm font-bold" style={{ color: T.textPrimary }}>Cost Explorer API料金</span>
                </div>
                <div className="px-4 py-4">
                  <div className="text-2xl font-extrabold" style={{ color: T.warning }}>{fmtAmt(data.costExplorerApi?.amount)}</div>
                  <div className="mt-1 text-xs" style={{ color: T.textMuted }}>タグ付きFeepsOne料金とは別枠のAPI利用料金</div>
                  {(data.costExplorerApi?.services || []).length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {(data.costExplorerApi.services || []).map(s => (
                        <div key={s.service} className="flex justify-between gap-3 text-xs">
                          <span className="truncate" style={{ color: T.textMuted }}>{s.service}</span>
                          <span className="shrink-0 font-semibold" style={{ color: T.textSecondary }}>{fmtAmt(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
              <Card>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span className="text-sm font-bold" style={{ color: T.textPrimary }}>コンポーネント別料金</span>
                </div>
                <div className="px-4 py-3">
                  {!data.tagEnabled ? (
                    <div className="text-xs" style={{ color: T.textMuted }}>タグが有効化されると表示されます。</div>
                  ) : data.tagNote ? (
                    <div className="text-xs" style={{ color: T.textMuted }}>{data.tagNote}</div>
                  ) : (
                    <div className="space-y-1.5">
                      {(data.byTag || []).map(t => (
                        <div key={t.tag} className="flex justify-between text-sm">
                          <span style={{ color: T.textSecondary }}>{t.tag}</span>
                          <span className="font-semibold" style={{ color: T.textPrimary }}>{fmtAmt(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
          {data.retrievedAt && (
            <p className="mt-3 text-xs" style={{ color: T.textMuted }}>
              最終取得: {new Date(data.retrievedAt).toLocaleString("ja-JP")} / {data.cache?.hit ? "キャッシュから表示" : "Cost Explorerから取得してキャッシュ保存"} / Cost Explorerのデータは最大24時間遅延することがあります
            </p>
          )}
        </>
      )}
      <div className="mt-8 border-t pt-6" style={{ borderColor: T.border }}>
        <div className="mb-4">
          <h3 className="text-base font-bold" style={{ color: T.textPrimary }}>Feeps One AI利用料金</h3>
          <p className="text-xs" style={{ color: T.textMuted }}>アプリ内 Bedrock 呼び出しログから集計（推定値）</p>
        </div>
        {aiErr && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{aiErr}</div>}
        {aiData && (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={Sparkles} label="今月推定料金" value={aiData.totalRequests === 0 ? "$0.00" : `$${parseFloat(aiData.totalEstimatedCostUsd || 0).toFixed(4)}`} tone="amber" />
              <Stat icon={Activity} label="AI利用回数" value={`${aiData.totalRequests || 0}回`} tone="cyan" />
              <Stat icon={Upload} label="入力トークン" value={fmtTokens(aiData.totalInputTokens)} tone="green" />
              <Stat icon={Download} label="出力トークン" value={fmtTokens(aiData.totalOutputTokens)} tone="green" />
            </div>
            {aiData.totalRequests === 0 ? (
              <div className="rounded-xl px-4 py-6 text-center text-sm" style={{ background: T.bgBase, color: T.textMuted }}>まだ AI 機能の利用記録がありません。</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <span className="text-sm font-bold" style={{ color: T.textPrimary }}>機能別利用</span>
                  </div>
                  <div>
                    {(aiData.byFeature || []).map((f, i) => (
                      <div key={f.feature} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: i ? `1px solid ${T.border}` : "none" }}>
                        <span className="text-sm" style={{ color: T.textSecondary }}>{featureLabel(f.feature)}</span>
                        <div className="text-right">
                          <div className="text-sm font-semibold" style={{ color: T.textPrimary }}>${parseFloat(f.estimatedCostUsd || 0).toFixed(4)}</div>
                          <div className="text-xs" style={{ color: T.textMuted }}>{f.requests}回 / {fmtTokens((f.inputTokens || 0) + (f.outputTokens || 0))}tok</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <span className="text-sm font-bold" style={{ color: T.textPrimary }}>直近の AI 利用</span>
                  </div>
                  <div>
                    {(aiData.recentLogs || []).slice(0, 8).map((l, i) => (
                      <div key={l.logId} className="flex items-center justify-between px-4 py-2" style={{ borderTop: i ? `1px solid ${T.border}` : "none" }}>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: T.textSecondary }}>{featureLabel(l.feature)}</div>
                          <div className="text-xs" style={{ color: T.textMuted }}>{l.createdAt ? new Date(l.createdAt).toLocaleString("ja-JP") : ""}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold" style={{ color: T.textPrimary }}>${parseFloat(l.estimatedCostUsd || 0).toFixed(5)}</div>
                          <div className="text-xs" style={{ color: T.textMuted }}>{(l.inputTokens || 0) + (l.outputTokens || 0)}tok</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
            <p className="mt-2 text-xs" style={{ color: T.textMuted }}>※ 推定料金は実際の AWS 請求と異なる場合があります。</p>
          </>
        )}
      </div>
    </div>
  );
}

export function RiskBoard() {
  const { riskData, loading, err, date } = useRiskAnalysis();
  const [open, setOpen] = useState(null);
  const hi = riskData.filter(r => r.score >= 70).length;
  const mid = riskData.filter(r => r.score >= 40 && r.score < 70).length;
  const lo = riskData.filter(r => r.score < 40).length;

  if (loading) return (
    <div>
      <SectionHead title="リスク分析" desc="日報・テスト・勤怠をもとに離脱／つまずきリスクをルールベースで算出します" />
      <div className="rounded-xl px-4 py-10 text-center text-sm" style={{ background: T.bgBase, color: T.textMuted }}>データを集計中...</div>
    </div>
  );

  return (
    <div>
      <SectionHead title="リスク分析" desc={`日報・テスト・勤怠をもとにリスクをルールベースで算出します（${date.replace(/-/g, "/")}）`} />
      {err && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{err}</div>}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat icon={AlertCircle} label="高リスク" value={`${hi}名`} tone="red" />
        <Stat icon={Activity} label="中リスク" value={`${mid}名`} tone="amber" />
        <Stat icon={ShieldCheck} label="低リスク" value={`${lo}名`} tone="green" />
      </div>
      {riskData.length === 0 ? (
        <Card><EmptyState title="受講生がいません" desc="ユーザー管理から受講生を追加してください" /></Card>
      ) : (
        <Card>
          {riskData.map((r, i) => {
            const lv = riskLevel(r.score);
            const isOpen = open === r.userId;
            const activeSigs = Object.entries(r.signals).filter(([, v]) => v > 0);
            return (
              <div key={r.userId} style={{ borderTop: i ? `1px solid ${T.border}` : "none" }}>
                <button onClick={() => setOpen(isOpen ? null : r.userId)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                  <Avatar name={r.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{r.name}</span>
                      <span className="hidden text-xs sm:inline" style={{ color: T.textMuted }}>{r.org}</span>
                    </div>
                    <div className="truncate text-xs" style={{ color: T.textMuted }}>主因：{r.top}</div>
                  </div>
                  <div className="hidden w-32 md:block"><Bar value={Math.min(r.score, 100)} tone={lv.k === "低" ? "green" : "amber"} /></div>
                  <Badge tone={lv.tone}>{lv.k}リスク {r.score}</Badge>
                  <ChevronRight size={16} style={{ color: T.textMuted, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    {activeSigs.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {activeSigs.map(([k, v]) => (
                          <div key={k} className="rounded-xl p-3" style={{ background: T.bgBase }}>
                            <div className="mb-1 flex justify-between text-xs">
                              <span style={{ color: T.textSecondary }}>{RISK_SIG_LABEL[k]}</span>
                              <span style={{ color: v >= 20 ? T.danger : T.warning }}>+{v}点</span>
                            </div>
                            <Bar value={Math.min(v * 2.5, 100)} tone={v >= 20 ? "amber" : "green"} />
                          </div>
                        ))}
                      </div>
                    )}
                    {r.reasons.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {r.reasons.map(reason => <Badge key={reason} tone="amber">{reason}</Badge>)}
                      </div>
                    )}
                    {r.avgScore !== null && (
                      <div className="mt-3 rounded-xl p-3 text-sm" style={adminPanelStyle}>
                        テスト平均: <strong style={{ color: r.avgScore < 60 ? T.danger : r.avgScore < 70 ? T.warning : T.success }}>{r.avgScore}点</strong>
                      </div>
                    )}
                    {r.reasons.length === 0 && (
                      <div className="mt-3 rounded-xl p-3 text-sm" style={adminPanelStyle}>本日のリスク項目なし</div>
                    )}
                    <div className="mt-3 flex justify-end"><Btn kind="ghost" size="sm">面談を設定</Btn></div>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
      <p className="mt-3 text-xs" style={{ color: T.textMuted }}>※ 日報・勤怠は当日分、テストは受験済み全結果の平均で算出します。</p>
    </div>
  );
}

export function AnalyticsPlaceholder({ title, desc }) {
  return (
    <Card>
      <EmptyState title={title} desc={desc} />
    </Card>
  );
}
