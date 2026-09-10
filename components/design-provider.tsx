"use client";
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from "react";
import { validate, type EngineResult, type Violation } from "@/lib/engine";
import { DEFAULT_STATE, envelopeOf, evaluate, reducer, STORAGE_KEY, type Action, type DesignState } from "@/lib/state";

export interface DesignCtx {
  state: DesignState;
  dispatch: Dispatch<Action>;
  result: EngineResult;
  violations: Violation[];
  loaded: boolean;   // localStorage 복원이 끝났는지
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
  const [state, dispatch] = useReducer(reducer, initial ?? DEFAULT_STATE);
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
    return { state, dispatch, result, violations, loaded };
  }, [state, loaded]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDesign(): DesignCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDesign must be used inside DesignProvider");
  return c;
}
