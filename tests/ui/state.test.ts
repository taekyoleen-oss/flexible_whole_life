import { describe, expect, it } from "vitest";
import { DEFAULT_ENVELOPE, expandBlocks, validate } from "@/lib/engine";
import { CELEBRATION_RATIO, STEP, allowedRange, parseAgeList, celebrations, deathSegments, effective, evaluate, firstEditableAge, floorMultiple, initialState, levels, NO_INFO, presetContext, reducer, s0FromMonthly, termOf, toEngineInput, type DesignState } from "@/lib/state";

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
  it("S0는 1천만~100억, 1천만원 단위", () => {
    expect(reducer(initialState(), { type: "S0", S0: 1234.6 }).S0).toBe(1e7);
    expect(reducer(initialState(), { type: "S0", S0: 5e10 }).S0).toBe(1e10);
    expect(reducer(initialState(), { type: "S0", S0: 123456789.4 }).S0).toBe(1.2e8);
    expect(reducer(initialState(), { type: "S0", S0: 125e6 }).S0).toBe(1.3e8);   // 반올림
  });
  it("월 보험료 → 기준보험금 역산은 1만원 단위", () => {
    expect(s0FromMonthly(300000, 250)).toBe(1.2e8);     // 30만 × 10만 / 250
    expect(s0FromMonthly(300000, 133)).toBe(2.3e8);     // 225,563,909 → 1천만원 반올림
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

describe("effective (고객 실납입 기준 요약)", () => {
  it("저해지 OFF면 표준 보험료를 그대로 쓴다", () => {
    const s0 = initialState();
    const r0 = evaluate(s0);
    const eff = effective(r0, s0.payYears);
    expect(eff.isLow).toBe(false);
    expect(eff.monthly).toBe(r0.monthly.gross);
    expect(eff.totalPaid).toBe(r0.totalPaid);
  });
  it("저해지 ON이면 인하된 보험료를 쓴다", () => {
    const s = reducer(initialState(), { type: "lowSurrender", on: true });
    const r = evaluate(s);
    const eff = effective(r, s.payYears);
    expect(eff.isLow).toBe(true);
    expect(eff.monthly).toBe(r.lowSurrender!.monthlyGross);
    expect(eff.monthly).toBeLessThan(r.monthly.gross);
    expect(eff.paid[s.payYears]).toBe(eff.totalPaid);
    expect(eff.totalPaid).toBeLessThan(r.totalPaid);
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
    expect(s.S0).toBe(1e7);
    expect(deathSegments(s.blocks)).toEqual([{ fromAge: 70, toAge: 109, multiple: 1, kind: "death" }]);
    expect(s.presetId).toBe("level");
  });
  it("성별·자녀연령이 깨져 있어도 안전하게 clamp해서 불러온다", () => {
    const s = reducer(initialState(), {
      type: "load",
      state: { version: 1, profile: { sex: "X", childrenAges: "3" } } as unknown as DesignState,
    });
    expect(s.profile.sex).toBe("M");
    expect(s.profile.childrenAges).toEqual([]);
    expect(() => evaluate(s)).not.toThrow();
  });
});

describe("프리셋", () => {
  it("자녀연령형: 기본은 표준 경계(20년 후 0.3), 입력 반영을 켜면 막내 3세 → 62세부터 0.3", () => {
    let s = reducer(initialState(), { type: "profile", patch: { childrenAges: [3, 6] } });
    s = reducer(s, { type: "preset", id: "child" });
    expect(s.presetId).toBe("child");
    expect(levels(s).slice(13, 21)).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);   // 표준: 20년 후(60세) 0.3, 그 6년 전부터 매년 0.1씩
    expect(presetContext(s.profile).youngestChildAge).toBe(5);
    s = reducer(s, { type: "applyInfo", applied: { child: true } });
    expect(s.infoApplied.child).toBe(true);
    expect(levels(s).slice(15, 23)).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);   // 막내 3세: 22년 후(62세) 0.3
    expect(presetContext(s.profile, undefined, s.infoApplied).youngestChildAge).toBe(3);
    s = reducer(s, { type: "applyInfo", applied: { child: false }, S0: 3e8, presetId: "level" });
    expect(s.S0).toBe(3e8); expect(s.presetId).toBe("level"); expect(s.infoApplied.child).toBe(false);
    expect(s.infoApplied.income).toBe(true);                       // 기준보험금을 반영하면 연소득 반영 표시
    expect(reducer(s, { type: "S0", S0: 2e8 }).infoApplied.income).toBe(false);   // 손으로 바꾸면 해제
  });
  it("부채 만기는 표준 20년, 입력 반영을 켜고 부채가 있을 때만 프로필 값", () => {
    expect(presetContext(initialState().profile).debtYears).toBe(20);
    const s = reducer(initialState(), { type: "profile", patch: { debt: 1e8, debtYears: 15 } });
    expect(presetContext(s.profile).debtYears).toBe(20);
    expect(presetContext(s.profile, undefined, { ...s.infoApplied, debt: true }).debtYears).toBe(15);
    expect(presetContext(reducer(s, { type: "profile", patch: { debt: 0 } }).profile, undefined, { ...s.infoApplied, debt: true }).debtYears).toBe(20);
  });
  it("프리셋 상태에서 프로필을 바꾸면 축하금은 유지된다", () => {
    let s = reducer(initialState(), { type: "addCelebration", age: 65 });
    expect(s.presetId).toBe("level");
    s = reducer(s, { type: "profile", patch: { age: 45 } });
    expect(celebrations(s.blocks)).toEqual([{ fromAge: 65, toAge: 65, multiple: 0.1, kind: "celebration" }]);
    const { C } = expandBlocks(s.blocks, 45, termOf(s.profile));
    expect(C[20]).toBe(0.1);
  });
  it("축하금을 편집해도 프리셋(자녀연령형, 입력 반영)이 프로필 변경에 계속 반응한다", () => {
    let s = reducer(initialState(), { type: "profile", patch: { childrenAges: [] } });
    s = reducer(s, { type: "applyInfo", applied: { child: true }, presetId: "child" });
    expect(deathSegments(s.blocks)[0].toAge).toBe(53);   // 자녀 정보가 없으면 표준 경계(20년 후 0.3, 그 6년 전 54세부터 감액)
    s = reducer(s, { type: "addCelebration", age: 60 });
    s = reducer(s, { type: "profile", patch: { childrenAges: [1] } });
    expect(s.presetId).toBe("child");
    expect(deathSegments(s.blocks)[0].toAge).toBe(57); // 막내 1세 → t=24에 0.3, 그 6년 전(t=18, 58세)부터 감액
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
    let s = reducer(initialState(), { type: "addCelebration", age: 65 });
    s = reducer(s, { type: "celebration", index: 0, patch: { fromAge: 70 } });
    expect(celebrations(s.blocks)).toEqual([{ fromAge: 70, toAge: 70, multiple: 0.1, kind: "celebration" }]);
    s = reducer(s, { type: "celebration", index: 0, patch: { fromAge: 30 } });
    expect(celebrations(s.blocks)).toEqual([]);
    s = reducer(s, { type: "addCelebration", age: 60 });
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

describe("그래프 단계 편집 (level 액션)", () => {
  const s0 = initialState(); // 40세 남 · 1억 · 평준 1.0
  const S = (s: DesignState) => levels(s);
  it("상수: 1칸 10%, 축하금 10%, 첫 편집 연령 45", () => {
    expect(STEP).toBe(0.1); expect(CELEBRATION_RATIO).toBe(0.1);
    expect(firstEditableAge(s0.profile)).toBe(45);
    expect(s0.anchors).toEqual([]);
  });
  it("45세 이전은 편집 불가, 45세는 0칸, 50세는 45세부터 5칸", () => {
    expect(allowedRange(s0, 44).editable).toBe(false);
    expect(allowedRange(s0, 45)).toMatchObject({ editable: true, steps: 0, ref: 45, prev: 1, min: 1, max: 1 });
    expect(allowedRange(s0, 50)).toMatchObject({ editable: true, steps: 5, ref: 45, prev: 1, min: 0.5, max: 1.5 });
  });
  it("50세를 1.7로 올리면 5칸 상한 1.5로 잘리고, 45~49세가 매년 한 칸씩 오르며, 50세 이후는 1.5", () => {
    const s = reducer(s0, { type: "level", age: 50, multiple: 1.7 });
    expect(S(s)[4]).toBe(1);
    expect(S(s).slice(5, 11)).toEqual([1.1, 1.2, 1.3, 1.4, 1.5, 1.5]);
    expect(S(s)[69]).toBe(1.5);
    expect(s.presetId).toBe("custom");
    expect(s.anchors).toEqual([50]);
  });
  it("50세에 3칸만 올리면 47세부터 매년 한 칸씩 오른다", () => {
    const s = reducer(s0, { type: "level", age: 50, multiple: 1.3 });
    expect(S(s).slice(5, 11)).toEqual([1, 1, 1.1, 1.2, 1.3, 1.3]);
    const d = reducer(s0, { type: "level", age: 50, multiple: 0.8 });   // 2칸 내리면 48세부터
    expect(S(d).slice(5, 11)).toEqual([1, 1, 1, 0.9, 0.8, 0.8]);
  });
  it("60세는 마지막 변경점(50세)부터 10칸, E04 상한 3배", () => {
    let s = reducer(s0, { type: "level", age: 50, multiple: 1.5 });
    expect(allowedRange(s, 60)).toMatchObject({ steps: 10, ref: 50, prev: 1.5, min: 0.5, max: 2.5 });
    s = reducer(s, { type: "level", age: 60, multiple: 9 });
    expect(S(s).slice(10, 21)).toEqual([1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.5]);   // 50~59세 램프, 60세부터 2.5
    s = reducer(s, { type: "level", age: 70, multiple: 9 });   // 10칸이면 3.5지만 상한 3
    expect(S(s)[30]).toBe(3);
    expect(s.anchors).toEqual([50, 60, 70]);
    expect(allowedRange(s, 55)).toMatchObject({ steps: 5, ref: 50, prev: 2.1 });   // prev = 지금 55세 값
  });
  it("변경점을 다시 움직이면 지금 값 기준 ±칸 수이고, 기존 모양 위에 변화폭이 더해져 뒤 구간도 함께 움직인다", () => {
    let s = reducer(s0, { type: "level", age: 50, multiple: 1.5 });
    s = reducer(s, { type: "level", age: 60, multiple: 2.5 });
    expect(allowedRange(s, 50)).toMatchObject({ ref: 45, prev: 1.6, steps: 5, min: 1.1, max: 2.1 });   // 50세는 60세를 향한 램프의 첫 해(1.6)
    s = reducer(s, { type: "level", age: 50, multiple: 1.5 });   // Δ = −0.1: 49세에만 −0.1, 50세부터 −0.1
    expect(S(s).slice(5, 11)).toEqual([1.1, 1.2, 1.3, 1.4, 1.4, 1.5]);
    expect(S(s)[20]).toBe(2.4);   // 60세 변경점은 같은 폭(−0.1)만큼 이동
    s = reducer(s, { type: "level", age: 50, multiple: 0 });    // 하한 1.5 − 5칸 = 1.0: 45~49세에 −0.1…−0.5, 뒤 구간 −0.5
    expect(S(s).slice(5, 11)).toEqual([1, 1, 1, 1, 0.9, 1]);
    expect(S(s)[20]).toBe(1.9);
    expect(s.anchors).toEqual([50, 60]);
  });
  it("프리셋 모양은 유지된 채 편집된다: 자녀연령형 65세 +3칸", () => {
    const c = reducer(s0, { type: "preset", id: "child" });   // 표준: 54~60세 0.9→0.3
    expect(S(c).slice(13, 22)).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.3]);
    expect(allowedRange(c, 65)).toMatchObject({ ref: 45, prev: 0.3, steps: 20, min: 0.2, max: 2.3 });
    const s = reducer(c, { type: "level", age: 65, multiple: 0.6 });
    expect(S(s).slice(13, 22)).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.3]);   // 감액 계단 그대로
    expect(S(s).slice(22, 27)).toEqual([0.4, 0.5, 0.6, 0.6, 0.6]);   // 62·63·64세 램프, 65세부터 +0.3
    expect(S(s)[69]).toBe(0.6);
    expect(s.presetId).toBe("custom"); expect(s.anchors).toEqual([65]);
    // 은퇴증액형: 0.1 단위가 아닌 값 위에서도 되돌리면 원래대로
    const r = reducer(s0, { type: "preset", id: "retire" });
    const base = { S: levels(r), anchors: r.anchors };
    let e = reducer(r, { type: "level", age: 70, multiple: levels(r)[30] + 0.2, base });
    expect(S(e)[30]).toBeCloseTo(levels(r)[30] + 0.2, 4);
    e = reducer(e, { type: "level", age: 70, multiple: levels(r)[30], base });
    expect(S(e)).toEqual(levels(r));
  });
  it("드래그 중에는 시작 시점(base)을 기준으로 계산해 되돌리면 원래대로 돌아온다", () => {
    const base = { S: levels(s0), anchors: s0.anchors };
    let s = reducer(s0, { type: "level", age: 50, multiple: 1.3, base });
    s = reducer(s, { type: "level", age: 50, multiple: 1.5, base });
    expect(S(s)[10]).toBe(1.5); expect(S(s)[7]).toBe(1.3);
    s = reducer(s, { type: "level", age: 50, multiple: 1.0, base });
    expect(S(s)).toEqual(levels(s0));
    expect(s.anchors).toEqual([]);
  });
  it("하한은 E05 20%와 E06 1,000만원 중 큰 쪽", () => {
    expect(floorMultiple(1e8)).toBe(0.2);
    expect(floorMultiple(2e7)).toBe(0.5);
    const small = reducer(s0, { type: "S0", S0: 2e7 });
    expect(S(reducer(small, { type: "level", age: 50, multiple: 0 }))[10]).toBe(0.5);
    const s = reducer(s0, { type: "level", age: 60, multiple: 0 });      // 15칸 아래 → 하한 0.2
    expect(S(s)[20]).toBe(0.2);
  });
  it("편집 불가 연령·변화 없음은 같은 상태 참조를 돌려주고 변경점을 남기지 않는다", () => {
    expect(reducer(s0, { type: "level", age: 44, multiple: 2 })).toBe(s0);
    expect(reducer(s0, { type: "level", age: 45, multiple: 1.3 })).toBe(s0);
    expect(reducer(s0, { type: "level", age: 50, multiple: 1 })).toBe(s0);
  });
  it("프리셋·카드 편집은 변경점을 지우고, 연령 변경은 범위 밖 변경점만 버린다", () => {
    const s = reducer(s0, { type: "level", age: 50, multiple: 1.5 });
    expect(reducer(s, { type: "preset", id: "level" }).anchors).toEqual([]);
    expect(reducer(s, { type: "splitSegment", index: 0 }).anchors).toEqual([]);
    expect(reducer(s, { type: "profile", patch: { age: 48 } }).anchors).toEqual([]);   // 첫 편집 연령 53세보다 앞
    expect(reducer(s, { type: "profile", patch: { age: 42 } }).anchors).toEqual([50]);
  });
});

describe("축하금 10% 규칙", () => {
  it("해당 연령 사망보험금의 10%이고, 보험금이 바뀌면 따라간다", () => {
    let s = reducer(initialState(), { type: "addCelebration", age: 65 });
    expect(celebrations(s.blocks)).toEqual([{ fromAge: 65, toAge: 65, multiple: 0.1, kind: "celebration" }]);
    s = reducer(s, { type: "level", age: 60, multiple: 2.5 });   // 45→60 15칸, 상한 2.5
    expect(celebrations(s.blocks)[0].multiple).toBe(0.25);
    s = reducer(s, { type: "celebration", index: 0, patch: { fromAge: 55 } });
    expect(celebrations(s.blocks)[0]).toMatchObject({ fromAge: 55, multiple: 0.21 });  // 45~59세 램프 중 55세(2.1배)의 10%
  });
  it("여러 나이에 각각 둘 수 있고, 같은 나이는 하나만 남으며, 하나를 지워도 나머지는 유지된다", () => {
    let s = initialState();
    for (const age of [65, 70, 75, 70]) s = reducer(s, { type: "addCelebration", age });
    expect(celebrations(s.blocks).map((c) => c.fromAge)).toEqual([65, 70, 75]);
    const r = evaluate(s);
    expect([r.C[25], r.C[30], r.C[35]]).toEqual([0.1, 0.1, 0.1]);
    s = reducer(s, { type: "removeCelebration", index: 1 });
    expect(celebrations(s.blocks).map((c) => c.fromAge)).toEqual([65, 75]);
  });
  it("같은 나이에 두 번 추가하지 않는다", () => {
    let s = reducer(initialState(), { type: "addCelebration", age: 65 });
    s = reducer(s, { type: "addCelebration", age: 65 });
    expect(celebrations(s.blocks)).toHaveLength(1);
  });
});

describe("축하금 나이 목록 파싱 (parseAgeList)", () => {
  it("쉼표·공백 구분, 범위 밖·중복·정수 아님 제외, 오름차순", () => {
    expect(parseAgeList("65, 55 70,70 abc 30 2.5 120", 40, 111)).toEqual([55, 65, 70]);
    expect(parseAgeList("", 40, 111)).toEqual([]);
  });
});

describe("retire boundary shared by retire/group presets", () => {
  it("group end age follows retirement age only when retire flag is on", () => {
    const s = { ...initialState(), profile: { ...initialState().profile, retirementAge: 60 } };
    expect(presetContext(s.profile).groupCoverEndAge).toBe(65);
    expect(presetContext(s.profile).retirementAge).toBe(65);
    const c = presetContext(s.profile, undefined, { ...NO_INFO, retire: true });
    expect(c.groupCoverEndAge).toBe(60);
    expect(c.retirementAge).toBe(60);
  });
});
