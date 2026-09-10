import { describe, expect, it } from "vitest";
import { expandBlocks } from "@/lib/engine";
import { celebrations, deathSegments, initialState, presetContext, reducer, s0FromMonthly, termOf, toEngineInput } from "@/lib/state";

describe("초기 상태", () => {
  const s = initialState();
  it("40세 남 평준형, 기준보험금 1억, 20년납, 납입면제 ON", () => {
    expect(s.profile.age).toBe(40);
    expect(s.presetId).toBe("level");
    expect(deathSegments(s.blocks)).toEqual([{ fromAge: 40, toAge: 109, multiple: 1, kind: "death" }]);
    expect(s.S0).toBe(1e8);
    expect(toEngineInput(s)).toMatchObject({ sex: "M", age: 40, payYears: 20, S0: 1e8, waiver: true, lowSurrender: false });
    expect(termOf(s.profile)).toBe(70);
  });
});

describe("프로필·예산", () => {
  it("연령·성별이 바뀌면 프리셋을 다시 만든다 (여 112세 → 111세까지)", () => {
    const s = reducer(initialState(), { type: "profile", patch: { age: 50, sex: "F" } });
    expect(deathSegments(s.blocks)).toEqual([{ fromAge: 50, toAge: 111, multiple: 1, kind: "death" }]);
    expect(termOf(s.profile)).toBe(62);
  });
  it("연령은 15~70으로 clamp", () => {
    expect(reducer(initialState(), { type: "profile", patch: { age: 5 } }).profile.age).toBe(15);
    expect(reducer(initialState(), { type: "profile", patch: { age: 99 } }).profile.age).toBe(70);
  });
  it("S0는 100만~100억, 정수", () => {
    expect(reducer(initialState(), { type: "S0", S0: 1234.6 }).S0).toBe(1e6);
    expect(reducer(initialState(), { type: "S0", S0: 5e10 }).S0).toBe(1e10);
    expect(reducer(initialState(), { type: "S0", S0: 123456789.4 }).S0).toBe(123456789);
  });
  it("월 보험료 → 기준보험금 역산은 1만원 단위", () => {
    expect(s0FromMonthly(300000, 250)).toBe(1.2e8);     // 30만 × 10만 / 250
    expect(s0FromMonthly(300000, 133)).toBe(225560000); // 225,563,909 → 만원 반올림
  });
});

describe("프리셋", () => {
  it("자녀연령형: 막내 3세 → 62세(=25세 되는 해)부터 0.3", () => {
    let s = reducer(initialState(), { type: "profile", patch: { childrenAges: [3, 6] } });
    s = reducer(s, { type: "preset", id: "child" });
    expect(s.presetId).toBe("child");
    expect(deathSegments(s.blocks)).toEqual([
      { fromAge: 40, toAge: 61, multiple: 1, kind: "death" },
      { fromAge: 62, toAge: 109, multiple: 0.3, kind: "death" },
    ]);
    expect(presetContext(s.profile).youngestChildAge).toBe(3);
  });
  it("부채 0이면 debtYears는 컨텍스트에서 빠진다", () => {
    expect(presetContext(initialState().profile).debtYears).toBeUndefined();
    const s = reducer(initialState(), { type: "profile", patch: { debt: 1e8, debtYears: 15 } });
    expect(presetContext(s.profile).debtYears).toBe(15);
  });
  it("프리셋 상태에서 프로필을 바꾸면 축하금은 유지된다", () => {
    let s = reducer(initialState(), { type: "addCelebration", age: 65, multiple: 0.2 });
    expect(s.presetId).toBe("custom");
    s = reducer(s, { type: "preset", id: "level" });
    s = reducer(s, { type: "profile", patch: { age: 45 } });
    expect(celebrations(s.blocks)).toEqual([{ fromAge: 65, toAge: 65, multiple: 0.2, kind: "celebration" }]);
    const { C } = expandBlocks(s.blocks, 45, termOf(s.profile));
    expect(C[20]).toBe(0.2);
  });
});
