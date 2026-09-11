export interface EnvelopeParams {
  fixYears: number;      // E01
  maxGrowth: number;     // E02 연 증가율 상한
  growthEndAge: number;  // E03
  maxMultiple: number;   // E04
  minMultiple: number;   // E05
  minAmount: number;     // E06 원
  uwLimit: number;       // E07 원
}
/** 그래프 한 칸 = 기준보험금의 10%. E02는 비율 상한과 이 절대 폭 중 큰 쪽을 허용한다 */
export const MAX_STEP = 0.1;
export const DEFAULT_ENVELOPE: EnvelopeParams = { fixYears: 5, maxGrowth: 0.2, growthEndAge: 70, maxMultiple: 3, minMultiple: 0.2, minAmount: 1e7, uwLimit: 1e9 };

export interface EnvelopeContext { S0: number; age: number; n: number; payYears: number; freq: number; grossUnit: number }
export interface Violation { code: string; message: string; year?: number; suggestion: string }

const EPS = 1e-9;

/** 순수 함수. 위반 코드별 첫 발생 연도만 보고한다. */
export function validate(S: number[], C: number[], c: EnvelopeContext, p: EnvelopeParams): Violation[] {
  const out: Violation[] = [];
  const push = (code: string, message: string, suggestion: string, year?: number) => { if (!out.some((v) => v.code === code)) out.push({ code, message, suggestion, year }); };
  const n = S.length;
  for (let t = 1; t < Math.min(p.fixYears, n); t++) if (Math.abs(S[t] - S[0]) > EPS) { push("E01", `초기 ${p.fixYears}년(${c.age}~${c.age + p.fixYears - 1}세)은 보험금을 바꿀 수 없습니다`, `변경 시점을 ${c.age + p.fixYears}세로 옮기세요`, t); break; }
  for (let t = 1; t < n; t++) {
    // 연 증가율 상한 또는 한 칸(기준보험금의 10%) 중 큰 쪽까지 허용: 낮은 배수(0.3 → 0.4)에서 1칸 규칙이 비율 규칙에 막히지 않게
    if (S[t] > Math.max(S[t - 1] * (1 + p.maxGrowth), S[t - 1] + MAX_STEP) + EPS) push("E02", `연 증가율이 ${p.maxGrowth * 100}%(또는 한 칸 10%)를 넘습니다 (${c.age + t}세)`, "증액을 여러 해에 나누세요", t);
    if (S[t] > S[t - 1] + EPS && c.age + t > p.growthEndAge) push("E03", `${p.growthEndAge}세 이후에는 증액할 수 없습니다 (${c.age + t}세)`, `증액을 ${p.growthEndAge}세 전에 마치세요`, t);
  }
  const max = Math.max(...S), min = Math.min(...S);
  if (max > p.maxMultiple + EPS) push("E04", `최대 배수 ${p.maxMultiple}배를 넘습니다`, "배수를 낮추세요");
  if (min < p.minMultiple - EPS) push("E05", `기준보험금의 ${p.minMultiple * 100}% 아래로 줄일 수 없습니다`, `${p.minMultiple}배 이상으로 올리세요`);
  if (min * c.S0 < p.minAmount - EPS) push("E06", `보험금이 최소 ${p.minAmount.toLocaleString()}원 아래입니다`, "초기 보험금 또는 배수를 올리세요");
  if (max * c.S0 > p.uwLimit + EPS) push("E07", `최대 보험금이 심사 한도 ${p.uwLimit.toLocaleString()}원을 넘습니다`, "초기 보험금을 줄이세요");
  let cum = 0;
  for (let t = 0; t < C.length; t++) {
    cum += C[t] ?? 0;
    if (cum > Math.min(t, c.payYears) * c.freq * c.grossUnit + EPS) { push("E08", `${c.age + t}세까지 생존급부 합계가 그때까지 낸 보험료를 넘습니다`, "축하금을 줄이거나 늦추세요", t); break; }
  }
  return out;
}
