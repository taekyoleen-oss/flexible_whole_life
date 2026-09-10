"use client";
import { useDesign } from "@/components/design-provider";
import { Button, NumInput } from "@/components/ui";
import { FIX_YEARS } from "@/lib/engine";
import { won } from "@/lib/format";
import { celebrations, deathSegments, endAgeOf } from "@/lib/state";

export function BlockCards() {
  const { state, dispatch, violations } = useDesign();
  const age = state.profile.age, endAge = endAgeOf(state.profile);
  const segs = deathSegments(state.blocks), cels = celebrations(state.blocks);
  const yearsOf = (codes: string[]) => new Set(violations.flatMap((v) => (v.year === undefined || !codes.includes(v.code) ? [] : [age + v.year])));
  const badSeg = yearsOf(["E01", "E02", "E03"]);
  const badCel = yearsOf(["E08"]);
  const isBad = (from: number, to: number) => [...badSeg].some((a) => a >= from && a <= to);

  return (
    <details open={state.presetId === "custom"} className="rounded-lg border border-navy/10 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer font-display text-lg text-navy">구간 카드 편집</summary>
      <p className="mt-1 text-xs text-navy/50">초기 {FIX_YEARS}년({age}~{age + FIX_YEARS - 1}세)은 고정, 증액은 연 20% 이내·70세 전까지.</p>

      <ul className="mt-3 space-y-2">
        {segs.map((b, i) => {
          const last = i === segs.length - 1;
          const tone = isBad(b.fromAge, b.toAge) ? "border-red-300 bg-red-50" : b.fromAge < age + FIX_YEARS ? "border-navy/10 bg-sky/5" : "border-navy/10";
          return (
            <li key={`${b.fromAge}-${i}`} className={`grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded border p-2 text-sm ${tone}`}>
              <span className="font-mono text-navy/70">{b.fromAge}세 ~</span>
              {last ? <span className="font-mono text-navy/70">{b.toAge}세 (최종)</span>
                    : <NumInput value={b.toAge} min={b.fromAge} max={endAge - 1} onCommit={(n) => dispatch({ type: "segment", index: i, patch: { toAge: n } })} />}
              <div className="flex items-center gap-1">
                <NumInput value={b.multiple} min={0} max={10} step={0.1} onCommit={(n) => dispatch({ type: "segment", index: i, patch: { multiple: n } })} />
                <span className="shrink-0 text-xs text-navy/60">배 = {won(b.multiple * state.S0)}</span>
              </div>
              <div className="flex gap-1">
                <Button onClick={() => dispatch({ type: "splitSegment", index: i })} disabled={b.toAge - b.fromAge < 1}>분할</Button>
                <Button onClick={() => dispatch({ type: "removeSegment", index: i })} disabled={segs.length < 2}>삭제</Button>
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-4 text-sm font-medium text-navy">축하금 (생존급부)</h3>
      <ul className="mt-2 space-y-2">
        {cels.map((c, i) => (
          <li key={i} className={`grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded border p-2 text-sm ${badCel.has(c.fromAge) ? "border-red-300 bg-red-50" : "border-navy/10"}`}>
            <div className="flex items-center gap-1"><NumInput value={c.fromAge} min={age} max={endAge + 1} onCommit={(n) => dispatch({ type: "celebration", index: i, patch: { fromAge: n } })} /><span className="text-xs text-navy/60">세</span></div>
            <div className="flex items-center gap-1"><NumInput value={c.multiple} min={0} max={10} step={0.05} onCommit={(n) => dispatch({ type: "celebration", index: i, patch: { multiple: n } })} /><span className="shrink-0 text-xs text-navy/60">배 = {won(c.multiple * state.S0)}</span></div>
            <Button onClick={() => dispatch({ type: "removeCelebration", index: i })}>삭제</Button>
          </li>
        ))}
      </ul>
      <Button className="mt-2" onClick={() => dispatch({ type: "addCelebration", age: Math.min(age + 10, endAge), multiple: 0.1 })}>+ 축하금 추가</Button>
    </details>
  );
}
