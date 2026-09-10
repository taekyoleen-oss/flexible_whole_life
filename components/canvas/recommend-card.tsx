"use client";
import { FormulaHelp } from "@/components/formula-help";
import { Fragment } from "react";
import { useDesign } from "@/components/design-provider";
import { Card } from "@/components/ui";
import { won } from "@/lib/format";
import { recommend } from "@/lib/recommend";

export function RecommendCard() {
  const { state } = useDesign();
  const r = recommend(state);
  const d = r.needs.detail;
  const rows: [string, string][] = [
    [`생활비 (연소득×${Math.round(state.settings.assumption.needs.livingRatio * 100)}% × ${r.needs.yearsToIndependence}년 현가)`, won(d.living)],
    ["자녀 교육·결혼", won(d.education)], ["부채 상환", won(d.debt)], ["정리 자금", won(d.finalExpense)], ["− 기존 보장·유동자산", `−${won(d.offset)}`],
  ];
  return (
    <Card title="추천 (니즈 · HLV)">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs text-navy/60">필요보장 (니즈 접근법) <FormulaHelp id="needs" /> <FormulaHelp id="annuity" /></div>
          <div className="font-mono text-2xl text-navy">{won(r.needs.needs)}</div>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-0.5 text-xs">
            {rows.map(([k, v]) => <Fragment key={k}><dt className="text-navy/60">{k}</dt><dd className="font-mono">{v}</dd></Fragment>)}
          </dl>
          <div className="mt-1 text-xs text-navy/50">기준보험금 후보 {won(r.suggestedS0)}</div>
        </div>
        <div>
          <div className="text-xs text-navy/60">인적자본 (HLV, 은퇴까지 {r.needs.yearsToRetirement}년) <FormulaHelp id="hlv" /></div>
          <div className="font-mono text-2xl text-navy">{won(r.needs.hlv)}</div>
          <div className="mt-1 text-xs text-navy/50">기준보험금 후보 {won(r.hlvS0)}</div>
          <div className="mt-4 text-xs text-navy/60">추천 프리셋</div>
          <div className="text-sm text-navy">{r.reason}</div>

        </div>
      </div>
      <p className="mt-3 text-xs text-navy/50">참고용 정보입니다. 설계는 기준보험금 1억과 표준 프리셋으로 시작하며, 설계 화면의 &quot;입력 정보 반영&quot;에서 원하는 항목만 골라 적용할 수 있습니다.</p>
    </Card>
  );
}
