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
  merged?: MergeRecord;   // 결합된 뒤 보관하는 되돌리기 정보(그래프를 바꾸지 않았으면 분리 가능)
}
/** 결합 직전·직후 스냅샷. after와 현재 스케줄이 같을 때만 분리할 수 있다 */
export interface MergeRecord { beforeS: number[]; beforeS0: number; beforeAnchors: number[]; beforePreset: string; afterS: number[]; afterS0: number }

export const ADDON_LABEL: Record<AddonKind, string> = { education: "자녀교육", loan: "대출상환", fixed: "정액 보장" };

/**
 * 추가 조건의 연도별 필요액(원, 길이 n).
 * 자녀교육: 지금부터 독립까지 직선으로 0까지. 대출상환: 초기 고정 기간(fixYears, E01)은 정액, 그 뒤 만기까지 직선 감액. 정액: 기간 동안 같은 금액
 */
export function addonCurve(a: Addon, n: number, independenceAge = 25, fixYears = 5): number[] {
  const years = a.kind === "education" ? Math.max(0, independenceAge - (a.childAge ?? independenceAge)) : Math.max(0, a.years);
  return Array.from({ length: n }, (_, t) => {
    if (a.kind === "fixed") return t < years ? a.amount : 0;
    if (years <= 0 || t >= years) return 0;
    if (a.kind === "loan") {
      const flat = Math.min(fixYears, years);
      return t < flat ? a.amount : a.amount * ((years - t) / (years - flat));   // 1~5년 정액, 6년째부터 만기까지 감액
    }
    return a.amount * (1 - t / years);   // 남은 기간에 비례해 줄어든다
  });
}

/** 목록에 보이는 모양 설명 */
export function addonShape(a: Addon, independenceAge = 25, fixYears = 5): string {
  if (a.kind === "fixed") return `${a.years}년간 정액`;
  if (a.kind === "education") return `독립까지 ${Math.max(0, independenceAge - (a.childAge ?? independenceAge))}년 감액`;
  const flat = Math.min(fixYears, a.years);
  return a.years > flat ? `1~${flat}년 정액, ${flat + 1}~${a.years}년 감액` : `1~${a.years}년 정액 후 0`;
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
