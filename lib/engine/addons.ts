import { regularizeShape } from "./finance";
import type { EnvelopeParams } from "./envelope";

/**
 * 추가 조건(옵션 레이어): 프리셋이 정한 기본 모양 위에 얹는 개별 보장 항목.
 * 원 단위 곡선으로 그래프에 별도 선으로 보이다가 "결합"하면 기본 스케줄에 더해진다.
 */
export type AddonKind = "education" | "loan" | "fixed";
export interface Addon {
  id: string;
  kind: AddonKind;
  amount: number;       // 원. education: 자녀 1인당 최초 금액, loan: 대출금, fixed: 정액
  years: number;        // loan: 상환기간, fixed: 보장 기간(년). education은 독립 연령 − 자녀 나이
  childAge?: number;    // education
  label?: string;
}

export const ADDON_LABEL: Record<AddonKind, string> = { education: "자녀교육", loan: "대출상환", fixed: "정액 보장" };

/** 추가 조건의 연도별 필요액(원, 길이 n). 감소형은 지금부터 기간 동안 직선으로 0까지 */
export function addonCurve(a: Addon, n: number, independenceAge = 25): number[] {
  const years = a.kind === "education" ? Math.max(0, independenceAge - (a.childAge ?? independenceAge)) : Math.max(0, a.years);
  return Array.from({ length: n }, (_, t) => {
    if (a.kind === "fixed") return t < years ? a.amount : 0;
    if (years <= 0 || t >= years) return 0;
    return a.amount * (1 - t / years);   // 남은 기간에 비례해 줄어든다
  });
}

export function addonLabel(a: Addon): string {
  if (a.label) return a.label;
  if (a.kind === "education") return `자녀교육 ${a.childAge}세`;
  if (a.kind === "loan") return `대출상환 ${a.years}년`;
  return `정액 ${a.years}년`;
}

/**
 * 결합: 원 단위로 더한 뒤(기본 S0·m_t + 추가액_t) 기준보험금을 필요하면 올려 상한(3배) 안에 넣고, 설계 규칙에 맞춘다.
 * 금액 곡선은 최대한 보존하고 규칙(초기 고정·매년 1칸·상한)만 적용한다.
 */
export function mergeAddon(S: number[], S0: number, curve: number[], env: EnvelopeParams, s0Unit = 1e7): { S: number[]; S0: number } {
  const total = S.map((m, t) => m * S0 + (curve[t] ?? 0));
  const peak = Math.max(...total);
  const needS0 = Math.ceil(peak / env.maxMultiple / s0Unit) * s0Unit;
  const S0n = Math.max(S0, needS0);
  const target = total.map((v) => v / S0n);
  const m = regularizeShape(target, { fixYears: env.fixYears, step: 0.1, maxMultiple: env.maxMultiple, minMultiple: Math.max(env.minMultiple, env.minAmount / S0n) });
  return { S: m, S0: S0n };
}
