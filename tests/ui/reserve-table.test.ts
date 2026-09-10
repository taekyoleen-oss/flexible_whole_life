import { describe, expect, it } from "vitest";
import { reserveCsv, reserveRows, RESERVE_HEADERS } from "@/lib/reserve-table";
import { evaluate, initialState, reducer } from "@/lib/state";

describe("준비금·환급금 연도별 표", () => {
  const s = reducer(reducer(initialState(), { type: "level", age: 50, multiple: 1.5 }), { type: "addCelebration", age: 65 });
  const r = evaluate(s);
  const rows = reserveRows(s, r);
  it("경과년 0~n, 연령·보험금·축하금·준비금·환급금이 엔진 값과 맞는다", () => {
    expect(rows).toHaveLength(r.n + 1);
    expect(rows[0]).toMatchObject({ t: 0, age: 40, benefit: 1e8, paid: 0, cash: 0 });
    expect(rows[10].benefit).toBe(1.5e8);            // 50세부터 1.5배
    expect(rows[25].celebration).toBe(0.15e8);       // 65세 축하금 = 보험금의 10%
    expect(rows[20].reserve).toBe(r.reserve100k[20] * r.units);
    expect(rows[20].cash).toBe(r.surrender.cash[20]);
    expect(rows[20].rate).toBeCloseTo(r.surrender.rate[20], 12);
    expect(rows[0].expense).toBe(r.expenseFlow[0]);            // 0년차 = 신계약비 + 유지·수금비
    expect(rows[0].expense).toBeGreaterThan(rows[1].expense);
    expect(rows[r.n].expense).toBe(0);                          // 보장 종료 후
  });
  it("저해지면 환급금·납입누계가 인하 기준", () => {
    const low = reducer(s, { type: "lowSurrender", on: true });
    const rl = evaluate(low);
    const rowsLow = reserveRows(low, rl);
    expect(rowsLow[5].cash).toBe(rl.lowSurrender!.cash[5]);
    expect(rowsLow[20].paid).toBe(rl.lowSurrender!.paid[20]);
  });
  it("CSV: BOM, 헤더, CRLF, 원 단위 정수, 환급률 %", () => {
    const csv = reserveCsv(rows.slice(0, 3));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(RESERVE_HEADERS.join(","));
    expect(lines).toHaveLength(4);
    expect(lines[1].split(",").slice(0, 3)).toEqual(["0", "40", "100000000"]);
    expect(lines[3].split(",")[8]).toMatch(/^\d+\.\d$/);
    expect(lines[1].split(",")).toHaveLength(RESERVE_HEADERS.length);
  });
});
