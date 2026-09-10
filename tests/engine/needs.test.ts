import { describe, expect, it } from "vitest";
import kli7 from "@/lib/engine/data/rates-kli7.json";
import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import { annuity, needs, recommendPreset } from "@/lib/engine/needs";
import { compareAtBudget } from "@/lib/engine/compare";
import { buildPreset } from "@/lib/engine/presets";
import type { RateTable } from "@/lib/engine/types";

const a = ASSUMPTIONS[0];
const table = kli7 as RateTable;

describe("니즈·HLV", () => {
  it("확정연금 현가 a(22, 2%) = 17.658", () => expect(annuity(22, 0.02)).toBeCloseTo(17.658, 3));
  it("40세 · 연소득 6천만 · 자녀 3·6세 · 부채 2억 · 기존 보장 1억 · 유동 5천만", () => {
    const r = needs({ age: 40, income: 6e7, liquidAssets: 5e7, debt: 2e8, childrenAges: [3, 6], existingCover: 1e8 }, a.needs);
    // 6천만×0.7×a(22) + 2×1억 + 2억 + 3천만 − 1억 − 5천만
    expect(r.needs).toBeCloseTo(6e7 * 0.7 * annuity(22, 0.02) + 2e8 + 2e8 + 3e7 - 1e8 - 5e7, 0);
    expect(r.hlv).toBeCloseTo(6e7 * 0.7 * annuity(25, 0.02), 0);
    expect(r.needs).toBeGreaterThan(0);
  });
  it("프리셋 추천", () => {
    expect(recommendPreset({ age: 40, childrenAges: [3], debt: 0, groupCover: 0 })).toBe("child");
    expect(recommendPreset({ age: 45, childrenAges: [], debt: 1e8, groupCover: 0 })).toBe("debt");
    expect(recommendPreset({ age: 35, childrenAges: [], debt: 0, groupCover: 1e8 })).toBe("group");
    expect(recommendPreset({ age: 55, childrenAges: [30], debt: 0, groupCover: 0 })).toBe("estate");
    expect(recommendPreset({ age: 30, childrenAges: [], debt: 0, groupCover: 0 })).toBe("level");
  });
});

describe("같은 예산 3안 비교", () => {
  const blocks = buildPreset("child", { age: 40, n: 70, youngestChildAge: 3 });
  const rows = compareAtBudget(300000, { sex: "M", age: 40, payYears: 20, blocks }, a, table);
  it("3안 모두 월 보험료 = 예산(±1원), 설계형 초기 보험금 > 평준형", () => {
    expect(rows.map((r) => r.id)).toEqual(["level", "combo", "designed"]);
    for (const r of rows) expect(Math.abs(r.monthly - 300000)).toBeLessThanOrEqual(1);
    const [level, , designed] = rows;
    expect(designed.S0).toBeGreaterThan(level.S0);
  });
});
