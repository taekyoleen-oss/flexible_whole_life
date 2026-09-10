import { describe, expect, it } from "vitest";
import { ASSUMPTIONS, DEFAULT_ENVELOPE, getAssumption } from "@/lib/engine";
import { allowedRange, DEFAULT_SETTINGS, envelopeOf, evaluate, firstEditableAge, initialState, reducer, sanitizeSettings, type DesignState } from "@/lib/state";

describe("설정(가정 세트·envelope)은 설계 상태의 일부", () => {
  const s0 = initialState();
  it("기본 설정은 default-2026 세트와 기본 envelope", () => {
    expect(s0.settings.assumption.id).toBe("default-2026");
    expect(s0.settings.envelope).toEqual(DEFAULT_ENVELOPE);
    expect(envelopeOf(s0)).toBe(s0.settings.envelope);
  });
  it("가정 세트를 바꾸면 산출이 바뀐다 (검증 세트 3.4%는 보험료가 더 낮다)", () => {
    const r0 = evaluate(s0);
    const s = reducer(s0, { type: "settings", patch: { assumption: getAssumption("verify-term-1504") } });
    expect(s.settings.assumption.id).toBe("verify-term-1504");
    expect(evaluate(s).per100k.gross).toBeLessThan(r0.per100k.gross);
  });
  it("숫자를 고치면 id가 custom이 되고 원본 세트를 label에 남긴다", () => {
    const s = reducer(s0, { type: "settings", patch: { assumption: { ...s0.settings.assumption, interest: 0.03 } } });
    expect(s.settings.assumption.id).toBe("custom");
    expect(s.settings.assumption.label).toContain("default-2026");
    expect(evaluate(s).meta.assumptionId).toBe("custom");
  });
  it("envelope 고정 연수를 10으로 바꾸면 첫 편집 연령이 50세가 되고 50세는 0칸", () => {
    const s = reducer(s0, { type: "settings", patch: { envelope: { ...DEFAULT_ENVELOPE, fixYears: 10 } } });
    expect(firstEditableAge(s.profile, envelopeOf(s))).toBe(50);
    expect(allowedRange(s, 50)).toMatchObject({ editable: true, steps: 0 });
    expect(allowedRange(s, 49).editable).toBe(false);
  });
  it("초기화·새 설계는 설정을 유지하고, 프로필 변경도 유지한다", () => {
    let s = reducer(s0, { type: "settings", patch: { assumption: getAssumption("expense-simple") } });
    s = reducer(s, { type: "reset" });
    expect(s.settings.assumption.id).toBe("expense-simple");
    s = reducer(s, { type: "profile", patch: { age: 50 } });
    expect(s.settings.assumption.id).toBe("expense-simple");
  });
  it("손상된 설정을 load하면 기본값으로 돌아온다", () => {
    const s = reducer(s0, { type: "load", state: { version: 1, settings: { assumption: { id: "x", interest: "abc" }, envelope: { fixYears: "no", maxMultiple: 4 } } } as unknown as DesignState });
    expect(s.settings.assumption).toEqual(DEFAULT_SETTINGS.assumption);
    expect(s.settings.envelope).toEqual({ ...DEFAULT_ENVELOPE, maxMultiple: 4 });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ assumption: ASSUMPTIONS[2], envelope: DEFAULT_ENVELOPE }).assumption.id).toBe(ASSUMPTIONS[2].id);
  });
});
