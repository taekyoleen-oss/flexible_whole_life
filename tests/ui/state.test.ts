import { describe, expect, it } from "vitest";
import { DEFAULT_ENVELOPE, expandBlocks, validate } from "@/lib/engine";
import { celebrations, deathSegments, initialState, presetContext, reducer, s0FromMonthly, termOf, toEngineInput, type DesignState } from "@/lib/state";

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
    expect(s0FromMonthly(3e5, 0)).toBe(1e10);           // 0으로 나누면 상한 clamp
  });
  it("납입기간은 1~보험기간으로 clamp", () => {
    expect(reducer(initialState(), { type: "payYears", payYears: 0 }).payYears).toBe(1);
    expect(reducer(initialState(), { type: "payYears", payYears: 999 }).payYears).toBe(70); // 40세 남 종신 = 70년
  });
  it("나이가 NaN이면 clamp 하한(15)로 떨어지고 예외를 던지지 않는다", () => {
    expect(reducer(initialState(), { type: "profile", patch: { age: NaN } }).profile.age).toBe(15);
  });
});

describe("불러오기", () => {
  it("깨진 저장 데이터도 안전하게 clamp해서 불러온다", () => {
    const s = reducer(initialState(), {
      type: "load",
      state: { version: 1, profile: { age: 200 }, payYears: 999, S0: 5, blocks: "junk" } as unknown as DesignState,
    });
    expect(s.profile.age).toBe(70);
    expect(s.payYears).toBe(40); // 70세 남 종신 = 40년
    expect(s.S0).toBe(1e6);
    expect(deathSegments(s.blocks)).toEqual([{ fromAge: 70, toAge: 109, multiple: 1, kind: "death" }]);
    expect(s.presetId).toBe("level");
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
    expect(s.presetId).toBe("level");
    s = reducer(s, { type: "profile", patch: { age: 45 } });
    expect(celebrations(s.blocks)).toEqual([{ fromAge: 65, toAge: 65, multiple: 0.2, kind: "celebration" }]);
    const { C } = expandBlocks(s.blocks, 45, termOf(s.profile));
    expect(C[20]).toBe(0.2);
  });
  it("축하금을 편집해도 프리셋(자녀연령형)이 프로필 변경에 계속 반응한다", () => {
    let s = reducer(initialState(), { type: "profile", patch: { childrenAges: [] } });
    s = reducer(s, { type: "preset", id: "child" });
    s = reducer(s, { type: "addCelebration", age: 60, multiple: 0.1 });
    s = reducer(s, { type: "profile", patch: { childrenAges: [1] } });
    expect(s.presetId).toBe("child");
    expect(deathSegments(s.blocks)[0].toAge).toBe(63); // 40 + 24 - 1: 막내 1세 → t=24에서 하락
  });
});

const seg = (s: ReturnType<typeof initialState>) => deathSegments(s.blocks).map((b) => [b.fromAge, b.toAge, b.multiple]);

describe("구간 카드 편집", () => {
  it("분할: 40~109 → 40~74 · 75~109, custom", () => {
    const s = reducer(initialState(), { type: "splitSegment", index: 0 });
    expect(seg(s)).toEqual([[40, 74, 1], [75, 109, 1]]);
    expect(s.presetId).toBe("custom");
  });
  it("toAge를 줄이면 뒤 카드가 앞당겨지고, 늘려서 뒤 카드를 삼키면 카드가 준다", () => {
    let s = reducer(initialState(), { type: "splitSegment", index: 0 });
    s = reducer(s, { type: "segment", index: 0, patch: { toAge: 60 } });
    expect(seg(s)).toEqual([[40, 60, 1], [61, 109, 1]]);
    s = reducer(s, { type: "segment", index: 0, patch: { toAge: 120 } });
    expect(seg(s)).toEqual([[40, 109, 1]]);
  });
  it("마지막 카드 toAge는 항상 최종연령", () => {
    let s = reducer(initialState(), { type: "splitSegment", index: 0 });
    s = reducer(s, { type: "segment", index: 1, patch: { toAge: 90 } });
    expect(seg(s)).toEqual([[40, 74, 1], [75, 109, 1]]);
  });
  it("배수 편집은 0~10 clamp, 삭제는 앞 카드로 합친다", () => {
    let s = reducer(initialState(), { type: "splitSegment", index: 0 });
    s = reducer(s, { type: "segment", index: 1, patch: { multiple: 12 } });
    expect(seg(s)).toEqual([[40, 74, 1], [75, 109, 10]]);
    s = reducer(s, { type: "removeSegment", index: 1 });
    expect(seg(s)).toEqual([[40, 109, 1]]);
    expect(reducer(s, { type: "removeSegment", index: 0 })).toBe(s); // 카드 하나면 삭제 불가
  });
  it("첫 카드 삭제는 다음 카드가 가입연령부터 시작", () => {
    let s = reducer(initialState(), { type: "splitSegment", index: 0 });
    s = reducer(s, { type: "segment", index: 1, patch: { multiple: 0.5 } });
    s = reducer(s, { type: "removeSegment", index: 0 });
    expect(seg(s)).toEqual([[40, 109, 0.5]]);
  });
  it("범위 밖 인덱스는 아무 것도 하지 않는다", () => {
    const s = initialState();
    expect(reducer(s, { type: "segment", index: 9, patch: { multiple: 2 } })).toBe(s);
  });
});

describe("축하금", () => {
  it("추가·수정·삭제, 범위 밖이면 버린다", () => {
    let s = reducer(initialState(), { type: "addCelebration", age: 65, multiple: 0.2 });
    s = reducer(s, { type: "celebration", index: 0, patch: { multiple: 0.5, fromAge: 70 } });
    expect(celebrations(s.blocks)).toEqual([{ fromAge: 70, toAge: 70, multiple: 0.5, kind: "celebration" }]);
    s = reducer(s, { type: "celebration", index: 0, patch: { fromAge: 30 } });
    expect(celebrations(s.blocks)).toEqual([]);
    s = reducer(s, { type: "addCelebration", age: 60, multiple: 0.1 });
    s = reducer(s, { type: "removeCelebration", index: 0 });
    expect(celebrations(s.blocks)).toEqual([]);
  });
});

describe("자동 수정", () => {
  const ctx = (s: ReturnType<typeof initialState>) => ({ S0: s.S0, age: s.profile.age, n: termOf(s.profile), payYears: s.payYears, freq: 12, grossUnit: 0.0015 });
  const codes = (s: ReturnType<typeof initialState>) => { const { S, C } = expandBlocks(s.blocks, s.profile.age, termOf(s.profile)); return validate(S, C, ctx(s), DEFAULT_ENVELOPE).map((v) => v.code); };
  it("E01: 초기 5년 안의 경계를 5년째로 민다", () => {
    let s = reducer(initialState(), { type: "splitSegment", index: 0 });
    s = reducer(s, { type: "segment", index: 0, patch: { toAge: 41 } });
    s = reducer(s, { type: "segment", index: 1, patch: { multiple: 0.5 } });
    expect(codes(s)).toContain("E01");
    s = reducer(s, { type: "autoFix", code: "E01" });
    expect(seg(s)).toEqual([[40, 44, 1], [45, 109, 0.5]]);
    expect(codes(s)).not.toContain("E01");
  });
  it("E04·E05: 배수를 0.2~3으로 clamp", () => {
    let s = reducer(initialState(), { type: "splitSegment", index: 0 });
    s = reducer(s, { type: "segment", index: 1, patch: { multiple: 5 } });
    expect(codes(s)).toContain("E04");
    s = reducer(s, { type: "autoFix", code: "E04" });
    expect(seg(s)[1][2]).toBe(3);
    s = reducer(s, { type: "segment", index: 1, patch: { multiple: 0.05 } });
    expect(codes(s)).toContain("E05");
    s = reducer(s, { type: "autoFix", code: "E05" });
    expect(seg(s)[1][2]).toBe(0.2);
  });
});
