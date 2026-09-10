import { describe, expect, it } from "vitest";
import kli7 from "@/lib/engine/data/rates-kli7.json";
import { commutation } from "@/lib/engine/commutation";
import { premium } from "@/lib/engine/premium";
import { reserves } from "@/lib/engine/reserve";
import { lowSurrender } from "@/lib/engine/lowSurrender";
import type { Contract, ExpensesMethod } from "@/lib/engine/types";

const e: ExpensesMethod = { model: "method", alphaS: 0.01, alphaP: 1.0, betaS: 0.0015, betaG: 0.045, betaPrime: 0.001, gamma: 0.025 };
const c: Contract = { age: 40, termYears: 70, payYears: 20, freq: 12, S: new Array(70).fill(1), C: new Array(71).fill(0) };
const k = commutation({ interest: 0.025, q: kli7.M.q, f: kli7.M.f }, 40, 70);
const p = premium(k, c, e);
const V = reserves(k, c, e, p);

describe("저해지 (초기 5년, ratio 0.5, lapse 4%)", () => {
  const ls = lowSurrender(k, c, V, p.alpha, { ratio: 0.5, lapse: 0.04 });
  it("t=1..5 환급금은 표준의 절반, 그 밖은 같다", () => {
    for (let t = 1; t <= 5; t++) expect(ls.cashUnit[t]).toBeCloseTo(0.5 * ls.stdCashUnit[t], 12);
    expect(ls.cashUnit[6]).toBe(ls.stdCashUnit[6]);
    expect(ls.cashUnit[0]).toBe(0);
  });
  it("보험료 인하액 > 0, 인하 후 영업보험료 < 표준", () => {
    expect(ls.deltaP).toBeGreaterThan(0);
    const p2 = premium(k, c, e, ls.deltaP);
    expect(p2.gross).toBeLessThan(p.gross);
    expect(p2.net).toBeCloseTo(p.net - ls.deltaP, 15);
  });
});
