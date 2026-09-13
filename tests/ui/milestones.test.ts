import { describe, expect, it } from "vitest";
import { milestones } from "@/lib/milestones";
import { initialState, reducer } from "@/lib/state";

describe("그래프 주요 시점 표시", () => {
  it("자녀연령형: 가입 시 자녀 나이와 독립 시점, 표준이면 막내 5세 가정", () => {
    let s = reducer(initialState(), { type: "preset", id: "child" });
    let m = milestones(s);
    expect(m.map((x) => x.label)).toEqual(["가입 · 막내 5세 가정", "막내 독립 25세 (표준)"]);
    expect(m[1].age).toBe(60);
    s = reducer(s, { type: "profile", patch: { childrenAges: [3, 6], income: 6e7 } });
    s = reducer(s, { type: "applyInfo", applied: { child: true } });
    m = milestones(s);
    expect(m[0]).toMatchObject({ age: 40, label: "가입 · 자녀 3·6세", anchor: "start" });
    expect(m.find((x) => x.label === "자녀(6세) 독립")?.age).toBe(59);
    expect(m.find((x) => x.label === "막내 독립 25세")?.age).toBe(62);
  });
  it("은퇴·퇴직·대출 종료·증액 종료, 추가 조건 종료", () => {
    const base = initialState();
    expect(milestones(reducer(base, { type: "preset", id: "retire" }))[0]).toMatchObject({ age: 65, label: "은퇴 65세 (표준)" });
    let r = reducer(reducer(base, { type: "profile", patch: { retirementAge: 60 } }), { type: "applyInfo", applied: { retire: true }, presetId: "retire" });
    expect(milestones(r)[0]).toMatchObject({ age: 60, label: "은퇴 60세" });
    expect(milestones(reducer(base, { type: "preset", id: "group" }))[0].label).toContain("퇴직 65세");
    const d = reducer(reducer(base, { type: "profile", patch: { debt: 1e8, debtYears: 15 } }), { type: "applyInfo", applied: { debt: true }, presetId: "debt" });
    expect(milestones(d)[0]).toMatchObject({ age: 55, label: "대출 종료" });
    expect(milestones(reducer(base, { type: "preset", id: "estate" }))[0]).toMatchObject({ age: 70 });
    expect(milestones(base)).toEqual([]);   // 평준형은 시점 없음
    const a = reducer(base, { type: "addAddon", addon: { id: "L", kind: "loan", amount: 1e8, years: 10 } });
    expect(milestones(a)).toEqual([{ age: 50, label: "대출 종료(추가)", kind: "addon", anchor: undefined }]);
    r = reducer(a, { type: "level", age: 60, multiple: 1.3 });   // 직접 편집해도 기반 프리셋 시점은 유지
    expect(milestones(reducer(reducer(base, { type: "preset", id: "retire" }), { type: "level", age: 60, multiple: 1.3 }))[0].label).toContain("은퇴");
  });
});
