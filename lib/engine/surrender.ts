export interface SurrenderResult {
  reserve: number[];   // 가입금액 기준 준비금(원)
  deduction: number[]; // 해약공제(원)
  cash: number[];      // 해약환급금(원, 반올림)
  paid: number[];      // 납입보험료 누계(원)
  rate: number[];      // 환급률
}

/**
 * 원본 `W` 시트. V100k·alpha100k·gross100k는 10만원당 정수, units = 가입금액/10만.
 * 해약공제 = 신계약비 × max(min(m,7) − t, 0)/min(m,7).
 */
export function surrender(V100k: number[], alpha100k: number, gross100k: number, m: number, freq: number, units: number): SurrenderResult {
  const k7 = Math.min(m, 7);
  const NC = alpha100k * units, Pf = gross100k * units;
  const reserve: number[] = [], deduction: number[] = [], cash: number[] = [], paid: number[] = [], rate: number[] = [];
  for (let t = 0; t < V100k.length; t++) {
    reserve[t] = V100k[t] * units;
    deduction[t] = (NC * Math.max(k7 - t, 0)) / k7;
    cash[t] = Math.round(Math.max(reserve[t] - deduction[t], 0));
    paid[t] = Math.min(t, m) * freq * Pf;
    rate[t] = paid[t] > 0 ? cash[t] / paid[t] : 0;
  }
  return { reserve, deduction, cash, paid, rate };
}
