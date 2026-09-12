import { describe, expect, it } from "vitest";
import { addonCurve, addonShape, mergeAddon } from "@/lib/engine/addons";
import { DEFAULT_ENVELOPE } from "@/lib/engine/envelope";
import { canUnmerge, initialState, levels, reducer } from "@/lib/state";

describe("추가 조건", () => {
  it("자녀교육: 1인당 1억, 10세 → 초기 5년 정액, 6~15년 직선 감소", () => {
    const c = addonCurve({ id: "a", kind: "education", amount: 1e8, years: 0, childAge: 10 }, 30);
    expect(c.slice(0, 6)).toEqual([1e8, 1e8, 1e8, 1e8, 1e8, 1e8]);   // 초기 5년 정액(6년째 시작점도 정액)
    expect(c[10]).toBeCloseTo(1e8 * (5 / 10), 6); expect(c[15]).toBe(0); expect(c[29]).toBe(0);
    expect(addonShape({ id: "a", kind: "education", amount: 1e8, years: 0, childAge: 10 })).toBe("1~5년 정액, 6~15년 감액");
  });
  it("대출상환: 1~5년 정액, 6년째부터 만기까지 직선 감액, 정액은 기간 동안 같은 금액", () => {
    const l = addonCurve({ id: "b", kind: "loan", amount: 3e8, years: 15 }, 30);
    expect(l[0]).toBe(3e8); expect(l[4]).toBe(3e8); expect(l[5]).toBe(3e8); expect(l[10]).toBeCloseTo(3e8 * (5 / 10), 6); expect(l[15]).toBe(0);
    const ten = addonCurve({ id: "b2", kind: "loan", amount: 1e8, years: 10 }, 20);
    expect(ten.slice(0, 5)).toEqual([1e8, 1e8, 1e8, 1e8, 1e8]); expect(ten[5]).toBe(1e8); expect(ten[8]).toBeCloseTo(1e8 * (2 / 5), 6); expect(ten[10]).toBe(0);
    expect(addonShape({ id: "b2", kind: "loan", amount: 1e8, years: 10 })).toBe("1~5년 정액, 6~10년 감액");
    expect(addonShape({ id: "b3", kind: "loan", amount: 1e8, years: 4 })).toBe("1~4년 정액 후 0");
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
  it("결합 → 분리: 그래프를 바꾸지 않았으면 결합 전으로, 바꿨으면 분리 불가", () => {
    let s = reducer(initialState(), { type: "addAddon", addon: { id: "L", kind: "loan", amount: 3e8, years: 15 } });
    const before = levels(s);
    s = reducer(s, { type: "mergeAddon", id: "L" });
    expect(s.S0).toBe(1.4e8); expect(s.addons[0].merged).toBeDefined(); expect(canUnmerge(s, s.addons[0])).toBe(true);
    const back = reducer(s, { type: "unmergeAddon", id: "L" });
    expect(back.S0).toBe(1e8); expect(levels(back)).toEqual(before); expect(back.presetId).toBe("level"); expect(back.addons[0].merged).toBeUndefined();
    const edited = reducer(s, { type: "level", age: 60, multiple: 1.5 });
    expect(canUnmerge(edited, edited.addons[0])).toBe(false);
    expect(reducer(edited, { type: "unmergeAddon", id: "L" })).toBe(edited);
  });
});
