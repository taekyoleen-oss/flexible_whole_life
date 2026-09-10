"use client";
import { FormulaHelp } from "@/components/formula-help";
import { Fragment } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, Card } from "@/components/ui";
import { won } from "@/lib/format";
import { recommend } from "@/lib/recommend";

export function RecommendCard() {
  const { state, dispatch } = useDesign();
  const r = recommend(state);
  const d = r.needs.detail;
  const rows: [string, string][] = [
    [`생활비 (연소득×${Math.round(state.settings.assumption.needs.livingRatio * 100)}% × ${r.needs.yearsToIndependence}년 현가)`, won(d.living)],
    ["자녀 교육·결혼", won(d.education)], ["부채 상환", won(d.debt)], ["정리 자금", won(d.finalExpense)], ["− 기존 보장·유동자산", `−${won(d.offset)}`],
  ];
  const apply = (S0: number) => dispatch({ type: "S0", S0 });
  const applyPreset = () => dispatch({ type: "preset", id: r.presetId });
  return (
    <Card title="추천 (니즈 · HLV)">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs text-navy/60">필요보장 (니즈 접근법) <FormulaHelp id="needs" /> <FormulaHelp id="annuity" /></div>
          <div className="font-mono text-2xl text-navy">{won(r.needs.needs)}</div>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-0.5 text-xs">
            {rows.map(([k, v]) => <Fragment key={k}><dt className="text-navy/60">{k}</dt><dd className="font-mono">{v}</dd></Fragment>)}
          </dl>
          <Button className="mt-2" primary onClick={() => apply(r.suggestedS0)}>기준보험금 {won(r.suggestedS0)} 적용</Button>
        </div>
        <div>
          <div className="text-xs text-navy/60">인적자본 (HLV, 은퇴까지 {r.needs.yearsToRetirement}년) <FormulaHelp id="hlv" /></div>
          <div className="font-mono text-2xl text-navy">{won(r.needs.hlv)}</div>
          <Button className="mt-2" onClick={() => apply(r.hlvS0)}>기준보험금 {won(r.hlvS0)} 적용</Button>
          <div className="mt-4 text-xs text-navy/60">추천 프리셋</div>
          <div className="text-sm text-navy">{r.reason}</div>
          <Button className="mt-2" onClick={applyPreset} disabled={state.presetId === r.presetId}>{state.presetId === r.presetId ? "적용됨" : "프리셋 적용"}</Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-navy/50">적용 후 예산 섹션에서 월 보험료를 확인하고, 설계 화면에서 그래프로 조정하세요. 기준보험금은 1천만원 단위로 반올림됩니다.</p>
    </Card>
  );
}
