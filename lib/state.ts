import kli7 from "@/lib/engine/data/rates-kli7.json";
import { buildPreset, compute, DEFAULT_ENVELOPE, getAssumption, type Block, type EngineInput, type EngineResult, type PresetContext, type PresetId, type RateTable, type Sex } from "@/lib/engine";
import { clamp } from "./format";

export const TABLE = kli7 as RateTable;
export const ASSUMPTION_ID = "default-2026";
export const STORAGE_KEY = "fwl:design:v1";

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

export function presetContext(p: Profile): PresetContext {
  return {
    age: p.age, n: termOf(p),
    youngestChildAge: p.childrenAges.length ? Math.min(...p.childrenAges) : undefined,
    debtYears: p.debt > 0 ? p.debtYears : undefined,
    retirementAge: p.retirementAge, groupCoverEndAge: p.groupCoverEndAge,
    growthEndAge: DEFAULT_ENVELOPE.growthEndAge,
  };
}

export function initialState(): DesignState {
  return {
    version: 1, profile: DEFAULT_PROFILE, S0: 1e8, payYears: 20, waiver: true, lowSurrender: false,
    presetId: "level", blocks: buildPreset("level", presetContext(DEFAULT_PROFILE)), updatedAt: 0,
  };
}
export const DEFAULT_STATE: DesignState = initialState();

export function toEngineInput(s: DesignState): EngineInput {
  return { sex: s.profile.sex, age: s.profile.age, payYears: s.payYears, S0: s.S0, blocks: s.blocks, waiver: s.waiver, lowSurrender: s.lowSurrender };
}

/** 현재 가정 세트·위험률표로 설계 상태를 산출한다 */
export const evaluate = (s: DesignState): EngineResult => compute(toEngineInput(s), getAssumption(ASSUMPTION_ID), TABLE);

/** 고객이 실제로 내는 보험료 기준 요약. 저해지 ON이면 인하된 보험료·환급금을 쓴다. */
export function effective(r: EngineResult, payYears: number) {
  const low = r.lowSurrender;
  const gross100k = low?.gross100k ?? r.per100k.gross;
  const monthly = low?.monthlyGross ?? r.monthly.gross;
  return {
    isLow: low !== undefined,
    gross100k,
    monthly,
    totalPaid: monthly * 12 * payYears, // 12 = 월납; 앱은 freq를 12로 고정한다
    cash: low?.cash ?? r.surrender.cash,
    rate: low?.rate ?? r.surrender.rate,
    standardMonthly: r.monthly.gross,
  };
}

/** 월 보험료(원) → 기준보험금(원, 1만원 단위). gross100k = 10만원당 월 영업보험료(정수) */
export const s0FromMonthly = (monthly: number, gross100k: number) => clamp(Math.round((monthly * 1e5) / gross100k / 1e4) * 1e4, 1e6, 1e10);

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
    age: clamp(Math.round(p.age), 15, 70),
    childrenAges: p.childrenAges.map((a) => clamp(Math.round(a), 0, 40)).slice(0, 6),
    income: Math.max(0, p.income), liquidAssets: Math.max(0, p.liquidAssets), debt: Math.max(0, p.debt),
    debtYears: clamp(Math.round(p.debtYears), 1, 40),
    retirementAge: clamp(Math.round(p.retirementAge), 40, 80),
    groupCover: Math.max(0, p.groupCover), groupCoverEndAge: clamp(Math.round(p.groupCoverEndAge), 20, 80),
    termCover: Math.max(0, p.termCover), termCoverEndAge: clamp(Math.round(p.termCoverEndAge), 20, 100),
  };
}

function withBlocks(s: DesignState, deaths: Block[], cels: Block[], presetId: DesignState["presetId"] = s.presetId): DesignState {
  const p = s.profile;
  const d = normalizeSegments(deaths, p.age, endAgeOf(p));
  const c = cels.filter((b) => b.fromAge >= p.age && b.fromAge <= p.age + termOf(p)).map((b) => ({ ...b, toAge: b.fromAge }));
  return { ...s, blocks: [...d, ...c], presetId, updatedAt: Date.now() };
}

export type Action =
  | { type: "load"; state: DesignState }
  | { type: "reset" }
  | { type: "profile"; patch: Partial<Profile> }
  | { type: "S0"; S0: number }
  | { type: "payYears"; payYears: number }
  | { type: "waiver"; on: boolean }
  | { type: "lowSurrender"; on: boolean }
  | { type: "preset"; id: PresetId }
  | { type: "segment"; index: number; patch: { toAge?: number; multiple?: number } }
  | { type: "splitSegment"; index: number }
  | { type: "removeSegment"; index: number }
  | { type: "addCelebration"; age: number; multiple: number }
  | { type: "celebration"; index: number; patch: { fromAge?: number; multiple?: number } }
  | { type: "removeCelebration"; index: number }
  | { type: "autoFix"; code: "E01" | "E04" | "E05" };

export function reducer(s: DesignState, a: Action): DesignState {
  const touch = (patch: Partial<DesignState>): DesignState => ({ ...s, ...patch, updatedAt: Date.now() });
  switch (a.type) {
    case "load": {
      const raw = a.state as Partial<DesignState> | null | undefined;
      const profile = clampProfile({ ...DEFAULT_PROFILE, ...raw?.profile });
      const blocks = Array.isArray(raw?.blocks) ? raw.blocks : [];
      const merged: DesignState = { ...DEFAULT_STATE, ...raw, profile };
      const payYears = clamp(Math.round(Number(merged.payYears)), 1, termOf(profile));
      const S0 = clamp(Math.round(Number(merged.S0)), 1e6, 1e10);
      return { ...withBlocks({ ...merged, payYears, S0 }, deathSegments(blocks), celebrations(blocks)), updatedAt: merged.updatedAt };
    }
    case "reset": return initialState();
    case "profile": {
      const profile = clampProfile({ ...s.profile, ...a.patch });
      const next = { ...s, profile };
      const deaths = s.presetId === "custom" ? deathSegments(s.blocks) : buildPreset(s.presetId, presetContext(profile));
      return withBlocks(next, deaths, celebrations(s.blocks));
    }
    case "S0": return touch({ S0: clamp(Math.round(a.S0), 1e6, 1e10) });
    case "payYears": return touch({ payYears: clamp(Math.round(a.payYears), 1, termOf(s.profile)) });
    case "waiver": return touch({ waiver: a.on });
    case "lowSurrender": return touch({ lowSurrender: a.on });
    case "preset": return withBlocks(s, buildPreset(a.id, presetContext(s.profile)), celebrations(s.blocks), a.id);
    case "segment": {
      if (!deathSegments(s.blocks)[a.index]) return s;
      const d = deathSegments(s.blocks).map((b, i) => i !== a.index ? b : {
        ...b,
        toAge: a.patch.toAge === undefined ? b.toAge : Math.round(a.patch.toAge),
        multiple: a.patch.multiple === undefined ? b.multiple : clamp(a.patch.multiple, 0, 10),
      });
      return withBlocks(s, d, celebrations(s.blocks), "custom");
    }
    case "splitSegment": {
      const d = deathSegments(s.blocks);
      const b = d[a.index];
      if (!b || b.toAge - b.fromAge < 1) return s;
      const mid = Math.floor((b.fromAge + b.toAge) / 2);
      d.splice(a.index, 1, { ...b, toAge: mid }, { ...b, fromAge: mid + 1 });
      return withBlocks(s, d, celebrations(s.blocks), "custom");
    }
    case "removeSegment": {
      const d = deathSegments(s.blocks);
      if (d.length < 2 || !d[a.index]) return s;
      if (a.index > 0) d[a.index - 1] = { ...d[a.index - 1], toAge: d[a.index].toAge };
      d.splice(a.index, 1);
      return withBlocks(s, d, celebrations(s.blocks), "custom");
    }
    case "addCelebration": {
      const c: Block = { fromAge: Math.round(a.age), toAge: Math.round(a.age), multiple: clamp(a.multiple, 0, 10), kind: "celebration" };
      return withBlocks(s, deathSegments(s.blocks), [...celebrations(s.blocks), c]);
    }
    case "celebration": {
      if (!celebrations(s.blocks)[a.index]) return s;
      const c = celebrations(s.blocks).map((b, i) => i !== a.index ? b : {
        ...b,
        fromAge: a.patch.fromAge === undefined ? b.fromAge : Math.round(a.patch.fromAge),
        multiple: a.patch.multiple === undefined ? b.multiple : clamp(a.patch.multiple, 0, 10),
      });
      return withBlocks(s, deathSegments(s.blocks), c);
    }
    case "removeCelebration":
      return withBlocks(s, deathSegments(s.blocks), celebrations(s.blocks).filter((_, i) => i !== a.index));
    case "autoFix": {
      const d = deathSegments(s.blocks);
      if (a.code === "E01") {
        d[0] = { ...d[0], toAge: Math.max(d[0].toAge, s.profile.age + DEFAULT_ENVELOPE.fixYears - 1) };
      } else {
        const { minMultiple, maxMultiple } = DEFAULT_ENVELOPE;
        for (let i = 0; i < d.length; i++) d[i] = { ...d[i], multiple: clamp(d[i].multiple, minMultiple, maxMultiple) };
      }
      return withBlocks(s, d, celebrations(s.blocks), "custom");
    }
  }
}
