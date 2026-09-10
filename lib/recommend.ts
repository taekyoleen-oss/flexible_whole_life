import { needs, PRESETS, recommendPreset, type NeedsResult, type PresetId } from "@/lib/engine";
import { assumptionOf, envelopeOf, roundS0, S0_MIN, type DesignState } from "./state";

export interface Recommendation {
  needs: NeedsResult;
  suggestedS0: number;   // 니즈 기준 기준보험금(1천만원 단위, 최소~심사 한도)
  hlvS0: number;         // 인적자본 기준 기준보험금
  presetId: PresetId;
  reason: string;
}

const REASON: Record<PresetId, (s: DesignState) => string> = {
  child: (s) => `막내(${Math.min(...s.profile.childrenAges)}세)가 독립하는 ${assumptionOf(s).needs.independenceAge}세까지 보장을 높게 두고 이후 30%로 줄입니다`,
  debt: (s) => `부채 ${Math.round(s.profile.debt / 1e4).toLocaleString()}만원을 만기 ${s.profile.debtYears}년에 맞춰 선형으로 줄입니다`,
  group: (s) => `퇴직(${s.profile.retirementAge}세) 전 5년간 매년 10%씩 100%로 올립니다`,
  estate: () => "50세 이상, 자녀 독립: 초기 50%에서 매년 10%씩 올려 상속 재원을 키웁니다",
  retire: (s) => `은퇴(${s.profile.retirementAge}세) 전 5년간 매년 10%씩 1.5배로 올립니다`,
  level: () => "특별한 경계가 없어 전 기간 같은 보험금으로 시작합니다",
};

/** 계획서 §3.5. 필요보장(니즈)과 인적자본(HLV)을 기준보험금 후보로 내고, 가족·부채·기존 보장으로 프리셋을 고른다 */
export function recommend(s: DesignState): Recommendation {
  const p = s.profile, a = assumptionOf(s), env = envelopeOf(s);
  const n = needs({ age: p.age, income: p.income, liquidAssets: p.liquidAssets, debt: p.debt, childrenAges: p.childrenAges, existingCover: p.groupCover + p.termCover }, a.needs);
  const cap = (x: number) => roundS0(Math.min(Math.max(x, S0_MIN), env.uwLimit));
  const presetId = recommendPreset({ age: p.age, childrenAges: p.childrenAges, debt: p.debt, groupCover: p.groupCover }, a.needs.independenceAge);
  return { needs: n, suggestedS0: cap(n.needs), hlvS0: cap(n.hlv), presetId, reason: `${PRESETS[presetId].label}: ${REASON[presetId](s)}` };
}
