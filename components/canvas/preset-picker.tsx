"use client";
import { useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { HelpPopup } from "@/components/help-popup";
import { Button, Card, Field, Input, ManwonInput, NumInput } from "@/components/ui";
import { PRESETS, type PresetId } from "@/lib/engine";
import { boundaryLabel, PRESET_INFO, RETIRE_OPTIONS } from "@/lib/preset-info";
import { recommend } from "@/lib/recommend";
import { parseAgeList, STANDARD_BOUNDARY } from "@/lib/state";
import { FinanceButton } from "./apply-info";

const smallBtn = "rounded border border-navy/20 px-1.5 py-0.5 text-xs text-navy hover:bg-navy/5";

/** 평준형: 연소득 반영 체크(니즈 기준보험금) + 재무 정보 팝업 */
function IncomeControl() {
  const { state, dispatch } = useDesign();
  const b = boundaryLabel("income", state);
  return (
    <>
      <label className="flex flex-1 items-center gap-1" title={b.text}>
        <input type="checkbox" className="accent-sky" disabled={!b.available} checked={state.infoApplied.income}
          onChange={(e) => e.target.checked ? dispatch({ type: "applyInfo", applied: {}, S0: recommend(state).suggestedS0 }) : dispatch({ type: "S0", S0: 1e8 })} />
        <span>연소득 반영</span>
      </label>
      <FinanceButton compact />
    </>
  );
}

/** 자녀연령형: 체크 + 나이 입력(쉼표) */
function ChildControl() {
  const { state, dispatch } = useDesign();
  const p = state.profile;
  const b = boundaryLabel("child", state);
  return (
    <label className="flex flex-1 items-center gap-1" title={b.text}>
      <input type="checkbox" className="accent-sky" disabled={!b.available} checked={state.infoApplied.child} onChange={(e) => dispatch({ type: "applyInfo", applied: { child: e.target.checked } })} />
      <span className="shrink-0">자녀</span>
      <Input key={p.childrenAges.join()} defaultValue={p.childrenAges.join(", ")} placeholder="3, 6" inputMode="numeric" className="min-w-0 !px-1 !py-0.5 !text-xs" aria-label="자녀 나이"
        onBlur={(e) => { const a = parseAgeList(e.target.value, 0, 40); e.target.value = a.join(", "); dispatch({ type: "profile", patch: { childrenAges: a } }); dispatch({ type: "applyInfo", applied: { child: a.length > 0 } }); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
    </label>
  );
}

/** 부채상환형: 체크 + 팝업에서 잔액·만기 입력 */
function DebtControl() {
  const { state, dispatch } = useDesign();
  const p = state.profile;
  const b = boundaryLabel("debt", state);
  const dlg = useRef<HTMLDialogElement>(null);
  const [debt, setDebt] = useState(p.debt || 1e8);
  const [years, setYears] = useState(p.debtYears);
  const apply = () => { dispatch({ type: "profile", patch: { debt, debtYears: years } }); dispatch({ type: "applyInfo", applied: { debt: debt > 0 } }); dlg.current?.close(); };
  return (
    <>
      <label className="flex flex-1 items-center gap-1" title={b.text}>
        <input type="checkbox" className="accent-sky" disabled={!b.available} checked={state.infoApplied.debt} onChange={(e) => dispatch({ type: "applyInfo", applied: { debt: e.target.checked } })} />
        <span>부채정보 반영</span>
      </label>
      <button type="button" className={smallBtn} onClick={() => { setDebt(p.debt || 1e8); setYears(p.debtYears); dlg.current?.showModal(); }}>입력</button>
      <dialog ref={dlg} className="m-auto w-[min(92vw,420px)] rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <h3 className="font-display text-lg text-navy">부채 정보</h3>
        <div className="mt-3 grid gap-3 whitespace-normal">
          <Field label="부채 잔액"><ManwonInput value={debt} onChange={setDebt} min={0} max={1e6} /></Field>
          <Field label="만기까지 (년)" hint={`가입연령 ${p.age}세 기준 ${p.age + years}세에 상환 완료`}><NumInput value={years} min={1} max={40} onCommit={(v) => setYears(Math.round(v))} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button onClick={() => dlg.current?.close()}>취소</Button><Button primary onClick={apply}>적용</Button></div>
      </dialog>
    </>
  );
}

/** 은퇴증액형·단체보험보완형: 은퇴시기 선택(두 카드가 같은 값) */
function RetireControl() {
  const { state, dispatch } = useDesign();
  const value = state.infoApplied.retire ? state.profile.retirementAge : STANDARD_BOUNDARY.retirementAge;
  return (
    <label className="flex flex-1 items-center gap-1" title={boundaryLabel("retire", state).text}>
      <span>은퇴시기</span>
      <select className="rounded border border-navy/20 bg-white px-1 py-0.5 text-xs" value={value} aria-label="은퇴시기"
        onChange={(e) => { const v = Number(e.target.value); dispatch({ type: "profile", patch: { retirementAge: v } }); dispatch({ type: "applyInfo", applied: { retire: true } }); }}>
        {RETIRE_OPTIONS.map((v) => <option key={v} value={v}>{v}세</option>)}
      </select>
    </label>
  );
}

const CONTROL = { income: IncomeControl, child: ChildControl, debt: DebtControl, retire: RetireControl } as const;

/** 프리셋 6종. 각 카드 아래 한 줄에 입력·반영 컨트롤과 근거 "?" */
export function PresetPicker() {
  const { state, dispatch } = useDesign();
  return (
    <Card title={<span className="flex flex-wrap items-center justify-between gap-2">프리셋 {state.presetId === "custom" && <span className="rounded bg-navy/5 px-2 py-0.5 font-sans text-xs font-normal text-navy/70">직접 편집 중</span>}</span>}>
      <p className="mb-2 text-xs text-navy/60">기준보험금 1억, 표준 경계로 그립니다. 카드 아래에서 정보를 넣고 체크하면 그 값으로 바뀝니다.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => {
          const active = state.presetId === id;
          const info = PRESET_INFO[id];
          const Control = info.control === "none" ? null : CONTROL[info.control];
          return (
            <div key={id} className={`flex flex-col rounded border transition-colors ${active ? "border-sky bg-sky/10" : "border-navy/15"}`}>
              <button type="button" onClick={() => dispatch({ type: "preset", id })} aria-pressed={active} className="flex-1 p-2 text-left hover:bg-navy/5">
                <div className="text-sm font-medium text-navy">{PRESETS[id].label}</div>
                <div className="text-xs text-navy/60">{PRESETS[id].description}</div>
              </button>
              <div className="flex items-center gap-1 whitespace-nowrap border-t border-navy/10 px-2 py-1.5 text-xs">
                {Control ? <Control /> : <span className="flex-1 text-navy/40">입력 정보와 무관</span>}
                <HelpPopup title={PRESETS[id].label}>{info.rationale}</HelpPopup>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
