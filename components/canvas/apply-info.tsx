"use client";
import { useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button } from "@/components/ui";
import { PRESETS } from "@/lib/engine";
import { won } from "@/lib/format";
import { boundaryLabel } from "@/lib/preset-info";
import { recommend } from "@/lib/recommend";
import type { InfoApplied } from "@/lib/state";

const BOUNDARIES: { key: keyof InfoApplied; label: string }[] = [
  { key: "child", label: "자녀 독립" }, { key: "debt", label: "부채 만기" }, { key: "group", label: "단체보험 만기" }, { key: "retire", label: "은퇴 연령" },
];

/**
 * "입력 정보 반영" 버튼 + 팝업. 설계는 기준보험금 1억·표준 경계로 시작하고, 입력 화면의 정보는 여기서 체크한 항목만 적용한다.
 * 열 때 반영 가능한 항목을 모두 체크해 두므로 "적용"만 누르면 전체가 반영되고, 적용 결과는 프리셋 카드의 체크박스와 입력 요약의 반영/미반영 표시에 그대로 나타난다.
 */
export function ApplyInfoButton({ label = "입력 정보 반영" }: { label?: string }) {
  const { state, dispatch } = useDesign();
  const dlg = useRef<HTMLDialogElement>(null);
  const r = recommend(state);
  const rows = BOUNDARIES.map((b) => ({ ...b, ...boundaryLabel(b.key, state) }));
  const [flags, setFlags] = useState<Partial<InfoApplied>>({});
  const [amount, setAmount] = useState<"keep" | "needs" | "hlv">("needs");
  const [usePreset, setUsePreset] = useState(true);
  const open = () => {
    setFlags(Object.fromEntries(rows.map((x) => [x.key, x.available])));   // 반영할 수 있는 항목은 모두 체크
    setAmount(state.infoApplied.income ? "keep" : "needs");
    setUsePreset(state.presetId !== r.presetId);
    dlg.current?.showModal();
  };
  const apply = () => {
    dispatch({ type: "applyInfo", applied: flags, S0: amount === "needs" ? r.suggestedS0 : amount === "hlv" ? r.hlvS0 : undefined, presetId: usePreset ? r.presetId : undefined });
    dlg.current?.close();
  };
  return (
    <>
      <Button primary onClick={open}>{label}</Button>
      <dialog ref={dlg} className="m-auto w-[min(92vw,600px)] rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <h3 className="font-display text-lg text-navy">입력 정보 반영</h3>
        <p className="mt-1 text-xs text-navy/60">체크한 항목이 설계에 반영됩니다. 반영한 항목은 프리셋 카드의 체크박스와 입력 요약에 &quot;반영&quot;으로 표시되고, 입력을 바꾸면 따라갑니다.</p>

        <h4 className="mt-4 text-sm font-medium text-navy">프리셋 경계</h4>
        <ul className="mt-1 space-y-1 text-sm">
          {rows.map((x) => (
            <li key={x.key} className="flex items-start gap-2">
              <input id={`ai-${x.key}`} type="checkbox" className="mt-1 accent-sky" disabled={!x.available} checked={!!flags[x.key]} onChange={(e) => setFlags({ ...flags, [x.key]: e.target.checked })} />
              <label htmlFor={`ai-${x.key}`} className={x.available ? "" : "text-navy/40"}><span className="font-medium">{x.label}</span> · {x.text}</label>
            </li>
          ))}
        </ul>

        <h4 className="mt-4 text-sm font-medium text-navy">기준보험금 (연소득·기존 보장 반영)</h4>
        <ul className="mt-1 space-y-1 text-sm">
          {([["needs", `필요보장(니즈) ${won(r.suggestedS0)}`], ["hlv", `인적자본(HLV) ${won(r.hlvS0)}`], ["keep", `유지 (${won(state.S0)})`]] as const).map(([k, t]) => (
            <li key={k} className="flex items-center gap-2"><input id={`ai-amt-${k}`} type="radio" name="ai-amount" className="accent-sky" checked={amount === k} onChange={() => setAmount(k)} /><label htmlFor={`ai-amt-${k}`}>{t}</label></li>
          ))}
        </ul>

        <h4 className="mt-4 text-sm font-medium text-navy">프리셋</h4>
        <label className="mt-1 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-sky" checked={usePreset} onChange={(e) => setUsePreset(e.target.checked)} /><span>추천 프리셋 적용 · <span className="font-medium">{PRESETS[r.presetId].label}</span> <span className="text-xs text-navy/60">{r.reason}</span></span></label>

        <div className="mt-5 flex justify-end gap-2"><Button onClick={() => dlg.current?.close()}>취소</Button><Button primary onClick={apply}>적용</Button></div>
      </dialog>
    </>
  );
}
