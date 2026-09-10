import { toBlocks } from "./schedule";
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
}

export const PRESETS: Record<PresetId, { label: string; description: string }> = {
  level:  { label: "평준형",       description: "전 기간 같은 보험금" },
  child:  { label: "자녀연령형",   description: "막내 독립 6년 전부터 매년 10%씩 줄여 독립 후 30%" },
  debt:   { label: "부채상환형",   description: "부채 만기까지 선형 감액, 이후 30%" },
  retire: { label: "은퇴증액형",   description: "은퇴 직전 3년간 1.5배로 증액" },
  group:  { label: "단체보험보완형", description: "단체보험 기간 50%, 만기 전 4년간 100%로" },
  estate: { label: "상속준비형",   description: "초기 50%, 5년 후 연 10% 체증, 최대 2배" },
};

function multiples(id: PresetId, c: PresetContext): number[] {
  const n = c.n, S = new Array<number>(n).fill(1);
  const retire = c.retirementAge ?? 65, groupEnd = c.groupCoverEndAge ?? 60, indep = c.independenceAge ?? 25, growthEnd = c.growthEndAge ?? 70;
  switch (id) {
    case "level": return S;
    case "child": {
      // 독립 6년 전부터 매년 0.1씩 내려 독립 시점에 0.3. 경계가 초기 고정 구간 안이면 5년째부터 내린다
      const tDrop = Math.max(FIX_YEARS, indep - (c.youngestChildAge ?? 0));
      const start = Math.max(FIX_YEARS, tDrop - 6);
      for (let t = start; t < n; t++) S[t] = Math.max(0.3, 1 - 0.1 * (t - start + 1));
      return S;
    }
    case "debt": {
      const tEnd = Math.max(FIX_YEARS, c.debtYears ?? FIX_YEARS);
      for (let t = FIX_YEARS; t < n; t++) S[t] = t >= tEnd ? 0.3 : 1 - (0.7 * (t - FIX_YEARS)) / (tEnd - FIX_YEARS);
      return S;
    }
    case "retire": {
      const start = Math.max(FIX_YEARS, retire - c.age - 3), end = start + 3;
      for (let t = start; t < n; t++) S[t] = t >= end ? 1.5 : 1.5 ** ((t - start + 1) / 3);
      return S;
    }
    case "group": {
      const start = Math.max(FIX_YEARS, groupEnd - c.age - 4);
      for (let t = 0; t < n; t++) S[t] = t < start ? 0.5 : Math.min(1, 0.5 * 1.2 ** (t - start + 1));
      return S;
    }
    case "estate": {
      for (let t = 0; t < n; t++) {
        if (t < FIX_YEARS) { S[t] = 0.5; continue; }
        const cand = Math.min(2, 0.5 * 1.1 ** (t - FIX_YEARS + 1));
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
