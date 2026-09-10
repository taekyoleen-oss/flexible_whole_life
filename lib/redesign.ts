import { commutation, nStar, pvUnit, redesign, toBlocks, type Block, type RedesignInput, type RedesignResult, type Sex } from "@/lib/engine";
import { assumptionOf, CELEBRATION_RATIO, celebrations, evaluate, initialState, levels, reducer, TABLE, type DesignState, type Profile, type Settings } from "./state";

export interface OldContract {
  sex: Sex; entryAge: number; elapsed: number; attainedAge: number;
  S0: number; blocks: Block[];          // 가입연령 기준
  payYears: number; interest: number;   // 원계약 예정이율
  waiver: boolean;
  benefitNow: number;                   // 재설계 시점 사망보험금(원)
  reserve: number; cash: number;        // 재설계 시점 준비금·해약환급금(원)
  monthlyGross: number;                 // 원계약 월 영업보험료(원, 표준형). 납입이 끝났으면 0
  label: string;
}
export type BudgetMode = "continue" | "reduce" | "stop";
export interface Budget { carry: number; monthlyGross: number; payYears: number }
export interface RuleCheck { code: "R01" | "R02" | "R03"; ok: boolean; message: string }
export interface OptionRow { id: "keep" | "paidup" | "surrender" | "redesign"; label: string; benefitNow: number; monthly: number; cashNow: number; pv: number }

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const withInterest = (s: Settings, interest: number): Settings => ({ ...s, assumption: { ...s.assumption, id: "custom", label: `원계약 기초율 ${(interest * 100).toFixed(2)}%`, interest } });
/** 가입연령 기준 배수 벡터 (원계약 블록 전개) */
const oldLevels = (old: OldContract) => levels({ ...initialState(), profile: { ...initialState().profile, sex: old.sex, age: old.entryAge }, blocks: old.blocks });

/** 이 앱 설계를 원계약으로. 경과년 t 시점의 준비금·환급금·보험료는 그 설계의 가정(원계약 이율)으로 계산 */
export function fromDesign(d: DesignState, elapsed: number, label = "현재 설계"): OldContract {
  const t = Math.max(0, Math.round(elapsed));
  const r = evaluate(d);
  const S = levels(d);
  return {
    sex: d.profile.sex, entryAge: d.profile.age, elapsed: t, attainedAge: d.profile.age + t,
    S0: d.S0, blocks: d.blocks, payYears: d.payYears, interest: assumptionOf(d).interest, waiver: d.waiver,
    benefitNow: (S[Math.min(t, S.length - 1)] ?? 0) * d.S0,
    reserve: (r.reserve100k[Math.min(t, r.n)] ?? 0) * r.units,
    cash: r.surrender.cash[Math.min(t, r.n)] ?? 0,
    monthlyGross: t < d.payYears ? r.monthly.gross : 0,
    label,
  };
}

export interface ManualOld { sex: Sex; entryAge: number; benefit: number; payYears: number; elapsed: number; interest: number; reserve?: number; cash?: number }
/** 타사·수기 계약: 평준 보험금으로 두고 준비금·환급금은 입력값 우선, 없으면 엔진 계산 */
export function fromManual(m: ManualOld, settings: Settings): OldContract {
  const base = initialState();
  let d: DesignState = { ...base, profile: { ...base.profile, sex: m.sex, age: m.entryAge }, payYears: m.payYears, settings: withInterest(settings, m.interest) };
  d = reducer(d, { type: "preset", id: "level" });
  d = reducer(d, { type: "S0", S0: m.benefit, exact: true });
  const old = fromDesign(d, m.elapsed, "직접 입력");
  return { ...old, interest: m.interest, reserve: m.reserve ?? old.reserve, cash: m.cash ?? old.cash };
}

/** 재설계 시점 이후 스케줄을 재설계 시점 보험금 = 1로 정규화한 카드(축하금은 그 연령 보험금의 10%) */
export function remainingBlocks(old: OldContract): Block[] {
  const rem = oldLevels(old).slice(old.elapsed);
  const base = rem[0] || 1;
  const norm = rem.map((v) => r4(v / base));
  const deaths = toBlocks(norm, old.attainedAge);
  const cels: Block[] = celebrations(old.blocks).filter((c) => c.fromAge >= old.attainedAge)
    .map((c) => ({ fromAge: c.fromAge, toAge: c.fromAge, multiple: r4(CELEBRATION_RATIO * (norm[Math.min(c.fromAge - old.attainedAge, norm.length - 1)] ?? 0)), kind: "celebration" }));
  return [...deaths, ...cels];
}

export function budgetFor(old: OldContract, mode: BudgetMode, reducedMonthly = 0): Budget {
  const payYears = Math.max(0, old.payYears - old.elapsed);
  if (mode === "stop") return { carry: old.cash, monthlyGross: 0, payYears: 0 };
  const G = payYears > 0 ? (mode === "reduce" ? Math.min(Math.max(reducedMonthly, 0), old.monthlyGross) : old.monthlyGross) : 0;
  return { carry: old.reserve, monthlyGross: G, payYears };
}

/** 중첩 편집기의 초기 상태: 재설계 시점 연령, 남은 스케줄, 현재 설정. 기준보험금은 재설계 시점 보험금(예산이 곧 덮어쓴다) */
export function newDesignFor(old: OldContract, settings: Settings): DesignState {
  const base = initialState();
  const profile: Profile = { ...base.profile, sex: old.sex, age: old.attainedAge };
  const draft: DesignState = { ...base, profile, payYears: Math.max(1, old.payYears - old.elapsed), waiver: old.waiver, settings, presetId: "custom", anchors: [], blocks: remainingBlocks(old) };
  const d = reducer(base, { type: "load", state: draft });
  return { ...d, S0: old.benefitNow || d.S0, presetId: "custom", updatedAt: Date.now() };
}

export const toInput = (old: OldContract, b: Budget, nd: DesignState): RedesignInput =>
  ({ sex: old.sex, attainedAge: old.attainedAge, carry: b.carry, monthlyGross: b.monthlyGross, payYears: b.payYears, blocks: nd.blocks, waiver: nd.waiver });

export const runRedesign = (old: OldContract, b: Budget, nd: DesignState, settings: Settings): RedesignResult =>
  redesign(toInput(old, b, nd), settings.assumption, TABLE);

/** 남은 구 스케줄(정규화, 재설계 시점 기준) — R01·손실·비교용 */
const oldRemaining = (old: OldContract) => ({ sex: old.sex, age: old.attainedAge, blocks: remainingBlocks(old), waiver: old.waiver });

/** 월납 연금 현가 ä = N*(m)/Dx_0 (연령 x, 이율 i). 미래 보험료 현가용 */
function payUnit(sex: Sex, age: number, m: number, interest: number, waiver: boolean): number {
  const rs = TABLE[sex], n = TABLE.meta.terminal[sex] - age;
  const zero = new Array<number>(rs.q.length).fill(0);
  const k = commutation({ interest, q: rs.q, f: waiver ? rs.f : zero }, age, n);
  return m > 0 ? nStar(k, Math.min(m, n), 12) / k.Dx[0] : 0;
}

/** 전환 손실: 같은 남은 보장을 현재 기초율로 살 때 더 드는 완납 순보험료(원). 양수면 현재 기초율이 불리 */
export function conversionLoss(old: OldContract, settings: Settings): number {
  const c = oldRemaining(old);
  return old.benefitNow * (pvUnit(c, settings.assumption.interest, TABLE) - pvUnit(c, old.interest, TABLE));
}

/**
 * R01(기초율 차익 방지): 원계약 기초율로 새 급부 현가 ≤ 이월액 + 미래 순보험료 현가.
 * 신계약비를 다시 받지 않으므로 급부 현가끼리 비교하면 항상 위반이 되어 이렇게 정의한다.
 * R02: 재설계 후 5년은 스케줄 모양(상대 배수)이 원계약 이하. R03: 연 1회.
 */
export function checkRules(old: OldContract, nd: DesignState, r: RedesignResult, lastRedesignedAt: number | null): RuleCheck[] {
  const carry = r.reserve100k[0] * r.units;   // 시점 0 준비금(β′ 포함)으로 이월액을 대신해 같은 기초율에서 등식이 되게 한다
  const pvNew = r.S0 * pvUnit({ sex: old.sex, age: old.attainedAge, blocks: nd.blocks, waiver: nd.waiver }, old.interest, TABLE);
  const m = Math.max(0, old.payYears - old.elapsed);
  const fund = carry + r.monthly.net * payUnit(old.sex, old.attainedAge, m, old.interest, nd.waiver);
  const r01 = pvNew <= fund * (1 + 1e-3);
  // R02는 모양으로 검사한다: 재설계 시점 보험금 대비 상대 배수가 5년 안에 원계약보다 커지면 위반.
  // (절대 금액은 예산이 정하므로, 신계약비를 안 받아 생기는 몇 % 차이는 증액으로 보지 않는다)
  const Sold = oldLevels(old).slice(old.elapsed);
  const base = Sold[0] || 1;
  const over: number[] = [];
  for (let t = 0; t < 5 && t < r.S.length; t++) if (r.S[t] > ((Sold[t] ?? 0) / base) + 1e-9) over.push(old.attainedAge + t);
  const recent = lastRedesignedAt !== null && Date.now() - lastRedesignedAt < 365 * 86400e3;
  return [
    { code: "R01", ok: r01, message: `원계약 기초율 ${(old.interest * 100).toFixed(2)}%로 새 급부 현가 ${Math.round(pvNew).toLocaleString()}원 ${r01 ? "≤" : ">"} 이월액 + 미래 순보험료 현가 ${Math.round(fund).toLocaleString()}원` },
    { code: "R02", ok: over.length === 0, message: over.length ? `재설계 후 5년(${old.attainedAge}~${old.attainedAge + 4}세) 안에 보험금이 원계약보다 큽니다: ${over.join(", ")}세` : "재설계 후 5년은 원계약 보험금 이하" },
    { code: "R03", ok: !recent, message: recent ? "1년 안에 이미 재설계한 계약입니다(연 1회)" : "재설계 횟수 제한(연 1회) 해당 없음" },
  ];
}

export function compareOptions(old: OldContract, r: RedesignResult, settings: Settings): OptionRow[] {
  const i = settings.assumption.interest;
  const c = oldRemaining(old);
  const paidup = redesign({ sex: old.sex, attainedAge: old.attainedAge, carry: old.cash, monthlyGross: 0, payYears: 0, blocks: c.blocks, waiver: old.waiver }, settings.assumption, TABLE);
  return [
    { id: "keep", label: "원계약 유지", benefitNow: old.benefitNow, monthly: old.monthlyGross, cashNow: old.cash, pv: old.benefitNow * pvUnit(c, i, TABLE) },
    { id: "paidup", label: "감액완납 (납입 중단, 스케줄 유지)", benefitNow: paidup.S0, monthly: 0, cashNow: paidup.cash[0], pv: paidup.S0 * paidup.pvbUnit },
    { id: "surrender", label: "해지 (환급금 수령)", benefitNow: 0, monthly: 0, cashNow: old.cash, pv: 0 },
    { id: "redesign", label: "재설계 (현재 안)", benefitNow: r.S0 * r.S[0], monthly: r.monthly.gross, cashNow: r.cash[0], pv: r.S0 * r.pvbUnit },
  ];
}
