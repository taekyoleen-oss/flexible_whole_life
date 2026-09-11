const grp = (x: number) => (Math.round(x) || 0).toLocaleString("ko-KR"); // -0·NaN → 0

export const won = (x: number) => `${grp(x)}원`;
export const manwon = (x: number) => `${grp(x / 1e4)}만원`;
export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const mult = (x: number) => `${Math.round(x * 100) / 100}배`;
export const clamp = (x: number, lo: number, hi: number) => (x >= lo ? Math.min(hi, x) : lo);

/** 기준보험금 단위. 1천만원 단위로만 잡아야 그래프 1칸(10%)이 100만원 단위가 된다 */
export const S0_UNIT = 1e7;
export const S0_MIN = 1e7, S0_MAX = 1e10;
export const roundS0 = (S0: number) => clamp(Math.round(S0 / S0_UNIT) * S0_UNIT, S0_MIN, S0_MAX);
