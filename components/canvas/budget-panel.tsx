"use client";
import { useDesign } from "@/components/design-provider";
import { Card, Field, ManwonInput, Select } from "@/components/ui";
import { clamp, won } from "@/lib/format";
import { s0FromMonthly } from "@/lib/state";

const PAY_YEARS = [5, 10, 15, 20, 30];

export function BudgetFields() {
  const { state, dispatch, result } = useDesign();
  const monthly = result.monthly.gross;
  const setMonthly = (m: number) => dispatch({ type: "S0", S0: s0FromMonthly(m, result.per100k.gross) });
  return (
    <div className="space-y-3">
      <Field label="월 보험료" hint={<>초기 보험금 {won(result.S[0] * state.S0)} · 총 납입 {won(result.totalPaid)}</>}>
        <ManwonInput value={monthly} onChange={setMonthly} min={1} max={1000} />
      </Field>
      <input type="range" className="w-full accent-sky" min={5} max={300} step={1} aria-label="월 보험료 슬라이더"
        value={clamp(Math.round(monthly / 1e4), 5, 300)} onChange={(e) => setMonthly(Number(e.target.value) * 1e4)} />
      <Field label="기준보험금" hint="초기 고정 구간 배수 1.0에 해당하는 보험금">
        <ManwonInput value={state.S0} onChange={(v) => dispatch({ type: "S0", S0: v })} min={100} max={1e6} step={100} />
      </Field>
    </div>
  );
}

export function ContractFields() {
  const { state, dispatch } = useDesign();
  return (
    <div className="space-y-3">
      <Field label="납입기간">
        <Select value={state.payYears} onChange={(e) => dispatch({ type: "payYears", payYears: Number(e.target.value) })}>
          {PAY_YEARS.map((y) => <option key={y} value={y}>{y}년납</option>)}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-sky" checked={state.waiver} onChange={(e) => dispatch({ type: "waiver", on: e.target.checked })} />납입면제 (사망·장해 50% 이중탈퇴)</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-sky" checked={state.lowSurrender} onChange={(e) => dispatch({ type: "lowSurrender", on: e.target.checked })} />저해지 (초기 5년 환급금 50%, 보험료 인하)</label>
    </div>
  );
}

export function BudgetPanel() {
  return (
    <Card title="예산·계약">
      <BudgetFields />
      <div className="my-4 border-t border-navy/10" />
      <ContractFields />
    </Card>
  );
}
