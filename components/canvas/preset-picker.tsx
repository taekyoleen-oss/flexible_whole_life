"use client";
import { useDesign } from "@/components/design-provider";
import { HelpPopup } from "@/components/help-popup";
import { Card } from "@/components/ui";
import { PRESETS, type PresetId } from "@/lib/engine";
import { boundaryLabel, PRESET_INFO, RETIRE_OPTIONS } from "@/lib/preset-info";
import { STANDARD_BOUNDARY } from "@/lib/state";

/** 프리셋 6종. 각 카드 아래에 "입력 정보 반영" 체크(기본 해제)와 조건의 근거 "?" */
export function PresetPicker() {
  const { state, dispatch } = useDesign();
  const retireValue = state.infoApplied.retire ? state.profile.retirementAge : STANDARD_BOUNDARY.retirementAge;
  return (
    <Card title={<span className="flex flex-wrap items-center justify-between gap-2">프리셋 {state.presetId === "custom" && <span className="rounded bg-navy/5 px-2 py-0.5 font-sans text-xs font-normal text-navy/70">직접 편집 중</span>}</span>}>
      <p className="mb-2 text-xs text-navy/60">기준보험금 1억, 표준 경계로 그립니다. 입력 화면의 정보를 쓰려면 카드의 체크박스를 켜거나 입력 요약의 &quot;입력 정보 반영&quot;을 누르세요.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => {
          const active = state.presetId === id;
          const info = PRESET_INFO[id];
          const b = info.boundary ? boundaryLabel(info.boundary, state) : null;
          return (
            <div key={id} className={`flex flex-col rounded border transition-colors ${active ? "border-sky bg-sky/10" : "border-navy/15"}`}>
              <button type="button" onClick={() => dispatch({ type: "preset", id })} aria-pressed={active} className="flex-1 p-2 text-left hover:bg-navy/5">
                <div className="text-sm font-medium text-navy">{PRESETS[id].label}</div>
                <div className="text-xs text-navy/60">{PRESETS[id].description}</div>
              </button>
              <div className="flex items-center gap-1 whitespace-nowrap border-t border-navy/10 px-2 py-1.5 text-xs">
                {id === "retire" ? (
                  <label className="flex flex-1 items-center gap-1" title={b?.text}>
                    <span>은퇴시기</span>
                    <select className="rounded border border-navy/20 bg-white px-1 py-0.5 text-xs" value={retireValue} aria-label="은퇴시기"
                      onChange={(e) => { const v = Number(e.target.value); dispatch({ type: "profile", patch: { retirementAge: v } }); dispatch({ type: "applyInfo", applied: { retire: v !== STANDARD_BOUNDARY.retirementAge || state.infoApplied.retire } }); }}>
                      {RETIRE_OPTIONS.map((v) => <option key={v} value={v}>{v}세</option>)}
                    </select>
                  </label>
                ) : info.boundary && b ? (
                  <label className={`flex flex-1 items-center gap-1 ${b.available ? "" : "text-navy/40"}`} title={b.text}>
                    <input type="checkbox" className="accent-sky" disabled={!b.available} checked={state.infoApplied[info.boundary]}
                      onChange={(e) => dispatch({ type: "applyInfo", applied: { [info.boundary as string]: e.target.checked } })} />
                    <span>{info.checkLabel}</span>
                  </label>
                ) : (
                  <span className="flex-1 text-navy/40">입력 정보와 무관</span>
                )}
                <HelpPopup title={PRESETS[id].label}>{info.rationale}</HelpPopup>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
