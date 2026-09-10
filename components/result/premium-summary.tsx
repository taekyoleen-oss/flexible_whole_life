"use client";
import { Fragment } from "react";
import { useDesign } from "@/components/design-provider";
import { Card } from "@/components/ui";
import { pct, won } from "@/lib/format";
import { effective } from "@/lib/state";

export function PremiumSummary() {
  const { state, result: r } = useDesign();
  const m = state.payYears;
  const eff = effective(r, m);
  const rows: [string, string][] = [
    ["월 순보험료", won(eff.net)],
    ["총 납입보험료", won(eff.totalPaid)],
    [`납입 완료(${m}년) 환급률`, pct(eff.rate[m])],
    ["초기 보험금", won(r.S[0] * state.S0)],
    ["최대 보험금", won(Math.max(...r.S) * state.S0)],
  ];
  if (eff.isLow) rows.push(["표준형 월 영업보험료 (저해지 미적용)", won(eff.standardMonthly)]);
  return (
    <Card title="보험료">
      <div className="mb-3">
        <div className="text-xs text-navy/60">월 영업보험료</div>
        <div className="font-mono text-3xl text-navy">{won(eff.monthly)}</div>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        {rows.map(([k, v]) => <Fragment key={k}><dt className="text-navy/60">{k}</dt><dd className="font-mono">{v}</dd></Fragment>)}
      </dl>
      <p className="mt-3 text-xs text-navy/50">가정 {r.meta.assumptionId} ({r.meta.assumptionVersion}) · 납입면제 {r.meta.waiver ? "ON" : "OFF"} · 저해지 {r.meta.lowSurrender ? "ON" : "OFF"}</p>
    </Card>
  );
}
