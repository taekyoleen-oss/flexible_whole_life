"use client";
import { useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, Input } from "@/components/ui";
import { won } from "@/lib/format";
import { CELEBRATION_RATIO, celebrations, endAgeOf, parseAgeList } from "@/lib/state";

/** 축하금은 나이만 고른다(여러 개 가능, 예: 55, 65). 금액은 해당 연령 사망보험금의 10%로 리듀서가 정한다. */
export function CelebrationBar() {
  const { state, dispatch } = useDesign();
  const x0 = state.profile.age, last = endAgeOf(state.profile) + 1;
  const cels = celebrations(state.blocks);
  const [text, setText] = useState("");
  const ages = parseAgeList(text, x0, last).filter((a) => !cels.some((c) => c.fromAge === a));
  const add = () => { for (const a of ages) dispatch({ type: "addCelebration", age: a }); setText(""); };

  return (
    <div className="mt-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-navy/70">축하금 (해당 연령 보험금의 {CELEBRATION_RATIO * 100}%)</span>
        <div className="w-44">
          <Input value={text} placeholder="예: 55, 65" inputMode="numeric" onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && ages.length) add(); }} aria-label="축하금 받을 나이(쉼표로 구분)" />
        </div>
        <span className="text-navy/60">세 ({x0}~{last}세, 쉼표로 여러 개)</span>
        <Button onClick={add} disabled={ages.length === 0}>{ages.length > 1 ? `${ages.length}개 추가` : "추가"}</Button>
        {cels.length > 0 && <Button onClick={() => cels.forEach(() => dispatch({ type: "removeCelebration", index: 0 }))}>모두 삭제</Button>}
      </div>
      {cels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {cels.map((c, i) => (
            <span key={c.fromAge} className="inline-flex items-center gap-1 rounded-full bg-sky/10 px-2 py-0.5 text-xs text-navy">
              {c.fromAge}세 (경과 {c.fromAge - x0}년) · {won(c.multiple * state.S0)}
              <button type="button" aria-label={`${c.fromAge}세 축하금 삭제`} className="ml-1 text-navy/50 hover:text-red-600" onClick={() => dispatch({ type: "removeCelebration", index: i })}>×</button>
            </span>
          ))}
          <span className="text-xs text-navy/50">{cels.length}건 · 합계 {won(cels.reduce((s, c) => s + c.multiple, 0) * state.S0)}</span>
        </div>
      )}
    </div>
  );
}
