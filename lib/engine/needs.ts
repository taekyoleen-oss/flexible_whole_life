import type { AssumptionSet, RateTable, Sex } from "./types";
import type { PresetId } from "./presets";
import { annuity, inheritanceTax, lifeExpectancy, remainingPrincipal, type DebtMethod } from "./finance";

export interface NeedsInput { age: number; income: number; liquidAssets: number; debt: number; childrenAges: number[]; existingCover: number }
export interface NeedsResult { needs: number; hlv: number; yearsToIndependence: number; yearsToRetirement: number; detail: { living: number; education: number; debt: number; finalExpense: number; offset: number } }

export { annuity };

export function needs(i: NeedsInput, p: AssumptionSet["needs"]): NeedsResult {
  const youngest = i.childrenAges.length ? Math.min(...i.childrenAges) : undefined;
  const yearsToIndependence = youngest === undefined ? 0 : Math.max(0, p.independenceAge - youngest);
  const yearsToRetirement = Math.max(0, p.retirementAge - i.age);
  const living = i.income * p.livingRatio * annuity(yearsToIndependence, p.discount);
  const education = i.childrenAges.length * p.educationPerChild;
  const offset = i.existingCover + i.liquidAssets;
  const total = living + education + i.debt + p.finalExpense - offset;
  return { needs: Math.max(0, total), hlv: i.income * (1 - p.selfRatio) * annuity(yearsToRetirement, p.discount), yearsToIndependence, yearsToRetirement,
    detail: { living, education, debt: i.debt, finalExpense: p.finalExpense, offset } };
}

export function recommendPreset(i: { age: number; childrenAges: number[]; debt: number; groupCover: number }, independenceAge = 25): PresetId {
  const youngest = i.childrenAges.length ? Math.min(...i.childrenAges) : undefined;
  if (youngest !== undefined && youngest < independenceAge) return "child";
  if (i.debt > 0) return "debt";
  if (i.groupCover > 0) return "group";
  if (i.age >= 50) return "estate";
  return "level";
}

type NeedsParams = AssumptionSet["needs"];

/**
 * 자녀연령형 필요액 곡선(원). t년 후: 생활비 Y·ρ·a(막내 독립까지 남은 연수) + 교육비 E × 아직 독립 전인 자녀 수 + 정리자금 F.
 * 독립 뒤에는 생활비·교육비가 0이 되어 F만 남는다.
 */
export function childNeedCurve(i: { income: number; childrenAges: number[] }, p: NeedsParams, n: number): number[] {
  const youngest = i.childrenAges.length ? Math.min(...i.childrenAges) : p.independenceAge;
  return Array.from({ length: n }, (_, t) => {
    const remain = Math.max(0, p.independenceAge - youngest - t);
    const living = i.income * p.livingRatio * annuity(remain, p.discount);
    const education = i.childrenAges.filter((a) => a + t < p.independenceAge).length * p.educationPerChild;
    return living + education + p.finalExpense;
  });
}

/** 부채상환형 필요액 곡선(원): 대출 잔액 B_t + 정리자금 F */
export function debtNeedCurve(i: { debt: number; debtYears: number; debtRate: number; debtMethod: DebtMethod }, p: NeedsParams, n: number): number[] {
  return Array.from({ length: n }, (_, t) => remainingPrincipal(i.debt, i.debtRate, i.debtYears, t, i.debtMethod) + p.finalExpense);
}

/**
 * 은퇴증액형: 은퇴 후 필요액 = 배우자 생활비 현가(월 생활비 × 12 × a(배우자 기대여명)) + F − 은퇴 자산.
 * 은퇴 전 필요액(니즈) 대비 배수 R = N_post / N_pre.
 */
export function retireNeed(i: { age: number; retirementAge: number; hasSpouse: boolean; spouseSex: Sex; spouseAge: number; livingMonthly: number; retireAssets: number; preNeed: number },
  p: NeedsParams, table: RateTable): { spouseAgeAtRetire: number; expectancy: number; living: number; post: number; ratio: number } {
  const years = Math.max(0, i.retirementAge - i.age);
  const spouseAgeAtRetire = i.spouseAge + years;
  const expectancy = i.hasSpouse ? lifeExpectancy(table, i.spouseSex, spouseAgeAtRetire) : 0;
  const living = i.hasSpouse ? i.livingMonthly * 12 * annuity(Math.round(expectancy), p.discount) : 0;
  const post = Math.max(0, living + p.finalExpense - i.retireAssets);
  const ratio = i.preNeed > 0 ? post / i.preNeed : 1;
  return { spouseAgeAtRetire, expectancy, living, post, ratio };
}

/** 단체보험보완형: 재직 중 개인 보장 비율 g = max(0, 1 − 단체보험 보험금 / 니즈) */
export const groupGapRatio = (groupCover: number, preNeed: number) => (preNeed > 0 ? Math.max(0, 1 - groupCover / preNeed) : 1);

/** 상속준비형: 순자산 A_0(1+g)^t 에 대한 상속세 곡선(원) */
export function estateTaxCurve(i: { netAssets: number; assetGrowth: number; hasSpouse: boolean; children: number }, n: number): number[] {
  return Array.from({ length: n }, (_, t) => inheritanceTax(i.netAssets * (1 + i.assetGrowth) ** t, i.hasSpouse, i.children).tax);
}
