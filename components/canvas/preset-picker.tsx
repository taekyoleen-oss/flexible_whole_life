"use client";
import { Fragment, useRef, type ReactNode } from "react";
import { useDesign } from "@/components/design-provider";
import { FormulaHelp } from "@/components/formula-help";
import { Button, Card, Field, Input, ManwonInput, NumInput, Select } from "@/components/ui";
import { PRESETS, type PresetId } from "@/lib/engine";
import type { FormulaId } from "@/lib/formulas";
import { won } from "@/lib/format";
import { boundaryLabel, flagOf, PRESET_INFO, presetEvidence, RETIRE_OPTIONS } from "@/lib/preset-info";
import { recommend } from "@/lib/recommend";
import { parseAgeList, type Profile } from "@/lib/state";
import { FinanceButton } from "./apply-info";

const smallBtn = "rounded border border-navy/20 px-1.5 py-0.5 text-xs text-navy hover:bg-navy/5";
const dialogCls = "m-auto w-[min(92vw,640px)] whitespace-normal rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50";
const Common = () => <span className="ml-1 rounded bg-navy/5 px-1 text-[10px] text-navy/60">공통</span>;

/** 근거 수치 표(입력·근거 팝업 공용) */
function Figures({ rows }: { rows: [string, string][] }) {
  return <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">{rows.map(([k, v]) => <Fragment key={k}><dt className="text-navy/60">{k}</dt><dd className="text-right font-mono text-navy">{v}</dd></Fragment>)}</dl>;
}

/** "?" 근거 팝업: 이론·표준·입력 항목·현재 계산 수치·수식 링크 */
function EvidenceButton({ id }: { id: PresetId }) {
  const { state } = useDesign();
  const dlg = useRef<HTMLDialogElement>(null);
  const info = PRESET_INFO[id];
  const ev = presetEvidence(id, state);
  const applied = state.infoApplied[flagOf(id)];
  return (
    <>
      <button type="button" aria-label={`${PRESETS[id].label} 근거`} title="근거" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-navy/30 text-[10px] leading-none text-navy/60 hover:bg-sky/10 hover:text-sky" onClick={() => dlg.current?.showModal()}>?</button>
      <dialog ref={dlg} className={dialogCls} onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <h3 className="font-display text-lg text-navy">{PRESETS[id].label} · 근거 <FormulaHelp id={info.formula as FormulaId} /> <FormulaHelp id="shapeRules" /></h3>
        <p className="mt-3 text-sm text-ink">{info.theory}</p>
        <p className="mt-2 text-xs text-navy/60"><span className="font-medium text-navy">표준 모양</span> · {info.standard}</p>
        <p className="mt-1 text-xs text-navy/60"><span className="font-medium text-navy">조건</span> · {info.inputs}</p>
        {ev && (
          <div className="mt-3 rounded bg-cream p-3">
            <div className="text-xs font-medium text-navy">현재 입력으로 계산한 필요액 {applied ? <span className="ml-1 rounded bg-sky/10 px-1.5 text-sky">설계에 반영 중</span> : <span className="ml-1 rounded bg-navy/5 px-1.5 text-navy/50">미반영 (표준 모양)</span>}</div>
            {ev.available ? <Figures rows={ev.figures} /> : <p className="mt-1 text-xs text-navy/60">{ev.reason}</p>}
          </div>
        )}
        <div className="mt-4 flex justify-end"><Button onClick={() => dlg.current?.close()}>닫기</Button></div>
      </dialog>
    </>
  );
}

/** 프리셋별 조건 입력 팝업. 공통 항목은 프로필 한 곳을 고치므로 다른 프리셋에도 그대로 반영된다 */
function InputButton({ id, children }: { id: PresetId; children: ReactNode }) {
  const { state, dispatch } = useDesign();
  const dlg = useRef<HTMLDialogElement>(null);
  const ev = presetEvidence(id, state);
  const flag = flagOf(id);
  const a = state.settings.assumption.needs;
  const assumptions: Partial<Record<PresetId, string>> = {
    child: `가정: 생활비 비율 ${a.livingRatio * 100}% · 자녀 1인 ${won(a.educationPerChild)} · 독립 ${a.independenceAge}세 · 정리자금 ${won(a.finalExpense)} · 할인율 ${a.discount * 100}% (설정 화면)`,
    debt: `가정: 정리자금 ${won(a.finalExpense)} (설정 화면)`,
    retire: `가정: 정리자금 ${won(a.finalExpense)} · 할인율 ${a.discount * 100}% · 기대여명은 제7회 경험생명표`,
    group: "필요액은 평준형(니즈) 입력과 같은 공통 값으로 계산합니다",
    estate: "상속세: 일괄공제 5억 · 배우자공제 max(5억, min(법정지분, 30억)) · 세율 10~50% (2024년 근사)",
  };
  return (
    <>
      <button type="button" className={smallBtn} onClick={() => dlg.current?.showModal()}>입력</button>
      <dialog ref={dlg} className={dialogCls} onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <h3 className="font-display text-lg text-navy">{PRESETS[id].label} · 조건 입력</h3>
        <p className="mt-1 text-xs text-navy/60">{PRESET_INFO[id].inputs}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
        {assumptions[id] && <p className="mt-2 text-xs text-navy/50">{assumptions[id]}</p>}
        {ev && (
          <div className="mt-3 rounded bg-cream p-3">
            <div className="text-xs font-medium text-navy">계산 결과</div>
            {ev.available ? (
              <>
                <Figures rows={ev.figures} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-navy/70">기준보험금 제안 <span className="font-mono text-navy">{won(ev.proposedS0)}</span>{state.S0 === ev.proposedS0 && <span className="ml-1 text-sky">(적용됨)</span>}</span>
                  <Button onClick={() => dispatch({ type: "applyInfo", applied: { [flag]: true }, S0: ev.proposedS0 })}>기준보험금으로 적용</Button>
                </div>
              </>
            ) : <p className="mt-1 text-xs text-navy/60">{ev.reason}</p>}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => dlg.current?.close()}>닫기</Button>
          <Button primary disabled={!ev?.available} onClick={() => { dispatch({ type: "applyInfo", applied: { [flag]: true } }); dlg.current?.close(); }}>반영하고 닫기</Button>
        </div>
      </dialog>
    </>
  );
}

function ApplyCheck({ id, label = "반영" }: { id: PresetId; label?: string }) {
  const { state, dispatch } = useDesign();
  const flag = flagOf(id);
  const b = boundaryLabel(flag, state);
  return (
    <label className="flex items-center gap-1" title={b.text}>
      <input type="checkbox" className="accent-sky" disabled={!b.available} checked={state.infoApplied[flag]}
        onChange={(e) => id === "level" ? (e.target.checked ? dispatch({ type: "applyInfo", applied: {}, S0: recommend(state).suggestedS0 }) : dispatch({ type: "S0", S0: 1e8 })) : dispatch({ type: "applyInfo", applied: { [flag]: e.target.checked } })} />
      <span>{label}</span>
    </label>
  );
}

function RetireSelect() {
  const { state, dispatch } = useDesign();
  return (
    <label className="flex items-center gap-1" title={boundaryLabel("retire", state).text}>
      <span>은퇴</span>
      <select className="rounded border border-navy/20 bg-white px-1 py-0.5 text-xs" value={state.profile.retirementAge} aria-label="은퇴시기"
        onChange={(e) => { dispatch({ type: "profile", patch: { retirementAge: Number(e.target.value) } }); dispatch({ type: "applyInfo", applied: { retire: true } }); }}>
        {RETIRE_OPTIONS.map((v) => <option key={v} value={v}>{v}세</option>)}
        {!RETIRE_OPTIONS.includes(state.profile.retirementAge as (typeof RETIRE_OPTIONS)[number]) && <option value={state.profile.retirementAge}>{state.profile.retirementAge}세</option>}
      </select>
    </label>
  );
}

/** 공통 입력 필드 */
function useFields() {
  const { state, dispatch } = useDesign();
  const p = state.profile;
  const setP = (patch: Partial<Profile>) => dispatch({ type: "profile", patch });
  const pctInput = (value: number, onCommit: (v: number) => void, max = 30) => <div className="flex items-center gap-1"><NumInput value={Math.round(value * 1000) / 10} min={0} max={max} step={0.1} onCommit={(v) => onCommit(v / 100)} /><span className="text-sm text-navy/60">%</span></div>;
  return {
    p, setP, pctInput,
    childrenAges: <Field label={<>자녀 나이 (쉼표)<Common /></>}><Input key={p.childrenAges.join()} defaultValue={p.childrenAges.join(", ")} placeholder="3, 6" onBlur={(e) => { const a = parseAgeList(e.target.value, 0, 40); e.target.value = a.join(", "); setP({ childrenAges: a }); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></Field>,
    income: <Field label={<>연소득<Common /></>}><ManwonInput value={p.income} onChange={(v) => setP({ income: v })} max={1e5} /></Field>,
    spouse: <Field label={<>배우자<Common /></>}><label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" className="accent-sky" checked={p.hasSpouse} onChange={(e) => setP({ hasSpouse: e.target.checked })} />있음</label></Field>,
    retireAge: <Field label={<>은퇴시기<Common /></>}><Select value={p.retirementAge} onChange={(e) => { setP({ retirementAge: Number(e.target.value) }); dispatch({ type: "applyInfo", applied: { retire: true } }); }}>{RETIRE_OPTIONS.map((v) => <option key={v} value={v}>{v}세</option>)}</Select></Field>,
    groupCover: <Field label={<>단체보험 보험금<Common /></>}><ManwonInput value={p.groupCover} onChange={(v) => setP({ groupCover: v })} max={1e6} /></Field>,
  };
}

function ChildFields() { const f = useFields(); return <>{f.childrenAges}{f.income}{f.spouse}</>; }
function DebtFields() {
  const f = useFields();
  return (
    <>
      <Field label={<>부채 잔액<Common /></>}><ManwonInput value={f.p.debt} onChange={(v) => f.setP({ debt: v })} max={1e6} /></Field>
      <Field label={<>만기까지 (년)<Common /></>} hint={`${f.p.age + f.p.debtYears}세 상환 완료`}><NumInput value={f.p.debtYears} min={1} max={40} onCommit={(v) => f.setP({ debtYears: Math.round(v) })} /></Field>
      <Field label="대출 금리 (연)">{f.pctInput(f.p.debtRate, (v) => f.setP({ debtRate: v }))}</Field>
      <Field label="상환방식"><Select value={f.p.debtMethod} onChange={(e) => f.setP({ debtMethod: e.target.value as Profile["debtMethod"] })}><option value="annuity">원리금균등</option><option value="principal">원금균등</option><option value="bullet">만기일시</option></Select></Field>
    </>
  );
}
function RetireFields() {
  const f = useFields();
  return (
    <>
      {f.retireAge}{f.spouse}
      <Field label="배우자 나이"><div className="flex items-center gap-1"><NumInput value={f.p.spouseAge} min={15} max={90} onCommit={(v) => f.setP({ spouseAge: Math.round(v) })} /><span className="text-sm text-navy/60">세</span></div></Field>
      <Field label="은퇴 후 배우자 월 생활비"><ManwonInput value={f.p.livingMonthly} onChange={(v) => f.setP({ livingMonthly: v })} max={1e4} /></Field>
      <Field label="은퇴 자산 (연금·퇴직금 현가)"><ManwonInput value={f.p.retireAssets} onChange={(v) => f.setP({ retireAssets: v })} max={1e6} /></Field>
      {f.income}
    </>
  );
}
function GroupFields() { const f = useFields(); return <>{f.groupCover}{f.retireAge}{f.income}<Field label={<>유동자산<Common /></>}><ManwonInput value={f.p.liquidAssets} onChange={(v) => f.setP({ liquidAssets: v })} max={1e6} /></Field></>; }
function EstateFields() {
  const f = useFields();
  return (
    <>
      <Field label="순자산 (부동산·금융 − 부채)"><ManwonInput value={f.p.netAssets} onChange={(v) => f.setP({ netAssets: v })} max={1e7} /></Field>
      <Field label="자산 증가율 (연)">{f.pctInput(f.p.assetGrowth, (v) => f.setP({ assetGrowth: v }), 20)}</Field>
      {f.spouse}
      <Field label={<>자녀 수<Common /></>} hint="자녀연령형의 자녀 나이에서 가져옵니다"><div className="flex h-9 items-center text-sm">{f.p.childrenAges.length}명</div></Field>
    </>
  );
}

const FIELDS: Partial<Record<PresetId, () => ReactNode>> = { child: ChildFields, debt: DebtFields, retire: RetireFields, group: GroupFields, estate: EstateFields };

/** 프리셋 6종. 카드 아래에 [반영] [입력] [?근거]. 조건을 반영하면 필요액 곡선을 설계 규칙에 맞춰 그린다 */
export function PresetPicker() {
  const { state, dispatch } = useDesign();
  return (
    <Card title={<span className="flex flex-wrap items-center justify-between gap-2">프리셋 {state.presetId === "custom" && <span className="rounded bg-navy/5 px-2 py-0.5 font-sans text-xs font-normal text-navy/70">직접 편집 중</span>}</span>}>
      <p className="mb-2 text-xs text-navy/60">기준보험금 1억, 표준 모양으로 시작합니다. 카드의 &quot;입력&quot;에서 조건을 넣고 &quot;반영&quot;을 켜면 이론·수식으로 계산한 필요액 곡선을 설계 규칙에 맞춰 그립니다. &quot;?&quot;가 근거를 보여줍니다.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => {
          const active = state.presetId === id;
          const Fields = FIELDS[id];
          return (
            <div key={id} className={`flex flex-col rounded border transition-colors ${active ? "border-sky bg-sky/10" : "border-navy/15"}`}>
              <button type="button" onClick={() => dispatch({ type: "preset", id })} aria-pressed={active} className="flex-1 p-2 text-left hover:bg-navy/5">
                <div className="text-sm font-medium text-navy">{PRESETS[id].label}</div>
                <div className="text-xs text-navy/60">{PRESETS[id].description}</div>
              </button>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-navy/10 px-2 py-1.5 text-xs">
                {id === "level" ? <><ApplyCheck id="level" label="연소득 반영" /><FinanceButton compact /></> : <>
                  <ApplyCheck id={id} />
                  {(id === "retire" || id === "group") && <RetireSelect />}
                  {Fields && <InputButton id={id}><Fields /></InputButton>}
                </>}
                <EvidenceButton id={id} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
