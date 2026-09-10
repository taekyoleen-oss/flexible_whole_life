import { describe, expect, it } from "vitest";
import kli7 from "@/lib/engine/data/rates-kli7.json";
import { commutation } from "@/lib/engine/commutation";
import { premium } from "@/lib/engine/premium";
import { reserves } from "@/lib/engine/reserve";
import { surrender } from "@/lib/engine/surrender";
import type { Contract, ExpensesMethod } from "@/lib/engine/types";

const e: ExpensesMethod = { model: "method", alphaS: 0.01, alphaP: 1.0, betaS: 0.0015, betaG: 0.045, betaPrime: 0.001, gamma: 0.025 };
const c: Contract = { age: 31, termYears: 59, payYears: 20, freq: 12, S: new Array(59).fill(1), C: new Array(60).fill(0) };
const r0 = (x: number) => Math.round(x * 1e5);

const k = commutation({ interest: 0.034, q: kli7.M.q, f: kli7.M.f }, 31, 59);
const p = premium(k, c, e);
const V = reserves(k, c, e, p).map(r0);                       // 10만원당 정수
const ks = commutation({ interest: 0.0325, q: kli7.M.qStd, f: kli7.M.fStd }, 31, 59);
const ps = premium(ks, c, e);
const Vs = reserves(ks, c, e, ps).map(r0);

describe("G1 준비금(10만원당)", () => {
  it("적용 1,161 · 3,599 · 6,194 · 13,417 · 31,346 · 46,491", () => {
    expect([V[1], V[3], V[5], V[10], V[20], V[40]]).toEqual([1161, 3599, 6194, 13417, 31346, 46491]);
  });
  it("표준 1,237 · 3,833 · 6,592 · 14,237 · 33,086 · 49,450, 표준 보험료 순 100 영업 141", () => {
    expect([Vs[1], Vs[3], Vs[5], Vs[10], Vs[20], Vs[40]]).toEqual([1237, 3833, 6592, 14237, 33086, 49450]);
    expect(r0(ps.net)).toBe(100); expect(r0(ps.gross)).toBe(141);
  });
  it("만기 이후 0", () => { expect(V[59]).toBe(0); });
});

describe("G1 해약환급금(1억)", () => {
  const units = 1000; // 1억 / 10만
  const alpha100k = Math.min(r0(p.alpha), r0(ps.alpha));
  const w = surrender(V, alpha100k, r0(p.gross), c.payYears, c.freq, units);
  it("신계약비는 적용·표준 중 작은 쪽 2,102", () => expect(alpha100k).toBe(2102));
  it("1년 0 · 2년 858,571 · 3년 2,397,857 · 5년 5,593,429 · 10년 13,417,000 · 20년 31,346,000", () => {
    expect([1, 2, 3, 5, 10, 20].map((t) => w.cash[t])).toEqual([0, 858571, 2397857, 5593429, 13417000, 31346000]);
  });
  it("환급률 26.9% · 50.1% · 98.2%", () => {
    expect(w.rate[2]).toBeCloseTo(0.269, 3); expect(w.rate[3]).toBeCloseTo(0.501, 3); expect(w.rate[20]).toBeCloseTo(0.982, 3);
  });
});
