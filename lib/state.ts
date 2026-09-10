import kli7 from "@/lib/engine/data/rates-kli7.json";
import { ASSUMPTIONS, buildPreset, compute, DEFAULT_ENVELOPE, expandBlocks, getAssumption, toBlocks, type AssumptionSet, type Block, type EngineInput, type EngineResult, type EnvelopeParams, type PresetContext, type PresetId, type RateTable, type Sex } from "@/lib/engine";
import { clamp } from "./format";

export const TABLE = kli7 as RateTable;
export const ASSUMPTION_ID = "default-2026";
export const STORAGE_KEY = "fwl:design:v1";

/** 산출 가정과 설계 제약. 설계 상태의 일부라서 공유 링크·인쇄에도 그대로 실린다 */
export interface Settings { assumption: AssumptionSet; envelope: EnvelopeParams }
export const DEFAULT_SETTINGS: Settings = { assumption: getAssumption(ASSUMPTION_ID), envelope: DEFAULT_ENVELOPE };
export const envelopeOf = (s: { settings?: Settings }): EnvelopeParams => s.settings?.envelope ?? DEFAULT_ENVELOPE;
export const assumptionOf = (s: { settings?: Settings }): AssumptionSet => s.settings?.assumption ?? DEFAULT_SETTINGS.assumption;

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const numObj = <T extends object>(raw: unknown, d: T): T => {
  const o = (raw ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(d as Record<string, number>).map(([k, v]) => [k, num(o[k], v)])) as T;
};

/** 저장·공유에서 온 설정을 믿지 않는다. 숫자가 아니면 기본값, 알 수 없는 세트는 기본 세트 */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Record<keyof Settings, unknown>>;
  const a = (r.assumption ?? {}) as Partial<AssumptionSet> & Record<string, unknown>;
  const base = ASSUMPTIONS.find((x) => x.id === a.id) ?? (a.id === "custom" ? DEFAULT_SETTINGS.assumption : undefined);
  let assumption = DEFAULT_SETTINGS.assumption;
  if (base) {
    const e = a.expenses as Record<string, unknown> | undefined;
    const expenses: AssumptionSet["expenses"] = e?.model === "simple"
      ? { model: "simple", ...numObj(e, { alpha: 0.007, beta: 0.0015, gamma: 0.02 }) }
      : e?.model === "method"
        ? { model: "method", ...numObj(e, { alphaS: 0.01, alphaP: 1, betaS: 0.0015, betaG: 0.045, betaPrime: 0.001, gamma: 0.025 }) }
        : base.expenses;
    assumption = {
      ...base,
      id: a.id === "custom" ? "custom" : base.id,
      label: typeof a.label === "string" ? a.label : base.label,
      version: typeof a.version === "string" ? a.version : base.version,
      interest: num(a.interest, base.interest), standardInterest: num(a.standardInterest, base.standardInterest),
      waiver: typeof a.waiver === "boolean" ? a.waiver : base.waiver,
      expenses,
      lowSurrender: numObj(a.lowSurrender, base.lowSurrender),
      needs: numObj(a.needs, base.needs),
    };
  }
  return { assumption, envelope: numObj(r.envelope, DEFAULT_ENVELOPE) };
}

/** 숫자를 하나라도 고치면 사용자 정의 세트가 된다 */
export function customize(a: AssumptionSet, baseId: string): AssumptionSet {
  const origin = a.id === "custom" ? baseId : a.id;
  return { ...a, id: "custom", version: "사용자 정의", label: `사용자 정의 (기본: ${origin})` };
}

export interface Profile {
  sex: Sex; age: number;
  childrenAges: number[]; hasSpouse: boolean;
  income: number; liquidAssets: number; debt: number; debtYears: number; retirementAge: number;
  groupCover: number; groupCoverEndAge: number; termCover: number; termCoverEndAge: number;
}

export interface DesignState {
  version: 1;
  profile: Profile;
  S0: number;            // 기준보험금(원). 월 보험료는 파생값
  payYears: number;
  waiver: boolean;
  lowSurrender: boolean;
  presetId: PresetId | "custom";
  blocks: Block[];       // death 카드(연속·빈틈 없음) + celebration 카드
  anchors: number[];     // 그래프에서 직접 정한 변경 연령(오름차순). 이 사이는 매년 한 칸씩 보간된다
  settings: Settings;    // 가정 세트·설계 제약
  infoApplied: InfoApplied; // 입력 정보 중 프리셋 경계에 반영한 항목
  updatedAt: number;     // 0이면 한 번도 편집하지 않은 기본 상태
}

export const DEFAULT_PROFILE: Profile = {
  sex: "M", age: 40, childrenAges: [], hasSpouse: true,
  income: 6e7, liquidAssets: 3e7, debt: 0, debtYears: 10, retirementAge: 65,
  groupCover: 0, groupCoverEndAge: 60, termCover: 0, termCoverEndAge: 60,
};

export const omegaOf = (sex: Sex) => TABLE.meta.terminal[sex];
/** n = ω − x (종신) */
export const termOf = (p: Profile) => omegaOf(p.sex) - p.age;
/** 마지막 사망보장 연령 = ω − 1 */
export const endAgeOf = (p: Profile) => omegaOf(p.sex) - 1;

/** 입력 정보 중 설계에 반영한 항목. 기본은 모두 false — 프리셋은 표준 경계로 그린다 */
export interface InfoApplied { child: boolean; debt: boolean; retire: boolean; income: boolean }   // retire: 은퇴시기(은퇴증액형·단체보험보완형 공유), income: 기준보험금을 연소득 기반(니즈·HLV)으로 정했는지
export const NO_INFO: InfoApplied = { child: false, debt: false, retire: false, income: false };
/** 표준 경계(가입 후 경과년 기준): 자녀 독립 20년 후(막내 5세 가정), 부채 만기 20년(5년 후부터 15년 감액), 단체보험 60세, 은퇴 65세 */
export const STANDARD_BOUNDARY = { youngestChildAge: 5, debtYears: 20, retirementAge: 65 } as const;   // 단체보험 만기 = 은퇴시기

/** 프리셋 경계. 반영 플래그가 켜진 항목만 프로필 값을 쓰고 나머지는 표준 경계 */
export function presetContext(p: Profile, env: EnvelopeParams = DEFAULT_ENVELOPE, applied: InfoApplied = NO_INFO): PresetContext {
  const hasChild = p.childrenAges.length > 0;
  return {
    age: p.age, n: termOf(p),
    youngestChildAge: applied.child && hasChild ? Math.min(...p.childrenAges) : STANDARD_BOUNDARY.youngestChildAge,
    debtYears: applied.debt && p.debt > 0 ? p.debtYears : STANDARD_BOUNDARY.debtYears,
    retirementAge: applied.retire ? p.retirementAge : STANDARD_BOUNDARY.retirementAge,
    groupCoverEndAge: applied.retire ? p.retirementAge : STANDARD_BOUNDARY.retirementAge,   // 단체보험은 퇴직(은퇴시기)에 끝난다
    growthEndAge: env.growthEndAge,
  };
}

export function initialState(): DesignState {
  return {
    version: 1, profile: DEFAULT_PROFILE, S0: 1e8, payYears: 20, waiver: true, lowSurrender: false,
    presetId: "level", blocks: buildPreset("level", presetContext(DEFAULT_PROFILE)), anchors: [], settings: DEFAULT_SETTINGS, infoApplied: NO_INFO, updatedAt: 0,
  };
}
export const DEFAULT_STATE: DesignState = initialState();

export function toEngineInput(s: DesignState): EngineInput {
  return { sex: s.profile.sex, age: s.profile.age, payYears: s.payYears, S0: s.S0, blocks: s.blocks, waiver: s.waiver, lowSurrender: s.lowSurrender };
}

/** 현재 가정 세트·위험률표로 설계 상태를 산출한다 */
export const evaluate = (s: DesignState): EngineResult => compute(toEngineInput(s), assumptionOf(s), TABLE);

export const STEP = 0.1;               // 그래프 1칸 = 기준보험금의 10%
export const CELEBRATION_RATIO = 0.1;  // 축하금 = 해당 연령 사망보험금의 10%
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** 첫 편집 가능 연령 = 가입연령 + 초기 고정 연수(E01) */
export const firstEditableAge = (p: Profile, env: EnvelopeParams = DEFAULT_ENVELOPE) => p.age + env.fixYears;
/** 연도별 사망보험금 배수 S_t (t = 0..n−1) */
export const levels = (s: DesignState): number[] => expandBlocks(s.blocks, s.profile.age, termOf(s.profile)).S;
/** 하한 배수: E05 감액 하한과 E06 최소 금액 중 큰 쪽 */
export const floorMultiple = (S0: number, env: EnvelopeParams = DEFAULT_ENVELOPE) => Math.max(env.minMultiple, env.minAmount / S0);

export interface AllowedRange { editable: boolean; prev: number; ref: number; steps: number; min: number; max: number }
/** 드래그 한 번 동안 고정되는 기준: 드래그 시작 시점의 배수 벡터와 변경점 */
export interface LevelBase { S: number[]; anchors: number[] }

/** 쉼표·공백으로 구분한 나이 목록 → 범위 안의 정수 나이(중복 제거, 오름차순). 축하금 입력용 */
export const parseAgeList = (text: string, min: number, max: number): number[] =>
  [...new Set(text.split(/[,\s]+/).filter(Boolean).map(Number).filter((a) => Number.isInteger(a) && a >= min && a <= max))].sort((u, v) => u - v);

/** 첫 편집 연령 뒤·최종연령 안의 유효한 변경점만 오름차순으로 */
export const cleanAnchors = (anchors: unknown, p: Profile, env: EnvelopeParams = DEFAULT_ENVELOPE): number[] =>
  [...new Set((Array.isArray(anchors) ? anchors : []).filter((a): a is number => Number.isFinite(a) && a > firstEditableAge(p, env) && a <= endAgeOf(p)))].sort((u, v) => u - v);

/**
 * 연령 A에서 그래프로 움직일 수 있는 범위.
 * 기준(ref)은 A보다 앞선 마지막 변경점(없으면 첫 편집 연령 45세), prev는 그 직전 해(ref−1)의 배수(= 직전 변경점이 정한 수준).
 * 칸 수 = A − ref. 올리거나 내린 k칸은 A 직전 k년(A−k … A−1)에 매년 한 칸씩 놓이고 A부터 새 수준이 된다.
 * 예: 40세 가입, 50세를 3칸 올리면 47·48·49세가 1.1·1.2·1.3배, 50세부터 1.3배.
 */
export function allowedRange(s: DesignState, ageAt: number, base?: LevelBase): AllowedRange {
  const x = s.profile.age, S = base?.S ?? levels(s), anchors = base?.anchors ?? s.anchors;
  const env = envelopeOf(s);
  const first = firstEditableAge(s.profile, env), end = endAgeOf(s.profile);
  const t = ageAt - x;
  if (ageAt < first || ageAt > end) {
    const prev = S[clamp(t, 0, S.length - 1)];
    return { editable: false, prev, ref: ageAt, steps: 0, min: prev, max: prev };
  }
  const ref = anchors.filter((a) => a < ageAt && a >= first).reduce((m, a) => Math.max(m, a), first);
  const prev = S[ref - x - 1];
  const steps = ageAt - ref;
  return {
    editable: true, prev, ref, steps,
    min: r4(Math.max(floorMultiple(s.S0, env), prev - steps * STEP)),
    max: r4(Math.min(env.maxMultiple, prev + steps * STEP)),
  };
}

/** 고객이 실제로 내는 보험료 기준 요약. 저해지 ON이면 인하된 보험료·환급금을 쓴다. */
export function effective(r: EngineResult, payYears: number) {
  const low = r.lowSurrender;
  const gross100k = low?.gross100k ?? r.per100k.gross;
  const monthly = low?.monthlyGross ?? r.monthly.gross;
  const paid = low?.paid ?? r.surrender.paid;
  return {
    isLow: low !== undefined,
    gross100k,
    monthly,
    net: r.monthly.net,                       // 순보험료는 표준과 같고 영업보험료만 인하된다
    deltaP100k: low?.deltaP100k ?? 0,
    ratio: low?.ratio ?? 1,
    premiumDiscount: low?.premiumDiscount ?? 0,
    totalPaid: paid[Math.min(payYears, paid.length - 1)],
    cash: low?.cash ?? r.surrender.cash,
    rate: low?.rate ?? r.surrender.rate,
    paid,
    standardMonthly: r.monthly.gross,
  };
}

/** 기준보험금 단위. 1천만원 단위로만 잡아야 그래프 1칸(10%)이 100만원 단위가 된다 */
export const S0_UNIT = 1e7;
export const S0_MIN = 1e7, S0_MAX = 1e10;
export const roundS0 = (S0: number) => clamp(Math.round(S0 / S0_UNIT) * S0_UNIT, S0_MIN, S0_MAX);
/** 월 보험료(원) → 기준보험금(원). 가장 가까운 1천만원 단위로 맞춘다 */
export const s0FromMonthly = (monthly: number, gross100k: number) => roundS0((monthly * 1e5) / gross100k);

export const deathSegments = (blocks: Block[]) => blocks.filter((b) => b.kind === "death").sort((a, b) => a.fromAge - b.fromAge);
export const celebrations = (blocks: Block[]) => blocks.filter((b) => b.kind === "celebration").sort((a, b) => a.fromAge - b.fromAge);

/** 사망 카드를 가입연령~최종연령 빈틈·겹침 없이 잇는다. 앞 카드의 toAge가 뒤 카드의 fromAge를 정하고, 삼켜진 카드는 버린다. */
export function normalizeSegments(segs: Block[], age: number, endAge: number): Block[] {
  const out: Block[] = [];
  let cur = age;
  for (const s of segs) {
    if (cur > endAge) break;
    if (s.toAge < cur) continue;
    out.push({ ...s, fromAge: cur, toAge: Math.min(Math.max(s.toAge, cur), endAge) });
    cur = out[out.length - 1].toAge + 1;
  }
  if (out.length === 0) out.push({ fromAge: age, toAge: endAge, multiple: 1, kind: "death" });
  out[out.length - 1] = { ...out[out.length - 1], toAge: endAge };
  return out;
}

function clampProfile(p: Profile): Profile {
  return {
    ...p,
    sex: p.sex === "F" ? "F" : "M",
    age: clamp(Math.round(p.age), 15, 70),
    childrenAges: (Array.isArray(p.childrenAges) ? p.childrenAges : [])
      .filter((a) => Number.isFinite(a))
      .map((a) => clamp(Math.round(a), 0, 40))
      .slice(0, 6),
    income: Math.max(0, p.income), liquidAssets: Math.max(0, p.liquidAssets), debt: Math.max(0, p.debt),
    debtYears: clamp(Math.round(p.debtYears), 1, 40),
    retirementAge: clamp(Math.round(p.retirementAge), 40, 80),
    groupCover: Math.max(0, p.groupCover), groupCoverEndAge: clamp(Math.round(p.groupCoverEndAge), 20, 80),
    termCover: Math.max(0, p.termCover), termCoverEndAge: clamp(Math.round(p.termCoverEndAge), 20, 100),
  };
}

function withBlocks(s: DesignState, deaths: Block[], cels: Block[], presetId: DesignState["presetId"] = s.presetId): DesignState {
  const p = s.profile, n = termOf(p);
  const d = normalizeSegments(deaths, p.age, endAgeOf(p));
  const { S } = expandBlocks(d, p.age, n);
  const seen = new Set<number>();
  const c: Block[] = [];
  for (const b of cels) {
    if (b.fromAge < p.age || b.fromAge > p.age + n || seen.has(b.fromAge)) continue;
    seen.add(b.fromAge);
    const t = Math.min(b.fromAge - p.age, n - 1);
    c.push({ fromAge: b.fromAge, toAge: b.fromAge, multiple: r4(CELEBRATION_RATIO * S[t]), kind: "celebration" });
  }
  return { ...s, blocks: [...d, ...c], presetId, updatedAt: Date.now() };
}

export type AutoFixCode = "E01" | "E04" | "E05";

export type Action =
  | { type: "load"; state: DesignState }
  | { type: "reset" }
  | { type: "profile"; patch: Partial<Profile> }
  | { type: "S0"; S0: number; exact?: boolean }
  | { type: "payYears"; payYears: number }
  | { type: "waiver"; on: boolean }
  | { type: "lowSurrender"; on: boolean }
  | { type: "preset"; id: PresetId }
  | { type: "segment"; index: number; patch: { toAge?: number; multiple?: number } }
  | { type: "splitSegment"; index: number }
  | { type: "removeSegment"; index: number }
  | { type: "addCelebration"; age: number }
  | { type: "celebration"; index: number; patch: { fromAge: number } }
  | { type: "removeCelebration"; index: number }
  | { type: "level"; age: number; multiple: number; base?: LevelBase }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "applyInfo"; applied: Partial<InfoApplied>; S0?: number; presetId?: PresetId }
  | { type: "resetDesign" }
  | { type: "autoFix"; code: AutoFixCode };

export function reducer(s: DesignState, a: Action): DesignState {
  const touch = (patch: Partial<DesignState>): DesignState => ({ ...s, ...patch, updatedAt: Date.now() });
  switch (a.type) {
    case "load": {
      const raw = a.state as Partial<DesignState> | null | undefined;
      const profile = clampProfile({ ...DEFAULT_PROFILE, ...raw?.profile });
      const blocks = Array.isArray(raw?.blocks) ? raw.blocks : [];
      const settings = sanitizeSettings(raw?.settings);
      const merged: DesignState = { ...DEFAULT_STATE, ...raw, profile, settings };
      const payYears = clamp(Math.round(Number(merged.payYears)), 1, termOf(profile));
      const S0 = roundS0(Number(merged.S0));
      const anchors = cleanAnchors(merged.anchors, profile, settings.envelope);
      const ia = (raw?.infoApplied ?? {}) as Partial<Record<keyof InfoApplied, unknown>>;
      const infoApplied: InfoApplied = { child: ia.child === true, debt: ia.debt === true, retire: ia.retire === true, income: ia.income === true };
      merged.infoApplied = infoApplied;
      return { ...withBlocks({ ...merged, payYears, S0, anchors }, deathSegments(blocks), celebrations(blocks)), updatedAt: merged.updatedAt };
    }
    case "reset": return { ...initialState(), settings: s.settings };
    case "resetDesign": {
      // 입력·설정·계약 조건은 두고 설계만 1억·표준 평준형으로. 변경점·축하금·입력 반영도 지운다
      const next = { ...s, S0: 1e8, anchors: [], infoApplied: NO_INFO };
      return withBlocks(next, buildPreset("level", presetContext(s.profile, envelopeOf(s), NO_INFO)), [], "level");
    }
    case "profile": {
      const profile = clampProfile({ ...s.profile, ...a.patch });
      const next = { ...s, profile, anchors: cleanAnchors(s.anchors, profile, envelopeOf(s)) };
      const deaths = s.presetId === "custom" ? deathSegments(s.blocks) : buildPreset(s.presetId, presetContext(profile, envelopeOf(s), s.infoApplied));
      return withBlocks(next, deaths, celebrations(s.blocks));
    }
    case "S0": return touch({ S0: a.exact ? clamp(Math.round(a.S0), 0, S0_MAX) : roundS0(a.S0), infoApplied: { ...s.infoApplied, income: false } });   // exact: 재설계처럼 예산이 정한 값. 손으로 바꾸면 연소득 반영 표시는 해제
    case "payYears": return touch({ payYears: clamp(Math.round(a.payYears), 1, termOf(s.profile)) });
    case "waiver": return touch({ waiver: a.on });
    case "lowSurrender": return touch({ lowSurrender: a.on });
    case "preset": return withBlocks({ ...s, anchors: [] }, buildPreset(a.id, presetContext(s.profile, envelopeOf(s), s.infoApplied)), celebrations(s.blocks), a.id);
    case "applyInfo": {
      // 입력 정보 반영: 체크한 경계만 프로필 값으로, 선택하면 기준보험금·프리셋도 함께. 프리셋 상태면 다시 그린다
      const infoApplied: InfoApplied = { ...s.infoApplied, ...a.applied, income: a.S0 !== undefined ? true : (a.applied.income ?? s.infoApplied.income) };
      const presetId = a.presetId ?? s.presetId;
      const S0 = a.S0 !== undefined ? roundS0(a.S0) : s.S0;
      const next = { ...s, infoApplied, S0 };
      if (presetId === "custom") return touch({ infoApplied, S0 });
      return withBlocks({ ...next, anchors: [] }, buildPreset(presetId, presetContext(s.profile, envelopeOf(s), infoApplied)), celebrations(s.blocks), presetId);
    }
    case "settings": {
      const merged = sanitizeSettings({ ...s.settings, ...a.patch });
      const baseId = s.settings.assumption.id === "custom" ? (s.settings.assumption.label.match(/기본: ([\w-]+)/)?.[1] ?? ASSUMPTION_ID) : s.settings.assumption.id;
      const known = ASSUMPTIONS.find((x) => x.id === merged.assumption.id);
      const assumption = known && JSON.stringify(known) === JSON.stringify(merged.assumption) ? known : customize(merged.assumption, baseId);
      const settings = { ...merged, assumption };
      return { ...touch({ settings }), anchors: cleanAnchors(s.anchors, s.profile, settings.envelope) };
    }
    case "segment": {
      if (!deathSegments(s.blocks)[a.index]) return s;
      const d = deathSegments(s.blocks).map((b, i) => i !== a.index ? b : {
        ...b,
        toAge: a.patch.toAge === undefined ? b.toAge : Math.round(a.patch.toAge),
        multiple: a.patch.multiple === undefined ? b.multiple : clamp(a.patch.multiple, 0, 10),
      });
      return withBlocks({ ...s, anchors: [] }, d, celebrations(s.blocks), "custom");
    }
    case "splitSegment": {
      const d = deathSegments(s.blocks);
      const b = d[a.index];
      if (!b || b.toAge - b.fromAge < 1) return s;
      const mid = Math.floor((b.fromAge + b.toAge) / 2);
      d.splice(a.index, 1, { ...b, toAge: mid }, { ...b, fromAge: mid + 1 });
      return withBlocks({ ...s, anchors: [] }, d, celebrations(s.blocks), "custom");
    }
    case "removeSegment": {
      const d = deathSegments(s.blocks);
      if (d.length < 2 || !d[a.index]) return s;
      if (a.index > 0) d[a.index - 1] = { ...d[a.index - 1], toAge: d[a.index].toAge };
      d.splice(a.index, 1);
      return withBlocks({ ...s, anchors: [] }, d, celebrations(s.blocks), "custom");
    }
    case "addCelebration": {
      const c: Block = { fromAge: Math.round(a.age), toAge: Math.round(a.age), multiple: 0, kind: "celebration" };
      return withBlocks(s, deathSegments(s.blocks), [...celebrations(s.blocks), c]);
    }
    case "celebration": {
      if (!celebrations(s.blocks)[a.index]) return s;
      const c = celebrations(s.blocks).map((b, i) => (i !== a.index ? b : { ...b, fromAge: Math.round(a.patch.fromAge) }));
      return withBlocks(s, deathSegments(s.blocks), c);
    }
    case "removeCelebration":
      return withBlocks(s, deathSegments(s.blocks), celebrations(s.blocks).filter((_, i) => i !== a.index));
    case "level": {
      const r = allowedRange(s, a.age, a.base);
      if (!r.editable) return s;
      const x = s.profile.age, n = termOf(s.profile);
      const S = a.base && a.base.S.length === n ? a.base.S : levels(s);
      const anchors0 = a.base?.anchors ?? s.anchors;
      const target = r4(clamp(a.multiple, r.min, r.max));
      const t = a.age - x, tRef = r.ref - x;
      // 변경점 A의 수준은 A−1에 도달한 값이다. 뒤 구간은 그 수준의 변화폭만큼 함께 움직인다
      const delta = r4(target - S[t - 1]);
      const lo = floorMultiple(s.S0, envelopeOf(s)), hi = envelopeOf(s).maxMultiple;
      const next = S.slice();
      // ref~A−1: prev로 두었다가 A 직전 k년 동안 매년 한 칸씩 target까지 계단식으로 이동
      const k = Math.round(Math.abs(target - r.prev) / STEP), sign = Math.sign(target - r.prev);
      for (let i = tRef; i < t; i++) next[i] = i < t - k ? r.prev : r4(r.prev + sign * STEP * (i - (t - k) + 1));
      // A 이후: 같은 폭만큼 함께 이동, 상·하한에서 정지
      for (let i = t; i < n; i++) next[i] = r4(clamp(S[i] + delta, lo, hi));
      const unchangedFromBase = next.every((v, i) => v === S[i]);
      const anchors = unchangedFromBase ? anchors0 : cleanAnchors([...anchors0, a.age], s.profile, envelopeOf(s));
      const cur = levels(s);
      const same = next.every((v, i) => v === cur[i]) && anchors.length === s.anchors.length && anchors.every((v, i) => v === s.anchors[i]);
      if (same) return s;
      return withBlocks({ ...s, anchors }, toBlocks(next, x), celebrations(s.blocks), "custom");
    }
    case "autoFix": {
      const d = deathSegments(s.blocks);
      if (a.code === "E01") {
        d[0] = { ...d[0], toAge: Math.max(d[0].toAge, s.profile.age + envelopeOf(s).fixYears - 1) };
      } else {
        const { minMultiple, maxMultiple } = envelopeOf(s);
        for (let i = 0; i < d.length; i++) d[i] = { ...d[i], multiple: clamp(d[i].multiple, minMultiple, maxMultiple) };
      }
      return withBlocks({ ...s, anchors: [] }, d, celebrations(s.blocks), "custom");
    }
  }
}
