"use client";
import { useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button } from "@/components/ui";
import { PRESETS } from "@/lib/engine";
import { won } from "@/lib/format";
import { recommend } from "@/lib/recommend";

/**
 * "기준보험금·추천 반영" 버튼 + 팝업. 설계는 기준보험금 1억으로 시작하고, 니즈·HLV 금액과 추천 프리셋은 여기서 골라 적용한다.
 * 프리셋 경계(자녀·부채·단체·은퇴)는 프리셋 카드의 체크박스로 반영한다.
 */
export function ApplyInfoButton() {
  const { state, dispatch } = useDesign();
  const dlg = useRef<HTMLDialogElement>(null);
  const r = recommend(state);
  const [amount, setAmount] = useState<"keep" | "needs" | "hlv">("keep");
  const [usePreset, setUsePreset] = useState(false);
  const open = () => { setAmount("keep"); setUsePreset(false); dlg.current?.showModal(); };
  const apply = () => {
    dispatch({ type: "applyInfo", applied: {}, S0: amount === "needs" ? r.suggestedS0 : amount === "hlv" ? r.hlvS0 : undefined, presetId: usePreset ? r.presetId : undefined });
    dlg.current?.close();
  };
  return (
    <>
      <Button onClick={open}>기준보험금·추천 반영</Button>
      <dialog ref={dlg} className="m-auto w-[min(92vw,600px)] rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <h3 className="font-display text-lg text-navy">기준보험금·추천 반영</h3>
        <p className="mt-1 text-xs text-navy/60">현재 기준보험금은 {won(state.S0)}입니다. 입력 화면의 재무 정보로 계산한 후보를 골라 적용합니다. 프리셋 경계(자녀·부채·단체보험·은퇴)는 프리셋 카드에서 체크합니다.</p>

        <h4 className="mt-4 text-sm font-medium text-navy">기준보험금</h4>
        <ul className="mt-1 space-y-1 text-sm">
          {([["keep", `유지 (${won(state.S0)})`], ["needs", `필요보장(니즈) ${won(r.suggestedS0)}`], ["hlv", `인적자본(HLV) ${won(r.hlvS0)}`]] as const).map(([k, t]) => (
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
