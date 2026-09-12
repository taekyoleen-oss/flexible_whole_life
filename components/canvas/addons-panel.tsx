"use client";
import { useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { FormulaHelp } from "@/components/formula-help";
import { Button, Field, ManwonInput, NumInput, Select, onBackdropClick } from "@/components/ui";
import { ADDON_LABEL, addonCurve, addonLabel, type Addon, type AddonKind } from "@/lib/engine";
import { won } from "@/lib/format";
import { assumptionOf } from "@/lib/state";

export const ADDON_COLORS = ["#c2704a", "#2a9d8f", "#8e44ad", "#d4a017", "#e76f51"];

/** 추가 조건 목록 + "추가" 팝업. 각 항목은 그래프에 별도 선으로 보이고 "결합"하면 기본 스케줄에 더해진다 */
export function AddonsPanel() {
  const { state, dispatch, result } = useDesign();
  const dlg = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<AddonKind>("education");
  const [amount, setAmount] = useState(1e8);
  const [years, setYears] = useState(10);
  const [childAge, setChildAge] = useState(10);
  const indep = assumptionOf(state).needs.independenceAge;
  const add = () => {
    dispatch({ type: "addAddon", addon: { id: String(Date.now()), kind, amount, years, childAge: kind === "education" ? childAge : undefined } });
    dlg.current?.close();
  };
  const preview = addonCurve({ id: "p", kind, amount, years, childAge }, result.n, indep);
  return (
    <div className="mt-3 rounded border border-navy/10 bg-cream p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-navy">추가 조건 <FormulaHelp id="addons" /> <span className="font-normal text-navy/60">· 프리셋 위에 자녀교육·대출상환 등을 별도 선으로 얹고, 결합하면 기본 그래프에 더해집니다</span></div>
        <Button onClick={() => dlg.current?.showModal()}>+ 추가 조건</Button>
      </div>
      {state.addons.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {state.addons.map((a, i) => {
            const c = addonCurve(a, result.n, indep);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="inline-block h-2 w-4 rounded" style={{ background: ADDON_COLORS[i % ADDON_COLORS.length] }} />
                <span className="font-medium text-navy">{addonLabel(a)}</span>
                <span className="text-xs text-navy/60">{ADDON_LABEL[a.kind]} · 최초 {won(c[0])} → {a.kind === "fixed" ? `${a.years}년간 정액` : `${Math.max(0, c.findIndex((v) => v <= 0))}년 뒤 0`}</span>
                <span className="ml-auto flex gap-1">
                  <Button onClick={() => { if (confirm(`"${addonLabel(a)}"을(를) 기본 그래프에 더합니다. 기준보험금이 3배 상한을 넘으면 올라가고, 설계 규칙(초기 고정·매년 1칸)에 맞춰집니다.`)) dispatch({ type: "mergeAddon", id: a.id }); }}>결합</Button>
                  <Button onClick={() => dispatch({ type: "removeAddon", id: a.id })}>삭제</Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <dialog ref={dlg} className="m-auto w-[min(92vw,520px)] whitespace-normal rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50" onClick={onBackdropClick}>
        <h3 className="font-display text-lg text-navy">추가 조건</h3>
        <p className="mt-1 text-xs text-navy/60">자녀교육: 1인당 최초 금액이 독립({indep}세)까지 매년 줄어듭니다. 대출상환: 대출금이 상환기간 동안 지금부터 직선으로 줄어듭니다. 정액: 기간 동안 같은 금액.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="종류"><Select value={kind} onChange={(e) => setKind(e.target.value as AddonKind)}>{(Object.keys(ADDON_LABEL) as AddonKind[]).map((k) => <option key={k} value={k}>{ADDON_LABEL[k]}</option>)}</Select></Field>
          <Field label={kind === "education" ? "자녀 1인당 최초 금액" : kind === "loan" ? "대출금" : "보장 금액"}><ManwonInput value={amount} onChange={setAmount} min={100} max={1e6} step={100} /></Field>
          {kind === "education"
            ? <Field label="자녀 나이" hint={`독립까지 ${Math.max(0, indep - childAge)}년 동안 감소`}><div className="flex items-center gap-1"><NumInput value={childAge} min={0} max={indep} onCommit={(v) => setChildAge(Math.round(v))} /><span className="text-sm text-navy/60">세</span></div></Field>
            : <Field label={kind === "loan" ? "상환기간 (년)" : "보장 기간 (년)"}><NumInput value={years} min={1} max={60} onCommit={(v) => setYears(Math.round(v))} /></Field>}
        </div>
        <p className="mt-3 text-xs text-navy/60">미리보기: 지금 {won(preview[0])} → 5년 뒤 {won(preview[Math.min(5, result.n - 1)])} → 10년 뒤 {won(preview[Math.min(10, result.n - 1)])}</p>
        <div className="mt-4 flex justify-end gap-2"><Button onClick={() => dlg.current?.close()}>닫기</Button><Button primary onClick={add}>추가</Button></div>
      </dialog>
    </div>
  );
}
