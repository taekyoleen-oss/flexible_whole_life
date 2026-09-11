import { describe, expect, it } from "vitest";
import { inheritanceTax, lifeExpectancy, regularizeShape, remainingPrincipal } from "@/lib/engine/finance";
import { childNeedCurve, debtNeedCurve, estateTaxCurve, groupGapRatio, retireNeed } from "@/lib/engine/needs";
import kli7 from "@/lib/engine/data/rates-kli7.json";
import type { RateTable } from "@/lib/engine/types";

const table = kli7 as RateTable;
const needsP = { discount: 0.02, livingRatio: 0.7, selfRatio: 0.3, educationPerChild: 1e8, finalExpense: 3e7, independenceAge: 25, retirementAge: 65 };

describe("finance", () => {
  it("원리금균등 잔액: 0년 = L, 만기 = 0, 중간은 닫힌식", () => {
    const L = 3e8, i = 0.05, n = 15;
    expect(remainingPrincipal(L, i, n, 0)).toBe(L);
    expect(remainingPrincipal(L, i, n, 15)).toBe(0);
    const P = (L * i) / (1 - (1 + i) ** -n);
    expect(remainingPrincipal(L, i, n, 5)).toBeCloseTo(L * 1.05 ** 5 - (P * (1.05 ** 5 - 1)) / i, 6);
    expect(remainingPrincipal(L, i, n, 5)).toBeGreaterThan(L * (1 - 5 / 15));   // 원리금균등은 초기에 원금이 천천히 준다
    expect(remainingPrincipal(L, i, n, 5, "principal")).toBeCloseTo(L * (10 / 15), 6);
    expect(remainingPrincipal(L, i, n, 14, "bullet")).toBe(L);
    expect(remainingPrincipal(L, 0, n, 3)).toBeCloseTo(L * 0.8, 6);
  });
  it("기대여명: 나이가 많을수록 짧고 남 40세는 40년 안팎", () => {
    const e40 = lifeExpectancy(table, "M", 40), e65 = lifeExpectancy(table, "M", 65);
    expect(e40).toBeGreaterThan(35); expect(e40).toBeLessThan(50);
    expect(e65).toBeLessThan(e40); expect(e65).toBeGreaterThan(15);
    expect(lifeExpectancy(table, "F", 40)).toBeGreaterThan(e40);
  });
  it("상속세: 공제 이하 0, 구간 세율·누진공제, 배우자공제", () => {
    expect(inheritanceTax(9e8, true, 2).tax).toBe(0);            // 5억 + 배우자 최소 5억
    expect(inheritanceTax(5e8, false, 0).tax).toBe(0);
    expect(inheritanceTax(6e8, false, 0).tax).toBe(1e7);         // 과세표준 1억 × 10%
    expect(inheritanceTax(1.5e9, false, 0).tax).toBe(1e9 * 0.3 - 6e7);   // 과세표준 10억
    const t = inheritanceTax(3e9, true, 2);                        // 배우자 법정지분 1.5/3.5 × 30억 = 12.86억
    expect(t.deduction).toBeCloseTo(5e8 + 3e9 * (1.5 / 3.5), 0);
    expect(t.tax).toBeCloseTo(t.taxable * 0.4 - 1.6e8, 0);
  });
  it("regularize: 증액은 앞당겨 제때 도달, 감액은 매년 1칸, 초기 5년 고정, 70세 후 증액 없음, 상하한", () => {
    const n = 30;
    const up = Array.from({ length: n }, (_, t) => (t >= 20 ? 1.5 : 1));
    const m = regularizeShape(up, { fixYears: 5, step: 0.1, maxMultiple: 3, minRatio: 0.2 });
    expect(m.slice(14, 21)).toEqual([1, 1, 1.1, 1.2, 1.3, 1.4, 1.5]);   // 16~19년에 매년 1칸, 20년째 1.5에 도달
    const down = Array.from({ length: n }, (_, t) => (t >= 8 ? 0.3 : 1));
    const d = regularizeShape(down, { fixYears: 5, step: 0.1, maxMultiple: 3, minRatio: 0.2 });
    expect(d.slice(7, 16)).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.3]);   // 8년째부터 매년 1칸씩 늦게 내려간다
    const early = Array.from({ length: n }, (_, t) => (t === 2 ? 1.3 : 1));
    expect(regularizeShape(early, { fixYears: 5, step: 0.1, maxMultiple: 3, minRatio: 0.2 }).slice(0, 8)).toEqual([1.3, 1.3, 1.3, 1.3, 1.3, 1.2, 1.1, 1]);
    const grow = Array.from({ length: n }, (_, t) => 1 + 0.1 * t);
    const g = regularizeShape(grow, { fixYears: 5, step: 0.1, maxMultiple: 3, minRatio: 0.2, growthEndIndex: 10 });
    expect(g[10]).toBe(2); expect(g[11]).toBe(2); expect(Math.max(...g)).toBe(2);
    const cap = regularizeShape(Array.from({ length: n }, (_, t) => (t >= 5 ? 5 : 0.05)), { fixYears: 5, step: 0.1, maxMultiple: 3, minRatio: 0.2 });
    expect(Math.max(...cap)).toBe(3); expect(Math.min(...cap)).toBeGreaterThanOrEqual(0.2 * cap[0]);
  });
});

describe("프리셋 필요액 곡선", () => {
  it("자녀연령형: 독립 뒤에는 정리자금만 남는다", () => {
    const c = childNeedCurve({ income: 6e7, childrenAges: [3, 6] }, needsP, 40);
    expect(c[0]).toBeGreaterThan(c[10]);
    expect(c[22]).toBe(needsP.finalExpense);   // 막내 3세 → 22년 후 독립
    expect(c[18]).toBe(6e7 * 0.7 * ((1 - 1.02 ** -4) / 0.02) + 2e8 + 3e7);   // 4년 남음, 둘 다(21·24세) 독립 전
    expect(c[20]).toBe(6e7 * 0.7 * ((1 - 1.02 ** -2) / 0.02) + 1e8 + 3e7);   // 2년 남음, 막내만 독립 전
  });
  it("부채상환형: 만기 뒤에는 정리자금만", () => {
    const c = debtNeedCurve({ debt: 3e8, debtYears: 15, debtRate: 0.05, debtMethod: "annuity" }, needsP, 40);
    expect(c[0]).toBe(3e8 + 3e7); expect(c[15]).toBe(3e7); expect(c[5]).toBeGreaterThan(c[6]);
  });
  it("은퇴증액형: 배우자 생활비 현가 기준 배수", () => {
    const r = retireNeed({ age: 40, retirementAge: 65, hasSpouse: true, spouseSex: "F", spouseAge: 38, livingMonthly: 2.5e6, retireAssets: 1e8, preNeed: 3e8 }, needsP, table);
    expect(r.spouseAgeAtRetire).toBe(63);
    expect(r.expectancy).toBeGreaterThan(20);
    expect(r.post).toBe(Math.max(0, r.living + 3e7 - 1e8));
    expect(r.ratio).toBeCloseTo(r.post / 3e8, 9);
    expect(retireNeed({ age: 40, retirementAge: 65, hasSpouse: false, spouseSex: "F", spouseAge: 38, livingMonthly: 2.5e6, retireAssets: 0, preNeed: 3e8 }, needsP, table).post).toBe(3e7);
  });
  it("단체보험보완형·상속준비형", () => {
    expect(groupGapRatio(1e8, 4e8)).toBe(0.75); expect(groupGapRatio(5e8, 4e8)).toBe(0); expect(groupGapRatio(1e8, 0)).toBe(1);
    const e = estateTaxCurve({ netAssets: 2e9, assetGrowth: 0.03, hasSpouse: true, children: 2 }, 30);
    expect(e[0]).toBeGreaterThan(0); expect(e[29]).toBeGreaterThan(e[0]);
    expect(estateTaxCurve({ netAssets: 5e8, assetGrowth: 0.03, hasSpouse: true, children: 2 }, 5)).toEqual([0, 0, 0, 0, 0]);
  });
});
