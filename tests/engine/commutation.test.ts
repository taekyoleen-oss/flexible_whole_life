import { describe, expect, it } from "vitest";
import kli7 from "@/lib/engine/data/rates-kli7.json";
import { commutation } from "@/lib/engine/commutation";

// G1: 31세 남, 만기 90 → n=59, 20년납 월납, i=3.4%
const k = commutation({ interest: 0.034, q: kli7.M.q, f: kli7.M.f }, 31, 59);

describe("commutation G1", () => {
  it("radix와 길이", () => {
    expect(k.lx[0]).toBe(100000);
    expect(k.lx).toHaveLength(60);
  });
  it("M* = Σ_{t<59} Cx[t] = 16212.828499", () => {
    const M = k.Cx.slice(0, 59).reduce((a, b) => a + b, 0);
    expect(M).toBeCloseTo(16212.828499, 5);
  });
  it("N*[m′] = 12·[(N′x0−N′x20) − 11/24·(D′x0−D′x20)] = 17378602.403207", () => {
    const N = 12 * ((k.Npx[0] - k.Npx[20]) - (11 / 24) * (k.Dpx[0] - k.Dpx[20]));
    expect(N).toBeCloseTo(17378602.403207, 4);
  });
});
