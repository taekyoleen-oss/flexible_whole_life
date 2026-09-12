"use client";
import { useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { FormulaHelp } from "@/components/formula-help";
import { Button, Field, MillionInput, NumInput, Select, onBackdropClick } from "@/components/ui";
import { ADDON_LABEL, addonCurve, addonLabel, addonShape, type Addon, type AddonKind } from "@/lib/engine";
import { won } from "@/lib/format";
import { assumptionOf, canUnmerge, envelopeOf } from "@/lib/state";

export const ADDON_COLORS = ["#c2704a", "#2a9d8f", "#8e44ad", "#d4a017", "#e76f51"];

/** 추가 조건 목록 + "추가" 팝업. 각 항목은 그래프에 별도 선으로 보이고 "결합"하면 기본 스케줄에 더해진다 */
export function AddonsPanel() {
  const { state, dispatch, result } = useDesign();
  const dlg = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<AddonKind>("education");
  const [amount, setAmount] = useState(1e8);
  const [years, setYears] = useState(10);
  const [childAge, setChildAge] = useState(10);
  const indep = assumptionOf(state).needs.independenceAge, fix = envelopeOf(state).fixYears;
  const add = () => {
    dispatch({ type: "addAddon", addon: { id: String(Date.now()), kind, amount, years, childAge: kind === "education" ? childAge : undefined } });
    dlg.current?.close();
  };
  const draft: Addon = { id: "p", kind, amount, years, childAge };
  const preview = addonCurve(draft, result.n, indep, fix);
  return (
    <div className="mt-3 rounded border border-navy/10 bg-cream p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-navy">추가 조건 <FormulaHelp id="addons" /> <span className="font-normal text-navy/60">· 프리셋 위에 자녀교육·대출상환 등을 별도 선으로 얹고, 결합하면 기본 그래프에 더해집니다</span></div>
        <Button onClick={() => dlg.current?.showModal()}>+ 추가 조건</Button>
      </div>
      {state.addons.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {state.addons.map((a, i) => {
            const c = addonCurve(a, result.n, indep, fix);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="inline-block h-2 w-4 rounded" style={{ background: ADDON_COLORS[i % ADDON_COLORS.length], opacity: a.merged ? 0.35 : 1 }} />
                <span className="font-medium text-navy">{addonLabel(a)}</span>
                <span className="text-xs text-navy/60">{ADDON_LABEL[a.kind]} · 최초 {won(c[0])} · {addonShape(a, indep, fix)}</span>
                {a.merged && <span className="rounded bg-sky/10 px-1.5 text-xs text-sky">결합됨</span>}
                <span className="ml-auto flex gap-1">
                  {a.merged
                    ? <Button disabled={!canUnmerge(state, a)} title={canUnmerge(state, a) ? "결합 전 그래프로 되돌립니다" : "결합 뒤 그래프나 기준보험금을 바꿔 분리할 수 없습니다(되돌리기로만 취소 가능)"} onClick={() => dispatch({ type: "unmergeAddon", id: a.id })}>분리</Button>
                    : <Button onClick={() => { if (confirm(`"${addonLabel(a)}"을(를) 기본 그래프에 더합니다. 기준보험금이 3배 상한을 넘으면 올라가고, 설계 규칙(초기 고정·매년 1칸)에 맞춰집니다. 그래프를 바꾸기 전까지는 "분리"로 되돌릴 수 있습니다.`)) dispatch({ type: "mergeAddon", id: a.id }); }}>결합</Button>}
                  <Button onClick={() => dispatch({ type: "removeAddon", id: a.id })} title={a.merged ? "결합 기록만 지웁니다(그래프는 그대로)" : "항목을 지웁니다"}>삭제</Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <dialog ref={dlg} className="m-auto w-[min(92vw,520px)] whitespace-normal rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50" onClick={onBackdropClick}>
        <h3 className="font-display text-lg text-navy">추가 조건</h3>
        <p className="mt-1 text-xs text-navy/60">자녀교육: 1인당 최초 금액이 독립({indep}세)까지 매년 줄어듭니다. 대출상환: 초기 {fix}년(E01 고정 구간)은 대출금 정액, {fix + 1}년째부터 만기까지 직선으로 줄어듭니다. 정액: 기간 동안 같은 금액.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="종류"><Select value={kind} onChange={(e) => setKind(e.target.value as AddonKind)}>{(Object.keys(ADDON_LABEL) as AddonKind[]).map((k) => <option key={k} value={k}>{ADDON_LABEL[k]}</option>)}</Select></Field>
          <Field label={kind === "education" ? "자녀 1인당 최초 금액" : kind === "loan" ? "대출금" : "보장 금액"}><MillionInput value={amount} onChange={setAmount} min={1} max={1e4} step={1} /></Field>
          {kind === "education"
            ? <Field label="자녀 나이" hint={`독립까지 ${Math.max(0, indep - childAge)}년 동안 감소`}><div className="flex items-center gap-1"><NumInput value={childAge} min={0} max={indep} onCommit={(v) => setChildAge(Math.round(v))} /><span className="text-sm text-navy/60">세</span></div></Field>
            : <Field label={kind === "loan" ? "상환기간 (년)" : "보장 기간 (년)"} hint={kind === "loan" ? `1~${Math.min(fix, years)}년 정액${years > fix ? `, ${fix + 1}~${years}년 감액` : ""}` : undefined}><NumInput value={years} min={1} max={60} onCommit={(v) => setYears(Math.round(v))} /></Field>}
        </div>
        <p className="mt-3 text-xs text-navy/60">{addonShape(draft, indep, fix)} · 미리보기: 지금 {won(preview[0])} → 5년 뒤 {won(preview[Math.min(5, result.n - 1)])} → 10년 뒤 {won(preview[Math.min(10, result.n - 1)])}</p>
        <div className="mt-4 flex justify-end gap-2"><Button onClick={() => dlg.current?.close()}>닫기</Button><Button primary onClick={add}>추가</Button></div>
      </dialog>
    </div>
  );
}
