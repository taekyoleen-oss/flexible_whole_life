import type { PresetId } from "@/lib/engine";
import { STANDARD_BOUNDARY, type DesignState, type InfoApplied } from "./state";

export const RETIRE_OPTIONS = [55, 60, 65, 70] as const;

/**
 * 프리셋별 입력 컨트롤과 그 조건을 그렇게 둔 근거.
 * control: income(연소득 체크 + 재무 팝업) | child(자녀 나이 입력 + 체크) | debt(부채 팝업 + 체크) | retire(은퇴시기 선택, 은퇴증액형·단체보험보완형 공유) | none
 */
export const PRESET_INFO: Record<PresetId, { control: "none" | "income" | "child" | "debt" | "retire"; rationale: string }> = {
  level: {
    control: "income",
    rationale: "보장 금액을 바꾸지 않는 기준선입니다. 표준은 기준보험금 1억이며, 연소득·유동자산·기존 보장을 넣고 체크하면 필요보장(니즈)으로 계산한 금액이 기준보험금이 됩니다. 다른 프리셋과 보험료·환급금을 비교하는 출발점으로 씁니다.",
  },
  child: {
    control: "child",
    rationale: "막내가 독립(25세)할 때까지는 유족의 생활비와 교육비가 필요해 보장을 높게 둡니다. 독립 뒤에는 배우자 생활비·정리자금만 남아 30%로 충분합니다. 한 해에 갑자기 줄이지 않고 독립 6년 전부터 매년 10%씩 내려 독립 시점에 30%가 됩니다. 표준은 막내 5세 가입을 가정한 가입 20년 후이며, 자녀 나이를 넣고 체크하면 실제 막내 나이로 바뀝니다.",
  },
  debt: {
    control: "debt",
    rationale: "대출은 갚아 가면서 원금이 줄어들므로 보장도 남은 원금에 맞춰 선형으로 줄입니다. 만기 뒤에는 30%를 유지해 정리자금을 남깁니다. 표준은 가입 5년 후부터 20년째까지이며, 부채 잔액·만기를 넣고 체크하면 실제 만기로 바뀝니다.",
  },
  retire: {
    control: "retire",
    rationale: "은퇴 전후에는 소득이 끊기고 상속·정리 자금 수요가 커집니다. 은퇴 직전 3년 동안 매년 약 14.5%씩 올려 1.5배로 만들고 그 뒤 유지합니다. 은퇴시기는 55·60·65·70세 중 고르며 단체보험보완형과 같은 값을 씁니다(표준 65세).",
  },
  group: {
    control: "retire",
    rationale: "재직 중에는 단체보험이 사망을 일부 보장하므로 개인 보장은 50%면 됩니다. 퇴직(은퇴시기)으로 단체보험이 끝나기 4년 전부터 매년 20%씩 올려 퇴직 시점에 100%가 되어 보장 공백을 막습니다. 은퇴시기는 은퇴증액형과 같은 값을 씁니다(표준 65세).",
  },
  estate: { control: "none", rationale: "50대 이후 자산이 늘면 상속세 재원도 커져야 합니다. 초기 5년은 50%로 시작해 연 10%씩 체증하고, 2배 또는 증액 종료 연령(70세)에서 고정합니다. 입력 정보와 무관한 표준 모양입니다." },
};

/** 툴팁·요약용 설명: 현재 입력값과 표준값 */
export function boundaryLabel(key: keyof InfoApplied, s: DesignState): { text: string; available: boolean } {
  const p = s.profile, indep = s.settings.assumption.needs.independenceAge;
  const youngest = p.childrenAges.length ? Math.min(...p.childrenAges) : null;
  switch (key) {
    case "child": return { available: youngest !== null, text: youngest !== null ? `막내 ${youngest}세 → ${p.age + indep - youngest}세 독립 (표준 ${p.age + indep - STANDARD_BOUNDARY.youngestChildAge}세)` : "자녀 나이를 입력하세요" };
    case "debt": return { available: p.debt > 0, text: p.debt > 0 ? `부채 ${Math.round(p.debt / 1e4).toLocaleString()}만원 · 만기 ${p.debtYears}년 → ${p.age + p.debtYears}세 (표준 ${p.age + STANDARD_BOUNDARY.debtYears}세)` : "부채 잔액·만기를 입력하세요" };
    case "retire": return { available: true, text: `은퇴시기 ${p.retirementAge}세 (표준 ${STANDARD_BOUNDARY.retirementAge}세)` };
    case "income": return { available: p.income > 0, text: p.income > 0 ? `연소득 ${Math.round(p.income / 1e4).toLocaleString()}만원 → 니즈 기준보험금 (표준 1억)` : "연소득을 입력하세요" };
  }
}
