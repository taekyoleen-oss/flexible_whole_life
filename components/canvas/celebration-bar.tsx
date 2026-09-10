"use client";
import { useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, NumInput } from "@/components/ui";
import { won } from "@/lib/format";
import { CELEBRATION_RATIO, celebrations, endAgeOf } from "@/lib/state";

/** 축하금은 나이만 고른다. 금액은 해당 연령 사망보험금의 10%로 리듀서가 정한다. */
export function CelebrationBar() {
  const { state, dispatch } = useDesign();
  const x0 = state.profile.age, endAge = endAgeOf(state.profile);
  const [age, setAge] = useState(Math.min(x0 + 25, endAge));
  const cels = celebrations(state.blocks);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-navy/70">축하금 (해당 연령 보험금의 {CELEBRATION_RATIO * 100}%)</span>
      <div className="w-20"><NumInput value={age} min={x0} max={endAge + 1} onCommit={(v) => setAge(Math.min(endAge + 1, Math.max(x0, Math.round(v))))} /></div>
      <span className="text-navy/60">세 (경과 {age - x0}년)</span>
      <Button onClick={() => dispatch({ type: "addCelebration", age })} disabled={cels.some((c) => c.fromAge === age)}>추가</Button>
      {cels.map((c, i) => (
        <span key={c.fromAge} className="inline-flex items-center gap-1 rounded-full bg-sky/10 px-2 py-0.5 text-xs text-navy">
          {c.fromAge}세 · {won(c.multiple * state.S0)}
          <button type="button" aria-label={`${c.fromAge}세 축하금 삭제`} className="ml-1 text-navy/50 hover:text-red-600" onClick={() => dispatch({ type: "removeCelebration", index: i })}>×</button>
        </span>
      ))}
    </div>
  );
}
