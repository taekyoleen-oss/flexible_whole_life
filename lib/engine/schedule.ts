import type { Block } from "./types";

/** 카드 → 연 벡터. S[t] t=0..n-1 사망보장 배수(뒤 카드가 덮음), C[t] t=0..n 시점 생존급부 배수(누적). */
export function expandBlocks(blocks: Block[], age: number, n: number): { S: number[]; C: number[] } {
  const S = new Array<number>(n).fill(0), C = new Array<number>(n + 1).fill(0);
  for (const b of blocks) {
    if (b.kind === "celebration") { const t = b.fromAge - age; if (t >= 0 && t <= n) C[t] += b.multiple; continue; }
    for (let a = Math.max(b.fromAge, age); a <= Math.min(b.toAge, age + n - 1); a++) S[a - age] = b.multiple;
  }
  return { S, C };
}

/** 연 벡터 → 같은 배수 구간을 합친 death 카드 */
export function toBlocks(S: number[], age: number): Block[] {
  const out: Block[] = [];
  for (let t = 0; t < S.length; t++) {
    const last = out[out.length - 1];
    if (last && last.multiple === S[t]) last.toAge = age + t;
    else out.push({ fromAge: age + t, toAge: age + t, multiple: S[t], kind: "death" });
  }
  return out;
}
