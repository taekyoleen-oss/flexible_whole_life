import type { PresetId } from "@/lib/engine";
import { won } from "./format";
import { presetNeeds, type PresetNeeds } from "./preset-needs";
import { assumptionOf, envelopeOf, PRESET_FLAG, STANDARD_BOUNDARY, TABLE, termOf, type DesignState, type InfoApplied } from "./state";

export const RETIRE_OPTIONS = [55, 60, 65, 70] as const;

/**
 * 프리셋별 근거(이론·수식)와 표준 모양 설명. 조건을 반영하면 필요액 곡선을 설계 규칙에 맞춰 그린다.
 * formula: lib/formulas.json 항목 id (근거 팝업에서 수식 링크)
 */
export const PRESET_INFO: Record<PresetId, { formula: string; theory: string; standard: string; inputs: string }> = {
  level: {
    formula: "needs",
    theory: "니즈 접근법(needs approach): 유족에게 필요한 자금(생활비 현가·자녀 교육비·부채·정리자금)에서 이미 있는 자산(유동자산·기존 보장)을 뺀 금액이 필요보장입니다. 인적자본(HLV)은 은퇴까지 벌 소득의 현가에서 본인 소비를 뺀 값으로, 두 값이 기준보험금 후보입니다.",
    standard: "표준은 기준보험금 1억, 전 기간 같은 보험금입니다. 다른 프리셋과 보험료·환급금을 비교하는 출발점입니다.",
    inputs: "연소득·유동자산·기존 보장(단체·정기)·부채·자녀 나이는 프로필 공통 항목이라 다른 프리셋 입력과 같은 값을 씁니다.",
  },
  child: {
    formula: "childCurve",
    theory: "유족 생활비는 막내가 독립(25세)할 때까지만 필요하고 자녀 교육·결혼 자금은 각 자녀가 독립할 때 사라집니다. 그래서 필요액은 연소득 × 70% × a(남은 연수) + 1억 × 독립 전 자녀 수 + 정리자금으로, 해마다 줄어드는 곡선입니다. 보장은 이 곡선을 따라가되 매년 최대 10%씩만 내려가 필요액 아래로 떨어지지 않게 합니다.",
    standard: "표준(조건 미반영)은 막내 5세 가입을 가정해 가입 20년 후 30%까지 독립 6년 전부터 매년 10%씩 내려갑니다.",
    inputs: "자녀 나이(공통), 연소득(공통). 생활비 비율·자녀 1인 자금·독립 연령·정리자금·할인율은 설정 화면의 가정값입니다.",
  },
  debt: {
    formula: "amortization",
    theory: "사망 시 유족이 갚아야 할 돈은 그 시점의 대출 잔액입니다. 원리금균등이면 잔액 B_t = L(1+i)^t − P((1+i)^t − 1)/i 로 초기에는 천천히, 만기에 가까울수록 빨리 줄고, 원금균등은 직선, 만기일시는 만기까지 그대로입니다. 필요액 = 잔액 + 정리자금이며 보장은 이 곡선을 매년 최대 10% 감액으로 따라갑니다.",
    standard: "표준은 가입 5년 후부터 20년째까지 직선으로 30%까지 줄입니다.",
    inputs: "부채 잔액·만기(공통), 금리, 상환방식.",
  },
  retire: {
    formula: "retireNeed",
    theory: "은퇴 뒤에는 소득이 없어 유족(배우자)의 남은 생애 생활비를 보험금이 대신해야 합니다. 배우자의 은퇴 시점 나이에서 경험생명표로 기대여명 e를 구하고, 월 생활비 × 12 × a(e) + 정리자금 − 은퇴 자산(연금·퇴직금)이 은퇴 후 필요액입니다. 은퇴 전 필요액(니즈) 대비 배수 R만큼 은퇴 시점에 도달하도록 그 전 몇 해 동안 매년 10%씩 올립니다(R < 1이면 은퇴 후 매년 10%씩 내립니다).",
    standard: "표준은 은퇴(65세) 5년 전부터 매년 10%씩 올려 1.5배로 유지합니다.",
    inputs: "은퇴시기(공통, 단체보험보완형과 같은 값), 배우자 유무(공통)·배우자 나이, 은퇴 후 월 생활비, 은퇴 자산.",
  },
  group: {
    formula: "groupGap",
    theory: "재직 중에는 단체보험 사망보험금이 필요액의 일부를 메우므로 개인 보장은 그 공백(1 − 단체보험 ÷ 필요액)만 있으면 됩니다. 퇴직(은퇴시기)과 함께 단체보험이 사라지면 필요액 전부를 개인 보장이 맡아야 하므로 퇴직 시점에 100%가 되도록 그 전 몇 해 동안 매년 10%씩 올립니다.",
    standard: "표준은 재직 중 50%, 퇴직(65세) 5년 전부터 매년 10%씩 올려 100%입니다.",
    inputs: "단체보험 보험금(공통, 평준형 입력과 같은 값), 은퇴시기(공통), 필요액은 니즈(공통 입력).",
  },
  estate: {
    formula: "inheritanceTax",
    theory: "상속세는 유족이 현금으로 내야 하므로 사망보험금이 그 재원이 됩니다. 순자산이 매년 g%씩 늘면 상속세도 누진세율(10~50%)로 더 빨리 늘어납니다. 과세표준 = 자산 − 일괄공제 5억 − 배우자공제(최소 5억, 법정지분·30억 한도)로 계산한 상속세 곡선을 증액 종료 연령(70세) 시점을 기준(100%)으로 삼아 따라가며, 그 전까지 매년 최대 10%씩 올립니다.",
    standard: "표준은 초기 50%에서 5년 후부터 매년 10%씩 올려 15년 뒤 2배, 70세 이후 고정입니다.",
    inputs: "순자산, 자산 증가율, 배우자 유무·자녀 수(공통). 세율·공제는 2024년 기준 근사입니다.",
  },
};

/** 카드 체크박스 옆 툴팁: 조건이 갖춰졌는지와 현재 값 */
export function boundaryLabel(key: keyof InfoApplied, s: DesignState): { text: string; available: boolean } {
  const p = s.profile, indep = s.settings.assumption.needs.independenceAge;
  const youngest = p.childrenAges.length ? Math.min(...p.childrenAges) : null;
  switch (key) {
    case "child": return { available: youngest !== null && p.income > 0, text: youngest !== null ? `막내 ${youngest}세 → ${p.age + indep - youngest}세 독립 (표준 ${p.age + indep - STANDARD_BOUNDARY.youngestChildAge}세)` : "자녀 나이를 입력하세요" };
    case "debt": return { available: p.debt > 0, text: p.debt > 0 ? `부채 ${won(p.debt)} · 만기 ${p.debtYears}년 → ${p.age + p.debtYears}세 (표준 ${p.age + STANDARD_BOUNDARY.debtYears}세)` : "부채 잔액·만기를 입력하세요" };
    case "retire": return { available: true, text: `은퇴시기 ${p.retirementAge}세 (표준 ${STANDARD_BOUNDARY.retirementAge}세)` };
    case "group": return { available: p.groupCover > 0, text: p.groupCover > 0 ? `단체보험 ${won(p.groupCover)} · 퇴직 ${p.retirementAge}세` : "단체보험 보험금을 입력하세요" };
    case "estate": return { available: p.netAssets > 0, text: p.netAssets > 0 ? `순자산 ${won(p.netAssets)} · 증가율 ${(p.assetGrowth * 100).toFixed(1)}%` : "순자산을 입력하세요" };
    case "income": return { available: p.income > 0, text: p.income > 0 ? `연소득 ${won(p.income)} → 니즈 기준보험금 (표준 1억)` : "연소득을 입력하세요" };
  }
}

/** 현재 프로필·가정으로 계산한 프리셋 근거 수치(입력·근거 팝업용) */
export function presetEvidence(id: PresetId, s: DesignState): PresetNeeds | null {
  return presetNeeds(id, s.profile, assumptionOf(s), TABLE, termOf(s.profile), envelopeOf(s));
}

export const flagOf = (id: PresetId) => PRESET_FLAG[id]!;
