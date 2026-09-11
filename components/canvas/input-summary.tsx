"use client";
import { useDesign } from "@/components/design-provider";
import { Card, NumInput, Select } from "@/components/ui";
import type { Profile } from "@/lib/state";

/** 피보험자 기본 정보(성별·연령·배우자)만 여기서 편집한다. 자녀·부채·은퇴시기·연소득은 프리셋 카드에서 넣고 반영한다 */
export function InputSummary() {
  const { state, dispatch } = useDesign();
  const p = state.profile;
  const setP = (patch: Partial<Profile>) => dispatch({ type: "profile", patch });
  return (
    <Card title="피보험자">
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
        <label htmlFor="insured-sex" className="text-navy/60">성별</label>
        <Select id="insured-sex" value={p.sex} onChange={(e) => setP({ sex: e.target.value as Profile["sex"] })}><option value="M">남</option><option value="F">여</option></Select>
        <label htmlFor="insured-age" className="text-navy/60">연령</label>
        <div className="flex items-center gap-1"><NumInput id="insured-age" value={p.age} min={15} max={70} onCommit={(v) => setP({ age: v })} /><span className="text-navy/60">세</span></div>
        <span className="text-navy/60">배우자</span>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-sky" checked={p.hasSpouse} onChange={(e) => setP({ hasSpouse: e.target.checked })} />있음</label>
      </div>
      <p className="mt-3 text-xs text-navy/50">자녀·부채·은퇴시기·연소득은 프리셋 카드에서 입력하고 체크해 반영합니다.</p>
    </Card>
  );
}
