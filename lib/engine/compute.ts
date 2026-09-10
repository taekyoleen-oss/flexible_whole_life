import { commutation } from "./commutation";
import { expandBlocks } from "./schedule";
import { premium, type Loading, type PremiumResult } from "./premium";
import { reserves } from "./reserve";
import { surrender, type SurrenderResult } from "./surrender";
import type { AssumptionSet, Contract, EngineInput, Expenses, RateTable } from "./types";

export interface EngineResult {
  n: number; omega: number; S: number[]; C: number[];
  S0: number; units: number;
  perUnit: PremiumResult & { alphaStd: number };
  per100k: { net: number; gross: number; base: number; alpha: number; alphaStd: number; newBiz: number };
  monthly: { net: number; gross: number };  // S0 기준 원
  totalPaid: number;
  loading: Loading;                          // S0 기준 원(1회 납입)
  reserve100k: number[]; reserveStd100k: number[];
  surrender: SurrenderResult;
  expenseFlow: number[];                     // 연도별 사업비(원), t=0..n-1
  /** 저해지: 납입기간 중 해약환급금 = 표준 × ratio, 영업보험료 = 표준 × (1 − premiumDiscount). deltaP100k = 10만원당 인하액 */
  lowSurrender?: { ratio: number; premiumDiscount: number; deltaP100k: number; gross100k: number; monthlyGross: number; cash: number[]; rate: number[]; paid: number[] };
  meta: { assumptionId: string; assumptionVersion: string; waiver: boolean; lowSurrender: boolean };
}

const r0 = (x: number) => Math.round(x * 1e5);

function scaleAlphaP(e: Expenses, n: number): Expenses {
  if (e.model !== "method" || n >= 20) return e;
  return { ...e, alphaP: (e.alphaP * Math.min(n, 20)) / 20 };
}

export function compute(input: EngineInput, a: AssumptionSet, table: RateTable): EngineResult {
  const rs = table[input.sex];
  const omega = table.meta.terminal[input.sex];
  const n = input.termYears ?? omega - input.age;
  const freq = input.freq ?? 12;
  const waiver = input.waiver ?? a.waiver;
  const useLow = input.lowSurrender ?? false;
  const zero = new Array<number>(rs.q.length).fill(0);
  const { S, C } = expandBlocks(input.blocks, input.age, n);
  const c: Contract = { age: input.age, termYears: n, payYears: input.payYears, freq, S, C };
  const e = scaleAlphaP(a.expenses, n);

  const k = commutation({ interest: a.interest, q: rs.q, f: waiver ? rs.f : zero }, input.age, n);
  const p = premium(k, c, e);
  const ks = commutation({ interest: a.standardInterest, q: rs.qStd, f: waiver ? rs.fStd : zero }, input.age, n);
  const ps = premium(ks, c, e);
  const V = reserves(k, c, e, p);
  const Vs = reserves(ks, c, e, ps);

  const units = input.S0 / 100000;
  const per100k = { net: r0(p.net), gross: r0(p.gross), base: r0(p.base), alpha: r0(p.alpha), alphaStd: r0(ps.alpha), newBiz: Math.min(r0(p.alpha), r0(ps.alpha)) };
  const reserve100k = V.map(r0), reserveStd100k = Vs.map(r0);
  const sur = surrender(reserve100k, per100k.newBiz, per100k.gross, c.payYears, freq, units);

  const loading: Loading = { alpha: p.loading.alpha * input.S0, betaS: p.loading.betaS * input.S0, betaPrime: p.loading.betaPrime * input.S0, betaG: p.loading.betaG * input.S0, gamma: p.loading.gamma * input.S0 };
  const expenseFlow = new Array<number>(n).fill(0);
  const bp = e.model === "method" ? e.betaPrime : 0;
  for (let t = 0; t < n; t++) {
    if (t < c.payYears) expenseFlow[t] = freq * (loading.betaS + loading.betaG + loading.gamma);
    else expenseFlow[t] = bp * input.S0;
  }
  expenseFlow[0] += p.alpha * input.S0;

  const result: EngineResult = {
    n, omega, S, C, S0: input.S0, units,
    perUnit: { ...p, alphaStd: ps.alpha },
    per100k,
    monthly: { net: per100k.net * units, gross: per100k.gross * units },
    totalPaid: per100k.gross * units * freq * c.payYears,
    loading, reserve100k, reserveStd100k, surrender: sur, expenseFlow,
    meta: { assumptionId: a.id, assumptionVersion: a.version, waiver, lowSurrender: useLow },
  };
  if (useLow) {
    // 단순 규칙(계획서 §0.6 #23): 납입기간 중 환급금은 표준의 ratio, 보험료는 표준의 (1 − premiumDiscount). 납입 완료 후는 표준과 같다.
    const { ratio, premiumDiscount } = a.lowSurrender;
    const gross100k = Math.round(per100k.gross * (1 - premiumDiscount));
    const cash = sur.cash.map((w, t) => (t < c.payYears ? Math.round(w * ratio) : w));
    const paid = cash.map((_, t) => Math.min(t, c.payYears) * freq * gross100k * units);
    const rate = cash.map((w, t) => (paid[t] > 0 ? w / paid[t] : 0));
    result.lowSurrender = { ratio, premiumDiscount, deltaP100k: per100k.gross - gross100k, gross100k, monthlyGross: gross100k * units, cash, rate, paid };
  }
  return result;
}
