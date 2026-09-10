"use client";
import { FormulaHelp } from "@/components/formula-help";
import type { FormulaId } from "@/lib/formulas";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { CelebrationBar } from "@/components/canvas/celebration-bar";
import { ScheduleEditor } from "@/components/canvas/schedule-editor";
import { useDesign } from "@/components/design-provider";
import { Button, Card } from "@/components/ui";
import { pct, won } from "@/lib/format";
import { downloadJson, loadLibrary, saveLibrary, upsert } from "@/lib/library";
import { checkRules, compareOptions, conversionLoss, runRedesign, type Budget, type BudgetMode, type OldContract } from "@/lib/redesign";
import { reserveCsv, RESERVE_HEADERS, type ReserveRow } from "@/lib/reserve-table";

/** 중첩 DesignProvider 안에서 동작: 새 스케줄 편집기 + 재설계 결과·규칙·비교·표·저장 */
export function RedesignCanvas({ old, budget, mode, lastRedesignedAt }: { old: OldContract; budget: Budget; mode: BudgetMode; lastRedesignedAt: number | null }) {
  const { state, dispatch } = useDesign();     // 중첩(새 스케줄)
  const router = useRouter();
  const [amount, setAmount] = useState(true);
  const [msg, setMsg] = useState("");
  const r = useMemo(() => runRedesign(old, budget, state, state.settings), [old, budget, state]);
  // 예산이 정한 기준보험금을 편집기 상태에 동기화(라벨·하한 계산용)
  useEffect(() => { if (Math.abs(state.S0 - r.S0) > 1) dispatch({ type: "S0", S0: r.S0, exact: true }); }, [r.S0, state.S0, dispatch]);
  const rules = checkRules(old, state, r, lastRedesignedAt);
  const loss = conversionLoss(old, state.settings);
  const rows = compareOptions(old, r, state.settings);
  const table: ReserveRow[] = r.reserve100k.map((v, t) => ({ t, age: old.attainedAge + t, benefit: (r.S[Math.min(t, r.n - 1)] ?? 0) * r.S0, celebration: (r.C[t] ?? 0) * r.S0, paid: r.paid[t], reserve: v * r.units, reserveStd: v * r.units, cash: r.cash[t], rate: r.rate[t], expense: 0 }));
  const HELP: Partial<Record<string, FormulaId>> = { "재설계 시점 준비금": "redesignReserve", "전환 손실 (기초율 차이)": "loss" };
  const summary: [string, string][] = [
    [`월 보험료 (남은 ${budget.payYears}년)`, won(r.monthly.gross)],
    ["이월 금액", won(budget.carry)],
    ["재설계 시점 준비금", won(r.reserve100k[0] * r.units)],
    ["최대 보험금", won(Math.max(...r.S) * r.S0)],
    ["전환 손실 (기초율 차이)", `${loss >= 0 ? "" : "−"}${won(Math.abs(loss))}`],
  ];

  const save = () => {
    const name = window.prompt("보관함에 저장할 이름", `재설계 · ${old.label} · ${old.attainedAge}세 · 월 ${won(r.monthly.gross)}`);
    if (!name?.trim()) return;
    saveLibrary(upsert(loadLibrary(), { id: String(Date.now()), name: name.trim(), savedAt: Date.now(), state: { ...state, S0: r.S0 }, redesign: { old, mode, monthlyGross: budget.monthlyGross, redesignedAt: Date.now() } }));
    setMsg("보관함에 저장했습니다. 시작 화면에서 열면 이 화면으로 돌아옵니다."); setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="space-y-4">
      <Card title="3. 새 스케줄">
        <div className="-mt-2 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-navy/60">
          <span>{old.attainedAge}세부터 다시 설계합니다. 초기 5년은 고정(R02), 1칸 = 새 기준보험금의 10% ({won(r.S0 / 10)})</span>
          <Button onClick={() => setAmount(!amount)}>{amount ? "배수로 보기" : "금액으로 보기"}</Button>
        </div>
        <ScheduleEditor height={360} amount={amount} />
        <CelebrationBar />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="재설계 결과">
          <div className="text-xs text-navy/60">새 기준보험금 (이월 {pct(r.fundedByCarry, 0)} + 보험료 {pct(1 - r.fundedByCarry, 0)}) <FormulaHelp id="redesignS0" /></div>
          <div className="font-mono text-3xl text-navy">{won(r.S0)}</div>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            {summary.map(([k, v]) => <Fragment key={k}><dt className="text-navy/60">{k}{HELP[k] && <FormulaHelp id={HELP[k]} className="ml-1" />}</dt><dd className="font-mono">{v}</dd></Fragment>)}
          </dl>
          <ul className="mt-3 space-y-1 text-sm">
            {rules.map((x) => <li key={x.code} className={x.ok ? "text-emerald-800" : "text-red-800"}>{x.ok ? "✓" : "✗"} {x.code} · {x.message} <FormulaHelp id={x.code === "R01" ? "r01" : "r02r03"} /></li>)}
          </ul>
          <p className="mt-2 text-xs text-navy/50">신계약비 없음 · 해약공제 없음 · 현재 가정 {state.settings.assumption.label}</p>
        </Card>
        <Card title="비교">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-navy/60"><th>안</th><th className="text-right">현재 보험금</th><th className="text-right">월 보험료</th><th className="text-right">지금 해지 시</th><th className="text-right">보험금 현가</th></tr></thead>
              <tbody>{rows.map((x) => <tr key={x.id} className={`border-t border-navy/10 ${x.id === "redesign" ? "bg-sky/10" : ""}`}><td className="py-1">{x.label}</td><td className="text-right font-mono">{won(x.benefitNow)}</td><td className="text-right font-mono">{won(x.monthly)}</td><td className="text-right font-mono">{won(x.cashNow)}</td><td className="text-right font-mono">{won(x.pv)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-navy/50">보험금 현가는 현재 가정 이율 기준 완납 순보험료입니다.</p>
        </Card>
      </div>

      <details className="rounded-lg border border-navy/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-display text-lg text-navy">준비금·환급금 표 (재설계)</summary>
        <div className="mt-2 flex items-center justify-between text-xs text-navy/60"><span>재설계 계약은 표준기초 준비금을 따로 내지 않아 표준 준비금 = 적용 준비금입니다.</span><Button onClick={() => downloadJson(`재설계_준비금표_${old.attainedAge}세.csv`, reserveCsv(table), "text/csv")}>CSV 다운로드</Button></div>
        <div className="mt-2 max-h-80 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-white text-navy/60"><tr>{RESERVE_HEADERS.map((h) => <th key={h} className="text-right first:text-left">{h}</th>)}</tr></thead>
          <tbody>{table.map((row) => <tr key={row.t} className="border-t border-navy/10 font-mono"><td>{row.t}</td><td className="text-right">{row.age}</td><td className="text-right">{won(row.benefit)}</td><td className="text-right">{row.celebration ? won(row.celebration) : "-"}</td><td className="text-right">{won(row.paid)}</td><td className="text-right">{won(row.reserve)}</td><td className="text-right">{won(row.reserveStd)}</td><td className="text-right">{won(row.cash)}</td><td className="text-right">{pct(row.rate)}</td><td className="text-right">-</td></tr>)}</tbody></table></div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button primary onClick={save}>보관함에 저장 (재설계)</Button>
        <Button onClick={() => router.push("/")}>시작 화면</Button>
        {msg && <span className="text-xs text-emerald-700">{msg}</span>}
      </div>
    </div>
  );
}
