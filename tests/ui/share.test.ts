import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare, SHARE_VERSION } from "@/lib/share";
import { initialState, reducer } from "@/lib/state";

describe("공유 링크 직렬화", () => {
  const s = reducer(reducer(initialState(), { type: "level", age: 50, multiple: 1.5 }), { type: "addCelebration", age: 65 });
  it("압축 왕복: 상태가 그대로 돌아오고 URL 안전 문자만 쓴다", async () => {
    const h = await encodeShare(s);
    expect(h.startsWith("d.")).toBe(true);
    expect(h).toMatch(/^[A-Za-z0-9._-]+$/);
    const back = await decodeShare(h);
    expect(back?.state.blocks).toEqual(s.blocks);
    expect(back?.state.anchors).toEqual([50]);
    expect(back?.state.settings.assumption.id).toBe("default-2026");
    expect(back?.app).toBe(SHARE_VERSION);
  });
  it("비압축(j.) 폴백도 읽는다", async () => {
    const h = await encodeShare(s, false);
    expect(h.startsWith("j.")).toBe(true);
    expect((await decodeShare(h))?.state.S0).toBe(s.S0);
  });
  it("깨진 문자열·다른 형식은 null", async () => {
    expect(await decodeShare("d.@@@")).toBeNull();
    expect(await decodeShare("")).toBeNull();
    const tampered = "j." + Buffer.from(JSON.stringify({ v: 99, app: "x", state: s })).toString("base64url");
    expect(await decodeShare(tampered)).toBeNull();
  });
});
