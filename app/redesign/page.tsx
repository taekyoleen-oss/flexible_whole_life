"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { DesignProvider, useDesign } from "@/components/design-provider";
import { BudgetModePanel } from "@/components/redesign/budget-mode";
import { OldContractForm } from "@/components/redesign/old-contract-form";
import { RedesignCanvas } from "@/components/redesign/redesign-canvas";
import { loadLibrary } from "@/lib/library";
import { budgetFor, newDesignFor, type BudgetMode, type OldContract } from "@/lib/redesign";
import type { DesignState } from "@/lib/state";

function RedesignInner() {
  const { state, loaded } = useDesign();
  const params = useSearchParams();
  const [old, setOld] = useState<OldContract | null>(null);
  const [mode, setMode] = useState<BudgetMode>("continue");
  const [reduced, setReduced] = useState(0);
  const [restored, setRestored] = useState<{ state: DesignState; at: number } | null>(null);
  useEffect(() => {                                   // 보관함에서 열기: ?id=
    const id = params.get("id"); if (!id) return;
    const e = loadLibrary().find((x) => x.id === id && x.redesign); if (!e?.redesign) return;
    setOld(e.redesign.old); setMode(e.redesign.mode); setReduced(e.redesign.monthlyGross); setRestored({ state: e.state, at: e.redesign.redesignedAt });
  }, [params]);
  const budget = useMemo(() => (old ? budgetFor(old, mode, reduced) : null), [old, mode, reduced]);
  const initial = useMemo(() => (old ? (restored?.state ?? newDesignFor(old, state.settings)) : null), [old, restored, state.settings]);
  if (!loaded) return null;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="font-display text-2xl text-navy">재설계</h1>
      <p className="text-sm text-navy/60">이미 가입한 계약의 준비금과 앞으로 낼 보험료를 예산으로 보험금 스케줄을 다시 설계합니다. 규칙: 원계약 기초율에서 새 급부 현가가 이월액과 미래 보험료 현가를 넘지 않고(R01), 재설계 후 5년은 보험금 모양을 올리지 않으며(R02), 연 1회(R03).</p>
      <OldContractForm value={old} onChange={(o) => { setOld(o); setRestored(null); setReduced(Math.round(o.monthlyGross / 2)); }} />
      {old && budget && initial && (
        <>
          <BudgetModePanel old={old} mode={mode} reduced={reduced} onChange={(m, v) => { setMode(m); setReduced(v); }} />
          <DesignProvider key={`${old.label}-${old.attainedAge}-${restored?.at ?? 0}`} initial={initial} persist={false}>
            <RedesignCanvas old={old} budget={budget} mode={mode} lastRedesignedAt={restored?.at ?? null} />
          </DesignProvider>
        </>
      )}
    </div>
  );
}

export default function RedesignPage() {
  return <Suspense fallback={null}><RedesignInner /></Suspense>;
}
