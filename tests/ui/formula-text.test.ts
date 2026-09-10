import { describe, expect, it } from "vitest";
import { formulaHtml, parseFormula } from "@/lib/formula-text";

describe("formula-text", () => {
  it("braced and single-token subscripts/superscripts", () => {
    expect(parseFormula("l_{x+1} = l_x·v^t")).toEqual([
      { kind: "text", text: "l" }, { kind: "sub", text: "x+1" }, { kind: "text", text: " = l" }, { kind: "sub", text: "x" },
      { kind: "text", text: "·v" }, { kind: "sup", text: "t" },
    ]);
  });
  it("sum limits, primes, Korean groups, sup then sub", () => {
    expect(formulaHtml("Σ_{t=0}^{n−1} S_t")).toBe("Σ<sub>t=0</sub><sup>n−1</sup> S<sub>t</sub>");
    expect(formulaHtml("N′_{x+max(t,m)}")).toBe("N′<sub>x+max(t,m)</sub>");
    expect(formulaHtml("W^{저}_t = α_{공제}")).toBe("W<sup>저</sup><sub>t</sub> = α<sub>공제</sub>");
    expect(formulaHtml("P_base")).toBe("P<sub>base</sub>");
  });
  it("leaves lone _ / ^ and escapes html", () => {
    expect(formulaHtml("a_ b ^ <c>")).toBe("a_ b ^ &lt;c&gt;");
  });
});
