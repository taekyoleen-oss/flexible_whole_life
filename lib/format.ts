const grp = (x: number) => (Math.round(x) || 0).toLocaleString("ko-KR"); // -0·NaN → 0

const dec1 = (x: number) => (Math.round(x * 10) / 10 || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
/** 금액 표시: 100만원 이상은 백만원(소수 1자리 = 십만원), 그 아래는 천원(소수 1자리 = 백원) */
export const won = (x: number) => (Math.abs(x) >= 1e6 ? `${dec1(x / 1e6)}백만원` : `${dec1(x / 1e3)}천원`);
/** 입력값 등 만원 단위가 자연스러운 곳도 같은 표시 규칙을 쓴다 */
export const manwon = won;
/** 그래프 눈금용 짧은 표기: 백만 / 천 */
export const wonShort = (x: number) => (Math.abs(x) >= 1e6 ? `${dec1(x / 1e6)}백만` : `${dec1(x / 1e3)}천`);
/** 원 단위 그대로(검산·표 상세용) */
export const wonExact = (x: number) => `${grp(x)}원`;
export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const mult = (x: number) => `${Math.round(x * 100) / 100}배`;
export const clamp = (x: number, lo: number, hi: number) => (x >= lo ? Math.min(hi, x) : lo);

/** 기준보험금 단위. 1천만원 단위로만 잡아야 그래프 1칸(10%)이 100만원 단위가 된다 */
export const S0_UNIT = 1e7;
export const S0_MIN = 1e7, S0_MAX = 1e10;
export const roundS0 = (S0: number) => clamp(Math.round(S0 / S0_UNIT) * S0_UNIT, S0_MIN, S0_MAX);
