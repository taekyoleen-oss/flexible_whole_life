import { describe, expect, it } from "vitest";
import { autoName, exportJson, LIBRARY_MAX, parseImport, remove, sanitizeLibrary, upsert, type LibraryEntry } from "@/lib/library";
import { initialState, reducer } from "@/lib/state";

describe("브라우저 보관함", () => {
  const s = reducer(initialState(), { type: "level", age: 50, multiple: 1.5 });
  const entry = (name: string, savedAt: number): LibraryEntry => ({ id: `id-${name}`, name, savedAt, state: s });
  it("기본 이름은 나이·성별·프리셋·월 보험료", () => {
    expect(autoName(initialState())).toMatch(/^40세 남 · 평준형 · 월 [\d,.]+(천|백만)원$/);
    expect(autoName(s)).toContain("직접 설계");
  });
  it("같은 이름은 덮어쓰고 최신 순, 최대 건수 유지", () => {
    let list = upsert([], entry("A", 1));
    list = upsert(list, entry("B", 2));
    list = upsert(list, { ...entry("A", 3), id: "id-A2" });
    expect(list.map((e) => e.name)).toEqual(["A", "B"]);
    expect(list[0].id).toBe("id-A2");
    for (let i = 0; i < LIBRARY_MAX + 5; i++) list = upsert(list, entry(`N${i}`, 10 + i));
    expect(list).toHaveLength(LIBRARY_MAX);
    expect(remove(list, list[0].id)).toHaveLength(LIBRARY_MAX - 1);
  });
  it("손상된 목록은 걸러지고 상태는 정화된다", () => {
    const list = sanitizeLibrary([entry("ok", 5), { id: 1 }, null, { id: "x", name: "bad", state: { S0: 5, profile: { age: 200 } } }]);
    expect(list.map((e) => e.name)).toEqual(["ok", "bad"]);
    expect(list[1].state.S0).toBe(1e7);
    expect(list[1].state.profile.age).toBe(70);
    expect(sanitizeLibrary("junk")).toEqual([]);
  });
  it("JSON 내보내기·가져오기 왕복, 맨 상태·페이로드 모두 허용, 아니면 null", () => {
    const text = exportJson(s, "테스트");
    const back = parseImport(text);
    expect(back?.name).toBe("테스트");
    expect(back?.state.blocks).toEqual(s.blocks);
    expect(parseImport(JSON.stringify(s))?.state.anchors).toEqual([50]);
    expect(parseImport("{\"hello\":1}")).toBeNull();
    expect(parseImport("not json")).toBeNull();
  });
});
