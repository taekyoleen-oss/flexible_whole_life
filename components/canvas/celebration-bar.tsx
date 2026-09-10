"use client";
import { useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, NumInput } from "@/components/ui";
import { won } from "@/lib/format";
import { CELEBRATION_RATIO, celebrations, endAgeOf } from "@/lib/state";

/** 축하금은 나이만 고른다. 금액은 해당 연령 사망보험금의 10%로 리듀서가 정한다. 여러 나이에 각각 둘 수 있다. */
export function CelebrationBar() {
  const { state, dispatch } = useDesign();
  const x0 = state.profile.age, endAge = endAgeOf(state.profile), last = endAge + 1;
  const cels = celebrations(state.blocks);
  const taken = new Set(cels.map((c) => c.fromAge));
  const nextFree = (from: number) => { let a = from; while (a <= last && taken.has(a)) a++; return Math.min(a, last); };
  const [age, setAge] = useState(nextFree(Math.min(x0 + 25, endAge)));
  const [every, setEvery] = useState(5);
  const clampAge = (v: number) => Math.min(last, Math.max(x0, Math.round(v)));

  const addOne = () => { dispatch({ type: "addCelebration", age }); setAge(nextFree(age + every)); };
  const addSeries = () => {
    for (let a = age; a <= last; a += every) dispatch({ type: "addCelebration", age: a });
    setAge(nextFree(age));
  };

  return (
    <div className="mt-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-navy/70">축하금 (해당 연령 보험금의 {CELEBRATION_RATIO * 100}%)</span>
        <div className="w-20"><NumInput value={age} min={x0} max={last} onCommit={(v) => setAge(clampAge(v))} /></div>
        <span className="text-navy/60">세 (경과 {age - x0}년)</span>
        <Button onClick={addOne} disabled={taken.has(age)}>추가</Button>
        <span className="text-navy/60">·</span>
        <span className="text-navy/60">매</span>
        <div className="w-16"><NumInput value={every} min={1} max={30} onCommit={(v) => setEvery(Math.min(30, Math.max(1, Math.round(v))))} /></div>
        <span className="text-navy/60">년마다</span>
        <Button onClick={addSeries}>{age}세부터 반복 추가</Button>
        {cels.length > 0 && <Button onClick={() => cels.forEach(() => dispatch({ type: "removeCelebration", index: 0 }))}>모두 삭제</Button>}
      </div>
      {cels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {cels.map((c, i) => (
            <span key={c.fromAge} className="inline-flex items-center gap-1 rounded-full bg-sky/10 px-2 py-0.5 text-xs text-navy">
              {c.fromAge}세 · {won(c.multiple * state.S0)}
              <button type="button" aria-label={`${c.fromAge}세 축하금 삭제`} className="ml-1 text-navy/50 hover:text-red-600" onClick={() => dispatch({ type: "removeCelebration", index: i })}>×</button>
            </span>
          ))}
          <span className="text-xs text-navy/50">{cels.length}건 · 합계 {won(cels.reduce((s, c) => s + c.multiple, 0) * state.S0)}</span>
        </div>
      )}
    </div>
  );
}
