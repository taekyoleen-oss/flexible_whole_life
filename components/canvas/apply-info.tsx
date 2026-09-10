"use client";
import { useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button } from "@/components/ui";
import { PRESETS } from "@/lib/engine";
import { won } from "@/lib/format";
import { recommend } from "@/lib/recommend";
import { STANDARD_BOUNDARY, type InfoApplied } from "@/lib/state";

const LABEL: Record<keyof InfoApplied, string> = { child: "자녀 독립", debt: "부채 만기", group: "단체보험 만기", retire: "은퇴 연령" };

/** 프리셋 카드에 "입력 반영: 자녀·부채" 칩 */
export function AppliedChips() {
  const { state } = useDesign();
  const on = (Object.keys(LABEL) as (keyof InfoApplied)[]).filter((k) => state.infoApplied[k]);
  if (on.length === 0) return <span className="rounded bg-navy/5 px-2 py-0.5 text-navy/60">표준 경계</span>;
  return <span className="rounded bg-sky/10 px-2 py-0.5 text-navy">입력 반영: {on.map((k) => LABEL[k]).join("·")}</span>;
}

/**
 * "입력 정보 반영" 버튼 + 팝업. 설계는 기준보험금 1억·표준 프리셋으로 시작하고,
 * 입력 화면의 정보(자녀 나이·부채·단체보험·은퇴)와 니즈·HLV 금액은 여기서 체크한 항목만 적용한다.
 */
export function ApplyInfoButton() {
  const { state, dispatch } = useDesign();
  const dlg = useRef<HTMLDialogElement>(null);
  const p = state.profile, a = state.settings.assumption;
  const r = recommend(state);
  const [flags, setFlags] = useState<InfoApplied>(state.infoApplied);
  const [amount, setAmount] = useState<"keep" | "needs" | "hlv">("keep");
  const [usePreset, setUsePreset] = useState(false);
  const youngest = p.childrenAges.length ? Math.min(...p.childrenAges) : null;
  const rows: { key: keyof InfoApplied; text: string; available: boolean; standard: string }[] = [
    { key: "child", available: youngest !== null, text: youngest !== null ? `막내 ${youngest}세 → 독립 ${a.needs.independenceAge}세 = ${p.age + a.needs.independenceAge - youngest}세부터 30%` : "자녀 정보 없음", standard: `표준: 가입 ${a.needs.independenceAge - STANDARD_BOUNDARY.youngestChildAge}년 후(${p.age + a.needs.independenceAge - STANDARD_BOUNDARY.youngestChildAge}세)` },
    { key: "debt", available: p.debt > 0, text: p.debt > 0 ? `부채 ${won(p.debt)} · 만기 ${p.debtYears}년 → ${p.age + p.debtYears}세까지 감액` : "부채 없음", standard: `표준: 가입 ${STANDARD_BOUNDARY.debtYears}년 후(${p.age + STANDARD_BOUNDARY.debtYears}세)` },
    { key: "group", available: p.groupCover > 0, text: p.groupCover > 0 ? `단체보험 ${won(p.groupCover)} · 만기 ${p.groupCoverEndAge}세` : "단체보험 없음", standard: `표준: ${STANDARD_BOUNDARY.groupCoverEndAge}세` },
    { key: "retire", available: true, text: `은퇴 예정 ${p.retirementAge}세`, standard: `표준: ${STANDARD_BOUNDARY.retirementAge}세` },
  ];
  const open = () => { setFlags(state.infoApplied); setAmount("keep"); setUsePreset(false); dlg.current?.showModal(); };
  const apply = () => {
    dispatch({ type: "applyInfo", applied: flags, S0: amount === "needs" ? r.suggestedS0 : amount === "hlv" ? r.hlvS0 : undefined, presetId: usePreset ? r.presetId : undefined });
    dlg.current?.close();
  };
  return (
    <>
      <Button onClick={open}>입력 정보 반영</Button>
      <dialog ref={dlg} className="m-auto w-[min(92vw,600px)] rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <h3 className="font-display text-lg text-navy">입력 정보 반영</h3>
        <p className="mt-1 text-xs text-navy/60">설계는 기준보험금 {won(state.S0)}과 표준 경계의 프리셋으로 그려져 있습니다. 아래에서 체크한 항목만 현재 입력값으로 바뀝니다.</p>

        <h4 className="mt-4 text-sm font-medium text-navy">프리셋 경계</h4>
        <ul className="mt-1 space-y-1 text-sm">
          {rows.map((x) => (
            <li key={x.key} className="flex items-start gap-2">
              <input id={`ai-${x.key}`} type="checkbox" className="mt-1 accent-sky" disabled={!x.available} checked={flags[x.key]} onChange={(e) => setFlags({ ...flags, [x.key]: e.target.checked })} />
              <label htmlFor={`ai-${x.key}`} className={x.available ? "" : "text-navy/40"}><span className="font-medium">{LABEL[x.key]}</span> · {x.text}<span className="ml-2 text-xs text-navy/50">{x.standard}</span></label>
            </li>
          ))}
        </ul>

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
