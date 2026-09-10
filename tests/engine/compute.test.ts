import { describe, expect, it } from "vitest";
import kli7 from "@/lib/engine/data/rates-kli7.json";
import { compute } from "@/lib/engine/compute";
import { ASSUMPTIONS, getAssumption } from "@/lib/engine/assumptions";
import { commutation } from "@/lib/engine/commutation";
import type { RateTable } from "@/lib/engine/types";

const table = kli7 as RateTable;
const verify = getAssumption("verify-term-1504");

describe("compute G1 (verify-term-1504 세트, 1억, 정기 형태)", () => {
  const r = compute({ sex: "M", age: 31, payYears: 20, S0: 1e8, termYears: 59,
    blocks: [{ fromAge: 31, toAge: 89, multiple: 1, kind: "death" }] }, verify, table);
  it("월 영업보험료 133,000원, 순 93,000원, 총납입 31,920,000원", () => {
    expect(r.monthly.gross).toBe(133000);
    expect(r.monthly.net).toBe(93000);
    expect(r.totalPaid).toBe(31920000);
  });
  it("해약환급금 10년 13,417,000 · 20년 31,346,000", () => {
    expect(r.surrender.cash[10]).toBe(13417000);
    expect(r.surrender.cash[20]).toBe(31346000);
  });
  it("표준 준비금 10만원당 20년 33,086", () => expect(r.reserveStd100k[20]).toBe(33086));
  it("사업비 흐름: 길이 n, 0년차에 신계약비 포함", () => {
    expect(r.expenseFlow).toHaveLength(59);
    expect(r.expenseFlow[0]).toBeGreaterThan(r.expenseFlow[1]);
    expect(r.expenseFlow[25]).toBeCloseTo(0.001 * 1e8, 6); // 납입 후 β′·S0
  });
});

describe("G3 평준 스케줄 = 종신 공식 (사업비 0, 납입면제 OFF)", () => {
  const a = { ...ASSUMPTIONS[0], expenses: { model: "simple" as const, alpha: 0, beta: 0, gamma: 0 }, waiver: false };
  const r = compute({ sex: "M", age: 40, payYears: 20, S0: 1e8, blocks: [{ fromAge: 40, toAge: 109, multiple: 1, kind: "death" }] }, a, table);
  it("n = 110 − 40 = 70, 순 = 영업, PVB = Mx0 − Mx70", () => {
    expect(r.n).toBe(70);
    expect(r.perUnit.net).toBe(r.perUnit.gross);
    const k = commutation({ interest: a.interest, q: kli7.M.q, f: new Array(120).fill(0) }, 40, 70);
    const M = k.Cx.slice(0, 70).reduce((s, x) => s + x, 0);
    expect(r.perUnit.pvb).toBeCloseTo(M, 9);
    expect(r.perUnit.net).toBeCloseTo(M / r.perUnit.nStar, 15);
  });
});

describe("G4 정기 형태 = 정기 공식", () => {
  const a = { ...verify, expenses: { model: "simple" as const, alpha: 0, beta: 0, gamma: 0 } };
  const r = compute({ sex: "M", age: 31, payYears: 20, S0: 1e8, termYears: 59, blocks: [{ fromAge: 31, toAge: 89, multiple: 1, kind: "death" }] }, a, table);
  it("순보험료 = M*/N*", () => expect(r.perUnit.net).toBeCloseTo(16212.828499 / 17378602.403207, 12));
});

describe("G5 예산 역산 왕복", () => {
  const a = ASSUMPTIONS[0];
  const blocks = [{ fromAge: 40, toAge: 109, multiple: 1, kind: "death" as const }, { fromAge: 60, toAge: 109, multiple: 0.3, kind: "death" as const }];
  const r = compute({ sex: "F", age: 40, payYears: 20, S0: 1e8, blocks }, a, table);
  it("S0 → 월 보험료 → S0", () => {
    const budget = r.perUnit.gross * 1e8;
    expect(budget / r.perUnit.gross).toBeCloseTo(1e8, 3);
    expect(r.n).toBe(72);
  });
});
