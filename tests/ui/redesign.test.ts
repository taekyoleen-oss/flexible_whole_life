import { describe, expect, it } from "vitest";
import { budgetFor, checkRules, compareOptions, conversionLoss, fromDesign, fromManual, newDesignFor, remainingBlocks, runRedesign, type OldContract } from "@/lib/redesign";
import { DEFAULT_SETTINGS, initialState, levels, reducer } from "@/lib/state";

const design = reducer(reducer(initialState(), { type: "level", age: 50, multiple: 1.5 }), { type: "addCelebration", age: 65 });   // 40세 남 1억, 50세부터 1.5배

describe("원계약", () => {
  it("현재 설계 + 경과년 10 → 50세 원계약, 남은 스케줄은 50세 보험금(1.5억)을 1로 정규화", () => {
    const old = fromDesign(design, 10);
    expect(old).toMatchObject({ sex: "M", entryAge: 40, elapsed: 10, attainedAge: 50, S0: 1e8, payYears: 20, interest: 0.025 });
    expect(old.benefitNow).toBe(1.5e8);
    const rem = remainingBlocks(old);
    expect(rem.filter((b) => b.kind === "death")[0]).toMatchObject({ fromAge: 50, multiple: 1 });
    expect(rem.some((b) => b.kind === "celebration" && b.fromAge === 65)).toBe(true);
    expect(old.reserve).toBeGreaterThan(0); expect(old.cash).toBeGreaterThan(0); expect(old.cash).toBeLessThanOrEqual(old.reserve);
    expect(old.monthlyGross).toBeGreaterThan(0);
  });
  it("직접 입력: 평준 보험금·예정이율 3.5%, 준비금 직접 지정", () => {
    const old = fromManual({ sex: "F", entryAge: 35, benefit: 2e8, payYears: 20, elapsed: 12, interest: 0.035, reserve: 3e7, cash: 2.5e7 }, DEFAULT_SETTINGS);
    expect(old).toMatchObject({ attainedAge: 47, S0: 2e8, benefitNow: 2e8, interest: 0.035, reserve: 3e7, cash: 2.5e7 });
    expect(remainingBlocks(old).filter((b) => b.kind === "death")).toEqual([{ fromAge: 47, toAge: 111, multiple: 1, kind: "death" }]);
  });
});

describe("예산 모드", () => {
  const old = fromDesign(design, 10);
  it("지속 = 준비금 + 같은 보험료 + 남은 10년, 감액 = 낮춘 보험료, 중단 = 환급금 + 0", () => {
    expect(budgetFor(old, "continue")).toMatchObject({ carry: old.reserve, monthlyGross: old.monthlyGross, payYears: 10 });
    expect(budgetFor(old, "reduce", 100000)).toMatchObject({ carry: old.reserve, monthlyGross: 100000, payYears: 10 });
    expect(budgetFor(old, "stop")).toMatchObject({ carry: old.cash, monthlyGross: 0, payYears: 0 });
  });
  it("납입이 이미 끝난 원계약은 지속 모드도 보험료 0", () => {
    expect(budgetFor(fromDesign(design, 25), "continue")).toMatchObject({ monthlyGross: 0, payYears: 0 });
  });
});

describe("규칙·손실·비교", () => {
  const old = fromDesign(design, 10);
  const nd = newDesignFor(old, design.settings);   // 중첩 편집기 초기 상태(50세, 남은 스케줄)
  it("새 설계 초기 상태: 50세, custom, 변경점 없음, 설정 승계", () => {
    expect(nd.profile.age).toBe(50); expect(nd.presetId).toBe("custom"); expect(nd.anchors).toEqual([]);
    expect(levels(nd)[0]).toBe(1);
  });
  it("지속 모드 그대로면 R01(등식)·R02 통과, 손실은 같은 기초율이라 0", () => {
    const r = runRedesign(old, budgetFor(old, "continue"), nd, design.settings);
    const rules = checkRules(old, nd, r, null);
    expect(rules.find((x) => x.code === "R01")?.ok).toBe(true);
    expect(rules.find((x) => x.code === "R02")?.ok).toBe(true);
    expect(rules.find((x) => x.code === "R03")?.ok).toBe(true);
    expect(Math.abs(conversionLoss(old, design.settings))).toBeLessThan(1);
  });
  it("재설계 직후 5년 안에 보험금을 올리면 R02 위반, 1년 안에 또 하면 R03 경고", () => {
    const up = { ...nd, blocks: [{ fromAge: 50, toAge: 52, multiple: 1, kind: "death" as const }, { fromAge: 53, toAge: 109, multiple: 1.2, kind: "death" as const }] };
    const r = runRedesign(old, budgetFor(old, "continue"), up, design.settings);
    const rules = checkRules(old, up, r, Date.now() - 100 * 86400e3);
    expect(rules.find((x) => x.code === "R02")?.ok).toBe(false);
    expect(rules.find((x) => x.code === "R03")?.ok).toBe(false);
  });
  it("원계약 이율이 현재보다 높으면 전환 손실 > 0, 현재 이율이 더 높으면 R01 위반(기초율 차익)", () => {
    const oldHi: OldContract = { ...old, interest: 0.035 };
    expect(conversionLoss(oldHi, design.settings)).toBeGreaterThan(0);
    const hiNow = { ...design.settings, assumption: { ...design.settings.assumption, interest: 0.035 } };
    const oldLo: OldContract = { ...old, interest: 0.025 };
    const r = runRedesign(oldLo, budgetFor(oldLo, "continue"), nd, hiNow);
    expect(checkRules(oldLo, nd, r, null).find((x) => x.code === "R01")?.ok).toBe(false);
  });
  it("비교안 4개: 유지·감액완납·해지·재설계, 해지는 환급금", () => {
    const r = runRedesign(old, budgetFor(old, "continue"), nd, design.settings);
    const rows = compareOptions(old, r, design.settings);
    expect(rows.map((x) => x.id)).toEqual(["keep", "paidup", "surrender", "redesign"]);
    expect(rows[2].cashNow).toBe(old.cash);
    expect(rows[1].monthly).toBe(0);
    expect(rows[1].benefitNow).toBeLessThan(rows[0].benefitNow);
    expect(rows[3].benefitNow).toBeGreaterThan(rows[0].benefitNow * 0.97);   // 신계약비가 없어 같은 보험료로 조금 더 산다
    expect(rows[3].benefitNow).toBeLessThan(rows[0].benefitNow * 1.1);
  });
});
