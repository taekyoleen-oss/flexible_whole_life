import { describe, expect, it } from "vitest";
import { PRESETS, buildPreset, type PresetId } from "@/lib/engine/presets";
import { DEFAULT_ENVELOPE, validate } from "@/lib/engine/envelope";
import { expandBlocks } from "@/lib/engine/schedule";

const ctx = { age: 40, n: 70, youngestChildAge: 3, debtYears: 15, retirementAge: 65, groupCoverEndAge: 60, growthEndAge: 70 };
const base = { S0: 1e8, age: 40, n: 70, payYears: 20, freq: 12, grossUnit: 0.0015 };

describe("프리셋 6종", () => {
  it("모두 기본 envelope 통과, 초기 5년은 1.0(상속·단체는 0.5)", () => {
    for (const id of Object.keys(PRESETS) as PresetId[]) {
      const blocks = buildPreset(id, ctx);
      const { S, C } = expandBlocks(blocks, 40, 70);
      expect(validate(S, C, base, DEFAULT_ENVELOPE), id).toEqual([]);
      expect(new Set(S.slice(0, 5)).size, id).toBe(1);
    }
  });
  it("자녀연령형: 막내 25세(=22년 후)부터 0.3", () => {
    const { S } = expandBlocks(buildPreset("child", ctx), 40, 70);
    expect(S[21]).toBe(1); expect(S[22]).toBe(0.3);
  });
  it("단체보험보완형: 60세에 1.0 도달", () => {
    const { S } = expandBlocks(buildPreset("group", ctx), 40, 70);
    expect(S[15]).toBe(0.5); expect(S[20]).toBe(1); expect(S[16]).toBeCloseTo(0.6, 12);
  });
  it("상속준비형: 5년 후 체증, 2.0 상한", () => {
    const { S } = expandBlocks(buildPreset("estate", ctx), 40, 70);
    expect(S[4]).toBe(0.5); expect(S[5]).toBeCloseTo(0.55, 12); expect(Math.max(...S)).toBe(2);
  });
});

describe("envelope", () => {
  const level = new Array(70).fill(1), C0 = new Array(71).fill(0);
  it("E01 초기 5년 변경", () => {
    const S = [...level]; S[3] = 1.2;
    expect(validate(S, C0, base, DEFAULT_ENVELOPE).map((v) => v.code)).toContain("E01");
  });
  it("E02 연 20% 초과 증액", () => {
    const S = [...level]; for (let t = 10; t < 70; t++) S[t] = 1.5;
    expect(validate(S, C0, base, DEFAULT_ENVELOPE).map((v) => v.code)).toContain("E02");
  });
  it("E03 70세 이후 증액", () => {
    const S = [...level]; for (let t = 31; t < 70; t++) S[t] = 1.1;
    expect(validate(S, C0, base, DEFAULT_ENVELOPE).map((v) => v.code)).toContain("E03");
  });
  it("E04 최대 배수 · E05 감액 하한 · E06 최소 금액 · E07 심사 한도", () => {
    const S = [...level]; for (let t = 5; t < 70; t++) S[t] = 3.5;
    expect(validate(S, C0, base, DEFAULT_ENVELOPE).map((v) => v.code)).toContain("E04");
    const S2 = [...level]; for (let t = 5; t < 70; t++) S2[t] = 0.05; // 500만원 < 최소 1,000만원
    const codes = validate(S2, C0, base, DEFAULT_ENVELOPE).map((v) => v.code);
    expect(codes).toContain("E05"); expect(codes).toContain("E06");
    expect(validate(level, C0, { ...base, S0: 2e9 }, DEFAULT_ENVELOPE).map((v) => v.code)).toContain("E07");
  });
  it("E08 생존급부 > 누적 보험료", () => {
    const C = [...C0]; C[3] = 1;   // 3년 후 S0 전액 축하금, 납입 3년치는 0.0015·12·3 = 5.4%
    expect(validate(level, C, base, DEFAULT_ENVELOPE).map((v) => v.code)).toContain("E08");
    const C2 = [...C0]; C2[10] = 0.1;
    expect(validate(level, C2, base, DEFAULT_ENVELOPE)).toEqual([]);
  });
});
