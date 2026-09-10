import { commutation } from "./commutation";
import { premium, pvBenefit } from "./premium";
import { reserves } from "./reserve";
import { expandBlocks } from "./schedule";
import type { AssumptionSet, Block, Contract, Expenses, RateTable, Sex } from "./types";

export interface RedesignInput {
  sex: Sex;
  attainedAge: number;     // 재설계 시점 연령
  carry: number;           // 이월 금액(원): 지속·감액 = 준비금, 중단 = 해약환급금
  monthlyGross: number;    // 앞으로 낼 월 영업보험료(원). 0이면 완납형
  payYears: number;        // 남은 납입기간(년)
  blocks: Block[];         // 재설계 스케줄(attainedAge 기준 배수, S_0 = 1)
  waiver: boolean;
}

export interface RedesignResult {
  n: number; S: number[]; C: number[];
  S0: number; units: number;
  fundedByCarry: number;                  // 기준보험금 중 이월분 비율 0..1
  monthly: { net: number; gross: number };
  totalPaid: number;
  per100k: { net: number; gross: number };
  reserve100k: number[];                  // 이월분 포함 연말 준비금(10만원당)
  cash: number[]; paid: number[]; rate: number[];
  pvbUnit: number;                        // 1단위 급부의 완납 순보험료 π (현재 기초율)
}

/** 재설계 계약에는 신계약비를 부과하지 않는다 */
export const noAcquisition = (e: Expenses): Expenses => (e.model === "method" ? { ...e, alphaS: 0, alphaP: 0 } : { ...e, alpha: 0 });

/** 1단위 급부의 완납 순보험료 π = PVB / Dx_0 (연령 x에서 시작하는 스케줄, 이율 i) */
export function pvUnit(c: { sex: Sex; age: number; blocks: Block[]; waiver: boolean }, interest: number, table: RateTable): number {
  const rs = table[c.sex], n = table.meta.terminal[c.sex] - c.age;
  const zero = new Array<number>(rs.q.length).fill(0);
  const k = commutation({ interest, q: rs.q, f: c.waiver ? rs.f : zero }, c.age, n);
  const { S, C } = expandBlocks(c.blocks, c.age, n);
  return pvBenefit(k, S, C) / k.Dx[0];
}

/**
 * 재설계: 이월 금액 K가 사는 완납 부분(S_K = K/π)과 앞으로 낼 보험료 G가 사는 부분(S_G = G/P_G)을
 * 같은 스케줄 모양으로 합쳐 기준보험금 S_0 = S_K + S_G를 정한다. 준비금은 전향식에 보험료 분담 비율 f만 반영한다.
 */
export function redesign(input: RedesignInput, a: AssumptionSet, table: RateTable): RedesignResult {
  const rs = table[input.sex];
  const n = table.meta.terminal[input.sex] - input.attainedAge, freq = 12;
  const zero = new Array<number>(rs.q.length).fill(0);
  const { S, C } = expandBlocks(input.blocks, input.attainedAge, n);
  const m = Math.min(Math.max(Math.round(input.payYears), 0), n);
  const paying = input.monthlyGross > 0 && m > 0;
  const c: Contract = { age: input.attainedAge, termYears: n, payYears: paying ? m : 1, freq, S, C };   // premium()은 m ≥ 1 필요
  const e = noAcquisition(a.expenses);
  const k = commutation({ interest: a.interest, q: rs.q, f: input.waiver ? rs.f : zero }, input.attainedAge, n);
  const p = premium(k, c, e);
  const pvbUnit = p.pvb / k.Dx[0];
  const S0carry = pvbUnit > 0 ? input.carry / pvbUnit : 0;
  const S0prem = paying && p.gross > 0 ? input.monthlyGross / p.gross : 0;
  const S0 = S0carry + S0prem;
  const f = S0 > 0 ? S0prem / S0 : 0;
  const pAdj = { ...p, net: p.net * f, pBeta: p.pBeta * f, gross: p.gross * f };
  const V = reserves(k, c, e, pAdj);
  const r0 = (x: number) => Math.round(x * 1e5);
  const units = S0 / 1e5;
  const per100k = { net: r0(pAdj.net), gross: r0(pAdj.gross) };
  const reserve100k = V.map(r0);
  const cash = reserve100k.map((v) => v * units);
  const paid = cash.map((_, t) => Math.min(t, paying ? m : 0) * freq * per100k.gross * units);
  const rate = cash.map((w, t) => (paid[t] > 0 ? w / paid[t] : 0));
  return {
    n, S, C, S0, units, fundedByCarry: 1 - f,
    monthly: { net: per100k.net * units, gross: per100k.gross * units },
    totalPaid: paid[n], per100k, reserve100k, cash, paid, rate, pvbUnit,
  };
}
