import { describe, expect, it } from "vitest";
import { compute, DEFAULT_ENVELOPE, getAssumption, validate } from "@/lib/engine";
import { buildSample, SAMPLES } from "@/lib/samples";
import { ASSUMPTION_ID, TABLE, toEngineInput } from "@/lib/state";

describe("샘플 설계 3종", () => {
  it("월 예산 ±5% 안에서 기준보험금이 1천만원 단위로 역산되고 envelope를 통과한다", () => {
    expect(SAMPLES.map((s) => s.presetId)).toEqual(["child", "debt", "estate"]);
    for (const sample of SAMPLES) {
      const s = buildSample(sample);
      expect(s.S0 % 1e7, sample.id).toBe(0);
      expect(s.updatedAt, sample.id).toBeGreaterThan(0);
      const r = compute(toEngineInput(s), getAssumption(ASSUMPTION_ID), TABLE);
      expect(Math.abs(r.monthly.gross - sample.monthly) / sample.monthly, sample.id).toBeLessThan(0.05);   // 1천만원 단위 반올림 오차(기준보험금이 작을수록 커진다)
      const v = validate(r.S, r.C, { S0: s.S0, age: s.profile.age, n: r.n, payYears: s.payYears, freq: 12, grossUnit: r.perUnit.gross }, DEFAULT_ENVELOPE);
      expect(v, sample.id).toEqual([]);
    }
  });
  it("샘플 프로필이 프리셋 경계를 만든다", () => {
    const child = buildSample(SAMPLES[0]);
    expect(child.blocks[0]).toMatchObject({ fromAge: 35, toAge: 51, multiple: 1 }); // 막내 2세 → 25세 = 23년 후 0.3, 그 6년 전(17년 후)부터 감액
    const debt = buildSample(SAMPLES[1]);
    expect(debt.blocks.at(-1)).toMatchObject({ multiple: 0.3, toAge: 111 });
  });
});
