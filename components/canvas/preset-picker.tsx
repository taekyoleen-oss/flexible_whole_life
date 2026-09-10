"use client";
import { useDesign } from "@/components/design-provider";
import { Card } from "@/components/ui";
import { PRESETS, type PresetId } from "@/lib/engine";

export function PresetPicker() {
  const { state, dispatch } = useDesign();
  return (
    <Card title={<span className="flex items-center justify-between">프리셋 {state.presetId === "custom" && <span className="rounded bg-navy/5 px-2 py-0.5 font-sans text-xs text-navy/70">직접 편집 중</span>}</span>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => {
          const active = state.presetId === id;
          return (
            <button key={id} type="button" onClick={() => dispatch({ type: "preset", id })} aria-pressed={active}
              className={`rounded border p-2 text-left transition-colors ${active ? "border-sky bg-sky/10" : "border-navy/15 hover:bg-navy/5"}`}>
              <div className="text-sm font-medium text-navy">{PRESETS[id].label}</div>
              <div className="text-xs text-navy/60">{PRESETS[id].description}</div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
