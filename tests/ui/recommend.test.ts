import { describe, expect, it } from "vitest";
import { annuity } from "@/lib/engine";
import { recommend } from "@/lib/recommend";
import { initialState, reducer, roundS0 } from "@/lib/state";

describe("추천 (니즈 + HLV + 프리셋)", () => {
  it("40세 남 · 연소득 4천만 · 자녀 3·6세 · 부채 2억 · 기존 보장 1억(단체) · 유동 5천만", () => {
    const s = reducer(initialState(), { type: "profile", patch: { income: 4e7, liquidAssets: 5e7, debt: 2e8, childrenAges: [3, 6], groupCover: 1e8 } });
    const r = recommend(s);
    const expected = 4e7 * 0.7 * annuity(22, 0.02) + 2e8 + 2e8 + 3e7 - 1e8 - 5e7;   // ≈ 7.7억, 한도 10억 아래
    expect(r.needs.needs).toBeCloseTo(expected, 0);
    expect(r.suggestedS0).toBe(roundS0(expected));
    expect(r.hlvS0).toBe(roundS0(4e7 * 0.7 * annuity(25, 0.02)));
    expect(r.presetId).toBe("child");
    expect(r.reason).toContain("막내");
  });
  it("필요보장이 0 이하면 기준보험금 최소값(1천만)을 제안하고, 한도(10억)를 넘지 않는다", () => {
    const low = reducer(initialState(), { type: "profile", patch: { income: 0, liquidAssets: 9e8 } });
    expect(recommend(low).needs.needs).toBe(0);
    expect(recommend(low).suggestedS0).toBe(1e7);
    const rich = reducer(initialState(), { type: "profile", patch: { income: 5e8, childrenAges: [1, 2, 3], debt: 5e9 } });
    expect(recommend(rich).suggestedS0).toBe(1e9);
  });
  it("부채만 있으면 부채상환형, 단체보험만 있으면 단체보험보완형, 50세 이상 자녀 독립은 상속준비형", () => {
    expect(recommend(reducer(initialState(), { type: "profile", patch: { debt: 1e8 } })).presetId).toBe("debt");
    expect(recommend(reducer(initialState(), { type: "profile", patch: { groupCover: 1e8 } })).presetId).toBe("group");
    expect(recommend(reducer(initialState(), { type: "profile", patch: { age: 55, childrenAges: [30] } })).presetId).toBe("estate");
    expect(recommend(initialState()).presetId).toBe("level");
  });
});
