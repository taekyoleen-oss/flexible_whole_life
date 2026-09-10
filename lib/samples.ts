import { buildPreset, type PresetId } from "@/lib/engine";
import { evaluate, initialState, presetContext, s0FromMonthly, type DesignState, type Profile } from "./state";

export interface Sample { id: string; label: string; description: string; monthly: number; profile: Partial<Profile>; presetId: PresetId }

export const SAMPLES: Sample[] = [
  { id: "child-35m", label: "35세 남 · 자녀연령형", description: "막내 2세, 월 20만원. 막내 독립(25세)까지 100%, 이후 30%", monthly: 2e5,
    profile: { sex: "M", age: 35, childrenAges: [2, 5], income: 7e7 }, presetId: "child" },
  { id: "debt-45f", label: "45세 여 · 부채상환형", description: "대출 잔액 3억·만기 15년, 월 30만원. 만기까지 선형 감액 후 30%", monthly: 3e5,
    profile: { sex: "F", age: 45, childrenAges: [15], income: 8e7, debt: 3e8, debtYears: 15 }, presetId: "debt" },
  { id: "estate-55m", label: "55세 남 · 상속준비형", description: "월 50만원. 초기 50%에서 연 10% 체증, 최대 2배", monthly: 5e5,
    profile: { sex: "M", age: 55, childrenAges: [25, 28], income: 1e8, liquidAssets: 5e8 }, presetId: "estate" },
];

/** 샘플 → 설계 상태. 월 예산에 맞춰 기준보험금을 역산한다(1천만원 단위). */
export function buildSample(s: Sample): DesignState {
  const base = initialState();
  const profile: Profile = { ...base.profile, ...s.profile };
  const applied = { child: true, debt: true, retire: true, income: false };   // 샘플은 프로필을 반영한 모양을 보여준다
  const draft: DesignState = { ...base, profile, presetId: s.presetId, infoApplied: applied, blocks: buildPreset(s.presetId, presetContext(profile, base.settings.envelope, applied)) };
  // per100k는 S0에 의존하지 않으므로 draft의 S0 그대로 평가해 역산에 쓴다.
  const unit = evaluate(draft);
  return { ...draft, S0: s0FromMonthly(s.monthly, unit.per100k.gross), updatedAt: Date.now() };
}
