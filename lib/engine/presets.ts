import { toBlocks } from "./schedule";
import { regularizeShape } from "./finance";
import type { Block } from "./types";

export const FIX_YEARS = 5;
export type PresetId = "level" | "child" | "debt" | "retire" | "group" | "estate";

export interface PresetContext {
  age: number; n: number;
  youngestChildAge?: number;  // 막내 나이
  debtYears?: number;         // 부채 만기까지 연수
  retirementAge?: number;     // 기본 65
  groupCoverEndAge?: number;  // 단체보험 만기 나이, 기본 60
  independenceAge?: number;   // 기본 25
  growthEndAge?: number;      // E03, 기본 70
  targets?: Partial<Record<PresetId, { target: number[]; floor?: number }>>;   // 조건 반영: 필요액 곡선을 배수로 정규화한 목표(길이 n). 있으면 표준 모양 대신 규칙에 맞춰 그린다
  fixYears?: number;          // E01, 기본 5
  maxMultiple?: number;       // E04, 기본 3
  minMultiple?: number;       // E05, 기본 0.2
}

export const PRESETS: Record<PresetId, { label: string; description: string }> = {
  level:  { label: "평준형",       description: "전 기간 같은 보험금" },
  child:  { label: "자녀연령형",   description: "막내 독립 6년 전부터 매년 10%씩 줄여 독립 후 30%" },
  debt:   { label: "부채상환형",   description: "부채 만기까지 선형 감액, 이후 30%" },
  retire: { label: "은퇴증액형",   description: "은퇴 전 5년간 매년 10%씩 올려 1.5배" },
  group:  { label: "단체보험보완형", description: "재직 중 50%, 퇴직 전 5년간 매년 10%씩 100%로" },
  estate: { label: "상속준비형",   description: "초기 50%, 5년 후 매년 10%씩 체증, 최대 2배" },
};

function multiples(id: PresetId, c: PresetContext): number[] {
  const n = c.n, S = new Array<number>(n).fill(1);
  const retire = c.retirementAge ?? 65, groupEnd = c.groupCoverEndAge ?? retire, indep = c.independenceAge ?? 25, growthEnd = c.growthEndAge ?? 70;
  const FIX = Math.max(1, c.fixYears ?? FIX_YEARS), hi = c.maxMultiple ?? 3, lo = c.minMultiple ?? 0.2;
  const tg = c.targets?.[id];
  if (tg && tg.target.length === n) {
    return regularizeShape(tg.target, { fixYears: FIX, step: 0.1, maxMultiple: hi, minMultiple: lo, floor: tg.floor, growthEndIndex: growthEnd - c.age });
  }
  switch (id) {
    case "level": return S;
    case "child": {
      // 독립 6년 전부터 매년 0.1씩 내려 독립 시점에 0.3. 경계가 초기 고정 구간 안이면 5년째부터 내린다
      const tDrop = Math.max(FIX, indep - (c.youngestChildAge ?? 0));
      const start = Math.max(FIX, tDrop - 6);
      for (let t = start; t < n; t++) S[t] = Math.max(0.3, 1 - 0.1 * (t - start + 1));
      return S;
    }
    case "debt": {
      // 만기까지 선형 감액하되 매년 한 칸(0.1)을 넘지 않는다(만기가 짧으면 0.3에 늦게 닿는다)
      const tEnd = Math.max(FIX + 1, c.debtYears ?? FIX);
      const slope = Math.min(0.1, 0.7 / (tEnd - FIX));
      for (let t = FIX; t < n; t++) S[t] = Math.max(0.3, 1 - slope * (t - FIX + 1));
      return S;
    }
    // 프리셋의 증액도 그래프 편집 규칙과 같이 매년 한 칸(기준보험금의 10%)씩만 움직인다
    case "retire": {
      const start = Math.max(FIX, Math.min(retire, growthEnd + 1) - c.age - 5);   // 은퇴 5년 전부터 +0.1/년, 은퇴 직전 해에 1.5 (증액은 70세까지)
      for (let t = start; t < n; t++) S[t] = Math.min(1.5, hi, 1 + 0.1 * (t - start + 1));
      return S;
    }
    case "group": {
      const start = Math.max(FIX, Math.min(groupEnd, growthEnd + 1) - c.age - 5);   // 퇴직 5년 전부터 +0.1/년, 퇴직 직전 해에 1.0 (증액은 70세까지)
      for (let t = 0; t < n; t++) S[t] = t < start ? 0.5 : Math.min(1, 0.5 + 0.1 * (t - start + 1));
      return S;
    }
    case "estate": {
      for (let t = 0; t < n; t++) {
        if (t < FIX) { S[t] = 0.5; continue; }
        const cand = Math.min(2, hi, 0.5 + 0.1 * (t - FIX + 1));   // +0.1/년, 15년 뒤 2배
        S[t] = c.age + t > growthEnd ? S[t - 1] : cand;
      }
      return S;
    }
  }
}

export function buildPreset(id: PresetId, c: PresetContext): Block[] {
  // 배수는 소수 4자리로 정리한다(선형 램프의 부동소수 잡음이 카드 입력에 그대로 보이지 않게)
  return toBlocks(multiples(id, c).map((x) => Math.round(x * 1e4) / 1e4), c.age);
}
