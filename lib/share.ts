import { initialState, reducer, type DesignState } from "./state";

export const SHARE_VERSION = "0.1";      // 앱 버전. 불일치 시 경고만 하고 읽는다
const FORMAT = 1;                          // 페이로드 형식. 불일치 시 거부

export interface SharePayload { v: number; app: string; state: DesignState }

const toB64u = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes.slice()]).stream().pipeThrough(stream));   // slice(): ArrayBuffer 기반 복사(타입 호환)
  return new Uint8Array(await res.arrayBuffer());
}

/** 설계 상태 → URL 해시 문자열. `d.` = deflate-raw 압축, `j.` = 비압축(구형 브라우저 폴백) */
export async function encodeShare(state: DesignState, compress = typeof CompressionStream !== "undefined"): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ v: FORMAT, app: SHARE_VERSION, state } satisfies SharePayload));
  if (!compress) return "j." + toB64u(json);
  return "d." + toB64u(await pipe(json, new CompressionStream("deflate-raw")));
}

/** 해시 문자열 → 페이로드. 형식이 다르거나 깨졌으면 null. 상태는 리듀서 load로 정화해서 돌려준다 */
export async function decodeShare(hash: string): Promise<SharePayload | null> {
  try {
    const h = hash.replace(/^#/, "");
    const body = h.slice(2);
    if (!body) return null;
    const bytes = h.startsWith("d.") ? await pipe(fromB64u(body), new DecompressionStream("deflate-raw")) : h.startsWith("j.") ? fromB64u(body) : null;
    if (!bytes) return null;
    const p = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SharePayload>;
    if (p.v !== FORMAT || !p.state || typeof p.app !== "string") return null;
    return { v: FORMAT, app: p.app, state: reducer(initialState(), { type: "load", state: p.state }) };
  } catch {
    return null;
  }
}
