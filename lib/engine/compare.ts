import { compute, type EngineResult } from "./compute";
import { expandBlocks } from "./schedule";
import type { AssumptionSet, EngineInput, RateTable } from "./types";

export type CompareId = "level" | "combo" | "designed";
export interface CompareRow {
  id: CompareId; label: string;
  S0: number; monthly: number; pvBenefit: number; totalPaid: number; cashRateAtPayEnd: number;
  S: number[];                 // 연도별 보험금(원)
  parts?: { whole: EngineResult; term?: EngineResult };
}

/** 같은 월 예산에서 평준형 종신 / 정기+종신 조합 / 설계형의 초기 보험금을 역산해 비교한다. */
export function compareAtBudget(budget: number, base: Omit<EngineInput, "S0">, a: AssumptionSet, table: RateTable): CompareRow[] {
  const omega = table.meta.terminal[base.sex];
  const n = base.termYears ?? omega - base.age;
  const unit = { ...base, S0: 1e5 };
  const levelBlocks = [{ fromAge: base.age, toAge: base.age + n - 1, multiple: 1, kind: "death" as const }];

  const designedU = compute(unit, a, table);
  const levelU = compute({ ...unit, blocks: levelBlocks }, a, table);
  const { S } = expandBlocks(base.blocks, base.age, n);
  const firstDrop = S.findIndex((s, t) => t > 0 && s < S[t - 1] - 1e-12);
  const wholeMult = S[n - 1], termMult = firstDrop > 0 ? S[0] - wholeMult : 0, termYears = firstDrop > 0 ? firstDrop : 0;

  const finish = (id: CompareId, label: string, r: EngineResult, S0: number, term?: EngineResult): CompareRow => ({
    id, label, S0, monthly: Math.round(r.monthly.gross + (term?.monthly.gross ?? 0)),
    pvBenefit: (r.perUnit.pvb * r.S0 + (term ? term.perUnit.pvb * term.S0 : 0)) / 1e5,
    totalPaid: r.totalPaid + (term?.totalPaid ?? 0),
    cashRateAtPayEnd: term ? (r.surrender.cash[base.payYears] + (term.surrender.cash[Math.min(base.payYears, term.n)] ?? 0)) / (r.surrender.paid[base.payYears] + (term.surrender.paid[Math.min(base.payYears, term.n)] ?? 0)) : r.surrender.rate[base.payYears],
    S: r.S.map((m, t) => m * r.S0 + (term && t < term.n ? term.S[t] * term.S0 : 0)),
    parts: { whole: r, term },
  });

  // 월 보험료는 10만원당 정수 보험료 × units 이므로, 역산도 같은 정수를 써야 예산과 정확히 맞는다.
  const levelS0 = (budget * 1e5) / levelU.per100k.gross;
  const designedS0 = (budget * 1e5) / designedU.per100k.gross;
  const rows: CompareRow[] = [];
  rows.push(finish("level", "평준형 종신", compute({ ...base, S0: levelS0, blocks: levelBlocks }, a, table), levelS0));

  if (termYears > 0 && termMult > 0) {
    const termBlocks = [{ fromAge: base.age, toAge: base.age + termYears - 1, multiple: 1, kind: "death" as const }];
    const termPay = Math.min(base.payYears, termYears);
    const termU = compute({ ...unit, termYears, payYears: termPay, blocks: termBlocks }, a, table);
    const S0 = (budget * 1e5) / (levelU.per100k.gross * wholeMult + termU.per100k.gross * termMult);
    const whole = compute({ ...base, S0: S0 * wholeMult, blocks: levelBlocks }, a, table);
    const term = compute({ ...base, S0: S0 * termMult, termYears, payYears: termPay, blocks: termBlocks }, a, table);
    rows.push(finish("combo", "정기 + 종신 조합", whole, S0, term));
  } else {
    rows.push({ ...rows[0], id: "combo", label: "정기 + 종신 조합 (감액 없음 → 평준형과 동일)" });
  }
  rows.push(finish("designed", "설계형 종신", compute({ ...base, S0: designedS0 }, a, table), designedS0));
  return rows;
}
