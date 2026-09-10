import type { Commutation } from "./commutation";
import type { Contract } from "./types";

export interface LowSurrenderResult {
  stdCashUnit: number[]; // 표준형 환급금(1단위당, 미반올림)
  cashUnit: number[];    // 저해지 환급금(1단위당)
  deltaP: number;        // 순보험료 인하액(1회 납입, 1단위당)
}

export const LOW_SURRENDER_YEARS = 5; // 초기 고정 구간 = E01

/**
 * 초기 5년 환급금을 ratio 배로 낮추고, 해지 시 덜 돌려주는 금액의 현가를 보험료에서 뺀다.
 * ponytail: 해지자의 납입 중단을 N*에 반영하지 않은 단순화. 승격 경로는 nonsurrender 워크북의 해지율 이중탈퇴 방식.
 */
export function lowSurrender(k: Commutation, c: Contract, V: number[], alphaUnit: number, o: { ratio: number; lapse: number }): LowSurrenderResult {
  const m = c.payYears, k7 = Math.min(m, 7);
  const N = c.freq * ((k.Npx[0] - k.Npx[m]) - ((c.freq - 1) / (2 * c.freq)) * (k.Dpx[0] - k.Dpx[m]));
  const stdCashUnit = V.map((v, t) => Math.max(v - (alphaUnit * Math.max(k7 - t, 0)) / k7, 0));
  const cashUnit = stdCashUnit.map((w, t) => (t >= 1 && t <= LOW_SURRENDER_YEARS ? o.ratio * w : w));
  let pv = 0;
  for (let t = 1; t <= LOW_SURRENDER_YEARS; t++) pv += k.lxp[t] * o.lapse * (stdCashUnit[t] - cashUnit[t]) * k.v ** t;
  return { stdCashUnit, cashUnit, deltaP: pv / N };
}
