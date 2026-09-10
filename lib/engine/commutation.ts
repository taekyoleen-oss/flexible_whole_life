import type { Basis } from "./types";

export interface Commutation {
  n: number; v: number;
  lx: number[]; lxp: number[];   // 급부 집단(사망만) · 납입 집단(사망+납입면제), t=0..n
  Dx: number[]; Dpx: number[]; Cx: number[];
  Nx: number[]; Npx: number[];   // Σ_{u=t}^{n} — 모든 사용처가 차분이라 n에서 잘라도 원본과 같다
}

function revcum(a: number[]): number[] {
  const out = new Array<number>(a.length); let s = 0;
  for (let t = a.length - 1; t >= 0; t--) { s += a[t]; out[t] = s; }
  return out;
}

/** 원본 `기수표` 시트 수식. lx′는 1−q−f+q·f/2 (장해는 그 해 생존자에게만). Cx는 연중앙 사망. */
export function commutation(basis: Basis, age: number, n: number): Commutation {
  const v = 1 / (1 + basis.interest);
  const len = n + 1;
  const lx = new Array<number>(len), lxp = new Array<number>(len);
  lx[0] = lxp[0] = 100000;
  for (let t = 0; t < n; t++) {
    const q = basis.q[age + t] ?? 0, f = basis.f[age + t] ?? 0;
    lx[t + 1] = lx[t] * (1 - q);
    lxp[t + 1] = lxp[t] * (1 - q - f + (q * f) / 2);
  }
  const Dx = new Array<number>(len), Dpx = new Array<number>(len), Cx = new Array<number>(len);
  for (let t = 0; t < len; t++) {
    const q = basis.q[age + t] ?? 0;
    Dx[t] = lx[t] * v ** t;
    Dpx[t] = lxp[t] * v ** t;
    Cx[t] = lx[t] * q * v ** (t + 0.5);
  }
  return { n, v, lx, lxp, Dx, Dpx, Cx, Nx: revcum(Dx), Npx: revcum(Dpx) };
}
