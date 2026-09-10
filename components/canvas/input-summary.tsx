"use client";
import { useDesign } from "@/components/design-provider";
import { Card, NumInput, Select } from "@/components/ui";
import { manwon } from "@/lib/format";
import type { Profile } from "@/lib/state";
import { FinanceButton } from "./apply-info";

/** 피보험자 기본 정보를 설계 화면에서 바로 편집한다. 자녀·부채·은퇴시기는 프리셋 카드에서, 재무 정보는 팝업에서 */
export function InputSummary() {
  const { state, dispatch } = useDesign();
  const p = state.profile, f = state.infoApplied;
  const setP = (patch: Partial<Profile>) => dispatch({ type: "profile", patch });
  const tag = (on: boolean) => on ? <span className="ml-1 rounded bg-sky/10 px-1.5 py-0.5 text-xs text-sky">반영</span> : <span className="ml-1 rounded bg-navy/5 px-1.5 py-0.5 text-xs text-navy/50">미반영</span>;
  return (
    <Card title="피보험자">
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-navy/60">성별</span>
        <Select value={p.sex} onChange={(e) => setP({ sex: e.target.value as Profile["sex"] })}><option value="M">남</option><option value="F">여</option></Select>
        <span className="text-navy/60">연령</span>
        <div className="flex items-center gap-1"><NumInput value={p.age} min={15} max={70} onCommit={(v) => setP({ age: v })} /><span className="text-navy/60">세</span></div>
        <span className="text-navy/60">배우자</span>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-sky" checked={p.hasSpouse} onChange={(e) => setP({ hasSpouse: e.target.checked })} />있음</label>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-navy/60">자녀</dt><dd>{p.childrenAges.length ? p.childrenAges.map((a) => `${a}세`).join(", ") : "없음"}{p.childrenAges.length > 0 && tag(f.child)}</dd>
        <dt className="text-navy/60">부채</dt><dd>{p.debt > 0 ? `${manwon(p.debt)} · ${p.debtYears}년` : "없음"}{p.debt > 0 && tag(f.debt)}</dd>
        <dt className="text-navy/60">은퇴시기</dt><dd>{p.retirementAge}세{tag(f.retire)}</dd>
        <dt className="text-navy/60">연소득</dt><dd>{p.income > 0 ? manwon(p.income) : "없음"}{p.income > 0 && tag(f.income)}</dd>
        <dt className="text-navy/60">기존 보장</dt><dd>{p.groupCover + p.termCover > 0 ? manwon(p.groupCover + p.termCover) : "없음"}</dd>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FinanceButton />
        <span className="text-xs text-navy/50">자녀·부채·은퇴시기·연소득 반영은 프리셋 카드에서 합니다.</span>
      </div>
    </Card>
  );
}
