import { describe, expect, it } from "vitest";
import { addonCurve, mergeAddon } from "@/lib/engine/addons";
import { DEFAULT_ENVELOPE } from "@/lib/engine/envelope";

describe("추가 조건", () => {
  it("자녀교육: 1인당 1억, 10세 → 독립(25세)까지 15년 동안 직선 감소", () => {
    const c = addonCurve({ id: "a", kind: "education", amount: 1e8, years: 0, childAge: 10 }, 30);
    expect(c[0]).toBe(1e8); expect(c[5]).toBeCloseTo(1e8 * (10 / 15), 6); expect(c[15]).toBe(0); expect(c[29]).toBe(0);
  });
  it("대출상환: 대출금이 상환기간 동안 지금부터 감소, 정액은 기간 동안 같은 금액", () => {
    const l = addonCurve({ id: "b", kind: "loan", amount: 3e8, years: 15 }, 30);
    expect(l[0]).toBe(3e8); expect(l[7]).toBeCloseTo(3e8 * (8 / 15), 6); expect(l[15]).toBe(0);
    const f = addonCurve({ id: "c", kind: "fixed", amount: 5e7, years: 10 }, 30);
    expect(f[0]).toBe(5e7); expect(f[9]).toBe(5e7); expect(f[10]).toBe(0);
  });
  it("결합: 금액을 더하고 3배를 넘으면 기준보험금을 올려 규칙에 맞춘다", () => {
    const n = 40, S = new Array(n).fill(1);
    const c = addonCurve({ id: "b", kind: "loan", amount: 3e8, years: 15 }, n);
    const m = mergeAddon(S, 1e8, c, DEFAULT_ENVELOPE);
    expect(m.S0).toBe(1.4e8);                         // 최대 4억 / 3배 → 1.4억(1천만 단위 올림)
    expect(Math.max(...m.S)).toBeLessThanOrEqual(3);
    expect(new Set(m.S.slice(0, 5)).size).toBe(1);   // 초기 5년 고정
    for (let t = 1; t < n; t++) expect(Math.abs(m.S[t] - m.S[t - 1])).toBeLessThanOrEqual(0.1 + 1e-9);   // 매년 1칸
    for (let t = 0; t < n; t++) expect(m.S[t] * m.S0).toBeGreaterThanOrEqual(S[t] * 1e8 + c[t] - 1e4);   // 보장이 필요액 아래로 가지 않는다
    const small = mergeAddon(S, 1e8, addonCurve({ id: "c", kind: "fixed", amount: 5e7, years: 10 }, n), DEFAULT_ENVELOPE);
    expect(small.S0).toBe(1e8); expect(small.S[0]).toBe(1.5); expect(small.S[20]).toBe(1);
  });
});
