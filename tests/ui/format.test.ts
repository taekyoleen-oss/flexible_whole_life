import { describe, expect, it } from "vitest";
import { clamp, manwon, mult, pct, won, wonExact } from "@/lib/format";

describe("format", () => {
  it("금액: 100만원 이상은 백만원(소수 1자리), 그 아래는 천원(소수 1자리 = 백원)", () => {
    expect(won(1234567.4)).toBe("1.2백만원");
    expect(won(100000000)).toBe("100백만원");
    expect(won(283540)).toBe("283.5천원");
    expect(manwon(123456789)).toBe("123.5백만원");
    expect(won(0)).toBe("0천원");
    expect(wonExact(1234567.4)).toBe("1,234,567원");
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
