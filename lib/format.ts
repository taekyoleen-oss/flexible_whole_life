const grp = (x: number) => Math.round(x).toLocaleString("ko-KR");

export const won = (x: number) => `${grp(x)}원`;
export const manwon = (x: number) => `${grp(x / 1e4)}만원`;
export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const mult = (x: number) => `${Math.round(x * 100) / 100}배`;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
