import { describe, expect, it } from "vitest";
import { clamp, manwon, mult, pct, won } from "@/lib/format";

describe("format", () => {
  it("원·만원 천 단위 구분", () => {
    expect(won(1234567.4)).toBe("1,234,567원");
    expect(manwon(123456789)).toBe("12,346만원");
    expect(won(0)).toBe("0원");
  });
  it("백분율·배수", () => {
    expect(pct(0.269)).toBe("26.9%");
    expect(pct(0.98234, 2)).toBe("98.23%");
    expect(mult(0.3)).toBe("0.3배");
    expect(mult(1.145)).toBe("1.15배");
  });
  it("clamp", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
