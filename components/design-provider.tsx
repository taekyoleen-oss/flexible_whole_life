"use client";
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from "react";
import { validate, type EngineResult, type Violation } from "@/lib/engine";
import { DEFAULT_STATE, envelopeOf, evaluate, reducer, STORAGE_KEY, type Action, type DesignState } from "@/lib/state";

const HISTORY = 30;
type Hist = { present: DesignState; past: DesignState[]; dragBase?: unknown };
type HistAction = Action | { type: "undo" };
/** 편집 실수를 되돌릴 수 있게 직전 상태를 쌓아 둔다(복원·로드는 제외). 한 번의 드래그(같은 base)는 한 단계로 묶는다 */
function histReducer(h: Hist, a: HistAction): Hist {
  if (a.type === "undo") return h.past.length ? { present: h.past[h.past.length - 1], past: h.past.slice(0, -1) } : h;
  const present = reducer(h.present, a);
  if (present === h.present) return h;
  if (a.type === "load") return { present, past: [] };
  const dragBase = a.type === "level" ? a.base : undefined;
  if (dragBase && dragBase === h.dragBase) return { present, past: h.past, dragBase };   // 드래그 중 중간 상태는 쌓지 않는다
  return { present, past: [...h.past.slice(-(HISTORY - 1)), h.present], dragBase };
}

export interface DesignCtx {
  state: DesignState;
  dispatch: Dispatch<HistAction>;
  result: EngineResult;
  violations: Violation[];
  loaded: boolean;   // localStorage 복원이 끝났는지
  undo: () => void;
  canUndo: boolean;
}

const Ctx = createContext<DesignCtx | null>(null);

function loadSaved(): DesignState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as DesignState;
    return s.version === 1 ? s : null;
  } catch {
    return null;
  }
}

/** initial이 있으면 그 상태로 시작하고 localStorage를 읽지 않는다(공유 뷰). persist=false면 저장하지 않는다 */
export function DesignProvider({ children, initial, persist = true }: { children: ReactNode; initial?: DesignState; persist?: boolean }) {
  const [hist, dispatch] = useReducer(histReducer, { present: initial ?? DEFAULT_STATE, past: [] });
  const state = hist.present;
  const [loaded, setLoaded] = useState(!!initial);

  useEffect(() => {
    if (initial) return;
    const saved = loadSaved();
    if (saved) dispatch({ type: "load", state: saved });
    setLoaded(true);
  }, [initial]);

  useEffect(() => {
    if (!loaded || !persist) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* 저장 불가 환경은 무시 */ }
  }, [state, loaded, persist]);

  const value = useMemo<DesignCtx>(() => {
    const result = evaluate(state);
    const violations = validate(result.S, result.C,
      { S0: state.S0, age: state.profile.age, n: result.n, payYears: state.payYears, freq: 12, grossUnit: result.perUnit.gross },
      envelopeOf(state));
    return { state, dispatch, result, violations, loaded, undo: () => dispatch({ type: "undo" }), canUndo: hist.past.length > 0 };
  }, [state, loaded, hist.past.length]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDesign(): DesignCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDesign must be used inside DesignProvider");
  return c;
}
