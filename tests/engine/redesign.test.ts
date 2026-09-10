import { describe, expect, it } from "vitest";
import kli7 from "@/lib/engine/data/rates-kli7.json";
import { ASSUMPTIONS, compute, pvUnit, redesign, type AssumptionSet, type RateTable } from "@/lib/engine";

const table = kli7 as RateTable;
const a0 = ASSUMPTIONS[0];
const noExp: AssumptionSet = { ...a0, expenses: { model: "simple", alpha: 0, beta: 0, gamma: 0 } };
const level = (from: number, to: number) => [{ fromAge: from, toAge: to, multiple: 1, kind: "death" as const }];

describe("redesign — 자기일관성", () => {
  // 원계약: 40세 남 1억 평준 20년납. 10년 뒤(50세) 준비금 + 같은 보험료로 같은 스케줄을 다시 사면 같은 보험금이 나와야 한다 (사업비 0)
  const old = compute({ sex: "M", age: 40, payYears: 20, S0: 1e8, blocks: level(40, 109), waiver: false }, noExp, table);
  const t = 10, carry = old.reserve100k[t] * old.units;
  it("납입 지속: 준비금 이월 + 같은 보험료 → 기준보험금 ≈ 1억 (10만원당 반올림 때문에 0.5% 이내)", () => {
    const r = redesign({ sex: "M", attainedAge: 50, carry, monthlyGross: old.monthly.gross, payYears: 10, blocks: level(50, 109), waiver: false }, noExp, table);
    expect(r.S0 / 1e8).toBeCloseTo(1, 2);
    expect(Math.abs(r.monthly.gross - old.monthly.gross) / old.monthly.gross).toBeLessThan(1e-3);   // 10만원당 정수 반올림
    expect(r.reserve100k[0] * r.units).toBeCloseTo(carry, -2);   // 시점 0 준비금 = 이월액
    expect(r.cash[0]).toBe(r.reserve100k[0] * r.units);          // 해약공제 없음
  });
  it("납입 중단(감액완납): 이월액만으로 사는 보험금, 보험료 0", () => {
    const r = redesign({ sex: "M", attainedAge: 50, carry, monthlyGross: 0, payYears: 10, blocks: level(50, 109), waiver: false }, noExp, table);
    expect(r.monthly.gross).toBe(0);
    expect(r.fundedByCarry).toBe(1);
    expect(r.S0).toBeCloseTo(carry / pvUnit({ sex: "M", age: 50, blocks: level(50, 109), waiver: false }, noExp.interest, table), 6);
    expect(r.S0).toBeLessThan(1e8);
    expect(r.paid[20]).toBe(0);
  });
  it("이월액 0·보험료 0이면 기준보험금 0, 계산이 깨지지 않는다", () => {
    const r = redesign({ sex: "M", attainedAge: 50, carry: 0, monthlyGross: 0, payYears: 0, blocks: level(50, 109), waiver: false }, a0, table);
    expect(r.S0).toBe(0);
    expect(r.reserve100k.every(Number.isFinite)).toBe(true);
  });
  it("신계약비가 붙지 않는다: 사업비 있는 세트에서도 t=0 준비금 ≈ 이월액이고 해약공제가 없다", () => {
    const oldE = compute({ sex: "M", age: 40, payYears: 20, S0: 1e8, blocks: level(40, 109) }, a0, table);
    const K = oldE.reserve100k[10] * oldE.units;
    const r = redesign({ sex: "M", attainedAge: 50, carry: K, monthlyGross: oldE.monthly.gross, payYears: 10, blocks: level(50, 109), waiver: true }, a0, table);
    expect(r.reserve100k[0] * r.units).toBeGreaterThanOrEqual(K * 0.999);
    expect(r.reserve100k[0] * r.units).toBeLessThan(K * 1.06);   // 이월분의 납입후유지비 β′ 몫만큼만 위
    expect(r.cash[1]).toBe(r.reserve100k[1] * r.units);
  });
});

describe("pvUnit — 기초율 차이", () => {
  it("이율이 낮을수록 1단위 급부 현가가 크다", () => {
    const hi = pvUnit({ sex: "M", age: 50, blocks: level(50, 109), waiver: false }, 0.034, table);
    const lo = pvUnit({ sex: "M", age: 50, blocks: level(50, 109), waiver: false }, 0.025, table);
    expect(lo).toBeGreaterThan(hi);
    expect(hi).toBeGreaterThan(0); expect(hi).toBeLessThan(1);
  });
});
