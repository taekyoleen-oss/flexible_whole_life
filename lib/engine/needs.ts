import type { AssumptionSet } from "./types";
import type { PresetId } from "./presets";

export interface NeedsInput { age: number; income: number; liquidAssets: number; debt: number; childrenAges: number[]; existingCover: number }
export interface NeedsResult { needs: number; hlv: number; yearsToIndependence: number; yearsToRetirement: number; detail: { living: number; education: number; debt: number; finalExpense: number; offset: number } }

/** 확정연금 현가(기말) a(k, r) = (1 − (1+r)^−k)/r */
export const annuity = (k: number, r: number) => (k <= 0 ? 0 : r === 0 ? k : (1 - (1 + r) ** -k) / r);

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
