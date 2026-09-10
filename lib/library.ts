import { PRESETS } from "@/lib/engine";
import { won } from "./format";
import { SHARE_VERSION, type SharePayload } from "./share";
import { effective, evaluate, initialState, reducer, type DesignState } from "./state";

/** 브라우저 보관함(localStorage). Supabase 없이 설계 여러 건을 이름으로 저장·전환한다 */
export const LIBRARY_KEY = "fwl:designs:v1";
export const LIBRARY_MAX = 50;

export interface LibraryEntry { id: string; name: string; savedAt: number; state: DesignState }

/** "45세 여 · 부채상환형 · 월 300,000원" 같은 기본 이름 */
export function autoName(s: DesignState): string {
  const r = evaluate(s);
  const preset = s.presetId === "custom" ? "직접 설계" : PRESETS[s.presetId].label;
  return `${s.profile.age}세 ${s.profile.sex === "M" ? "남" : "여"} · ${preset} · 월 ${won(effective(r, s.payYears).monthly)}`;
}

/** 같은 이름이 있으면 덮어쓰고, 최신 순으로 최대 LIBRARY_MAX건 유지 */
export function upsert(list: LibraryEntry[], entry: LibraryEntry): LibraryEntry[] {
  return [entry, ...list.filter((e) => e.name !== entry.name && e.id !== entry.id)].sort((a, b) => b.savedAt - a.savedAt).slice(0, LIBRARY_MAX);
}

export const remove = (list: LibraryEntry[], id: string) => list.filter((e) => e.id !== id);

/** 저장된 목록을 믿지 않는다: 형태가 맞는 항목만, 상태는 리듀서 load로 정화 */
export function sanitizeLibrary(raw: unknown): LibraryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LibraryEntry[] = [];
  for (const e of raw as Partial<LibraryEntry>[]) {
    if (!e || typeof e !== "object" || typeof e.id !== "string" || typeof e.name !== "string" || !e.state) continue;
    out.push({ id: e.id, name: e.name, savedAt: typeof e.savedAt === "number" ? e.savedAt : 0, state: reducer(initialState(), { type: "load", state: e.state as DesignState }) });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt).slice(0, LIBRARY_MAX);
}

export function loadLibrary(): LibraryEntry[] {
  try { return sanitizeLibrary(JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "[]")); } catch { return []; }
}
export function saveLibrary(list: LibraryEntry[]): void {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(list)); } catch { /* 저장 불가 환경은 무시 */ }
}

/** JSON 파일 내보내기. 공유 링크와 같은 페이로드 형식(비압축) */
export const exportJson = (state: DesignState, name?: string): string =>
  JSON.stringify({ v: 1, app: SHARE_VERSION, name, state } satisfies SharePayload & { name?: string }, null, 2);

/** JSON 가져오기: 페이로드·보관함 항목·맨 상태 어느 것이든 받는다. 형태가 아니면 null */
export function parseImport(text: string): { state: DesignState; name?: string } | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    const st = (raw?.state ?? raw) as Partial<DesignState> | undefined;
    if (!st || typeof st !== "object" || !("profile" in st) || !("blocks" in st)) return null;
    return { state: reducer(initialState(), { type: "load", state: st as DesignState }), name: typeof raw.name === "string" ? raw.name : undefined };
  } catch {
    return null;
  }
}

/** 브라우저에서 파일로 저장(JSON·CSV) */
export function downloadJson(filename: string, text: string, type = "application/json"): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
