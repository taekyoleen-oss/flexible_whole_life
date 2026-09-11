import type { RateTable, Sex } from "./types";

/** 확정연금 현가(기말) a(k, r) = (1 − (1+r)^−k)/r */
export const annuity = (k: number, r: number) => (k <= 0 ? 0 : r === 0 ? k : (1 - (1 + r) ** -k) / r);

export type DebtMethod = "annuity" | "principal" | "bullet";   // 원리금균등 · 원금균등 · 만기일시

/** t년 후 대출 잔액 B_t. 원리금균등: L(1+i)^t − P((1+i)^t − 1)/i, P = L·i/(1 − (1+i)^−n) */
export function remainingPrincipal(L: number, i: number, n: number, t: number, method: DebtMethod = "annuity"): number {
  if (t <= 0) return L;
  if (t >= n) return 0;
  if (method === "bullet") return L;
  if (method === "principal") return L * (1 - t / n);
  if (i === 0) return L * (1 - t / n);
  const g = (1 + i) ** t;
  const P = (L * i) / (1 - (1 + i) ** -n);
  return Math.max(0, L * g - (P * (g - 1)) / i);
}

/** 완전 기대여명 e_x = Σ_{k≥1} k·p_x + ½ (경험생명표 사망률) */
export function lifeExpectancy(table: RateTable, sex: Sex, age: number): number {
  const q = table[sex].q, omega = table.meta.terminal[sex];
  const x = Math.max(0, Math.min(Math.round(age), omega));
  let p = 1, sum = 0;
  for (let a = x; a < omega; a++) {
    p *= 1 - Math.min(1, q[a] ?? 1);
    if (p <= 0) break;
    sum += p;
  }
  return sum + 0.5;
}

/**
 * 상속세 근사(2024 세율). 과세표준 = 상속재산 − 일괄공제 5억 − 배우자공제.
 * 배우자공제 = 배우자가 있으면 max(5억, min(재산 × 법정지분(1.5/(1.5+자녀 수)), 30억)). 금융재산공제·신고세액공제는 생략.
 */
export const INHERITANCE_BRACKETS: [number, number, number][] = [   // [과세표준 상한, 세율, 누진공제]
  [1e8, 0.1, 0], [5e8, 0.2, 1e7], [1e9, 0.3, 6e7], [3e9, 0.4, 1.6e8], [Infinity, 0.5, 4.6e8],
];
export function inheritanceTax(estate: number, hasSpouse: boolean, children: number): { tax: number; taxable: number; deduction: number } {
  const lump = 5e8;
  const share = 1.5 / (1.5 + Math.max(0, children));
  const spouse = hasSpouse ? Math.max(5e8, Math.min(estate * share, 3e9)) : 0;
  const deduction = lump + spouse;
  const taxable = Math.max(0, estate - deduction);
  const [, rate, sub] = INHERITANCE_BRACKETS.find(([cap]) => taxable <= cap)!;
  return { tax: Math.max(0, taxable * rate - sub), taxable, deduction };
}

export interface ShapeRules { fixYears: number; step: number; maxMultiple: number; minMultiple: number; floor?: number; growthEndIndex?: number }

/**
 * 필요액 곡선(배수 target)을 설계 규칙에 맞는 배수로 바꾼다. 보장이 필요액 아래로 내려가지 않도록 증액은 앞당기고 감액은 늦춘다.
 * 0) 목표를 먼저 상한(E04)·하한으로 자르고 growthEndIndex 뒤의 증가를 없앤다(E03) — 뒤 구간의 과다 목표가 앞으로 번지지 않게
 * 1) 뒤→앞 m_t = max(target_t, m_{t+1} − step): 증액을 미리 시작해 제때 도달(매년 ≤ 1칸)
 * 2) 앞→뒤 m_t = max(m_t, m_{t−1} − step): 감액도 매년 ≤ 1칸
 * 3) 초기 fixYears는 그 구간 최댓값으로 고정(E01) 후 2)를 다시 적용
 * 4) growthEndIndex 이후 증액 없음(E03) 재확인  5) 하한 max(minMultiple(E05, 기준보험금 기준 절대값), floor)
 */
export function regularizeShape(target: number[], r: ShapeRules): number[] {
  const n = target.length, s = r.step;
  const lo = Math.max(r.minMultiple, r.floor ?? 0);
  const m = target.map((v) => (Number.isFinite(v) ? Math.min(r.maxMultiple, Math.max(lo, v)) : lo));
  const noGrowthAfterEnd = () => { if (r.growthEndIndex !== undefined) for (let t = Math.max(1, r.growthEndIndex + 1); t < n; t++) m[t] = Math.min(m[t], m[t - 1]); };
  noGrowthAfterEnd();
  for (let t = n - 2; t >= 0; t--) m[t] = Math.max(m[t], m[t + 1] - s);
  const lag = (from: number) => { for (let t = from; t < n; t++) m[t] = Math.max(m[t], m[t - 1] - s); };
  lag(1);
  const fix = Math.min(Math.max(1, r.fixYears), n);
  const level0 = Math.max(...m.slice(0, fix));
  for (let t = 0; t < fix; t++) m[t] = level0;
  lag(fix);
  noGrowthAfterEnd();
  return m.map((v) => Math.round(Math.min(r.maxMultiple, Math.max(lo, v)) * 1e4) / 1e4);
}
