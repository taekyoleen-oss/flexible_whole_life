"use client";
import { FormulaHelp } from "@/components/formula-help";
import { useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, Card, onBackdropClick } from "@/components/ui";
import { won } from "@/lib/format";
import { BENEFIT_LABEL, STEP } from "@/lib/state";
import { BudgetFields } from "./budget-panel";
import { AddonsPanel } from "./addons-panel";
import { CelebrationBar } from "./celebration-bar";
import { RulesButton } from "./rules-popup";
import { ScheduleEditor } from "./schedule-editor";

/** 설계가 끝난 뒤 전체 금액을 비례 조정한다. 배수(비율)는 그대로 두고 기준보험금만 바뀐다 */
function ScaleSection() {
  return (
    <div className="mt-4 rounded border border-navy/10 bg-cream p-3">
      <div className="mb-2 text-sm font-medium text-navy">전체 금액 조정 <span className="font-normal text-navy/60">· 설계한 비율은 그대로 두고 월 보험료에 맞추거나 기준보험금을 바꿉니다</span></div>
      <BudgetFields />
    </div>
  );
}

export function ScheduleChart() {
  const { state } = useDesign();
  const [amount, setAmount] = useState(true);
  const dlg = useRef<HTMLDialogElement>(null);
  const toggle = <Button onClick={() => setAmount(!amount)}>{amount ? "배수로 보기" : "금액으로 보기"}</Button>;
  return (
    <Card title={`${BENEFIT_LABEL[state.profile.product]} 스케줄`}>
      <div className="-mt-2 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-navy/60">
        <span>선을 누른 채 위아래로 드래그(↑↓ 키도 가능) · 1칸 = 기준보험금의 {STEP * 100}% ({won(STEP * state.S0)}) · 더블클릭 = 그 값으로 이후 평탄화 · 규칙은 [설계 규칙] <FormulaHelp id="step" /></span>
        <span className="flex gap-2"><RulesButton />{toggle}<Button onClick={() => dlg.current?.showModal()}>확대</Button></span>
      </div>
      <ScheduleEditor height={400} amount={amount} />
      <p className="mt-1 text-[11px] text-navy/50"><span className="mr-3"><span className="inline-block h-2 w-2 rotate-45 bg-navy align-middle" /> 변경점</span><span className="mr-3"><span className="inline-block h-2 w-3 bg-sky/20 align-middle" /> 초기 고정 구간</span><span><span className="inline-block h-2 w-2 rounded-full bg-sky align-middle" /> 축하금</span></p>
      <CelebrationBar />
      <AddonsPanel />
      <div className="lg:hidden"><ScaleSection /></div>
      <dialog ref={dlg} className="m-auto w-[min(96vw,1400px)] rounded-lg bg-white p-4 shadow-xl backdrop:bg-navy/50"
        onClick={onBackdropClick}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg text-navy">보험금 스케줄</h2>
          <span className="flex gap-2">{toggle}<Button onClick={() => dlg.current?.close()}>닫기</Button></span>
        </div>
        <ScheduleEditor height={560} amount={amount} />
        <CelebrationBar />
        <ScaleSection />
      </dialog>
    </Card>
  );
}
