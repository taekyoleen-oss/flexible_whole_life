"use client";
import { FormulaHelp } from "@/components/formula-help";
import { useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, Card } from "@/components/ui";
import { won } from "@/lib/format";
import { STEP } from "@/lib/state";
import { BudgetFields } from "./budget-panel";
import { CelebrationBar } from "./celebration-bar";
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
    <Card title="보험금 스케줄">
      <div className="-mt-2 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-navy/60">
        <span>연령을 클릭한 뒤 위아래로 드래그 · 1칸 = 기준보험금의 {STEP * 100}% ({won(STEP * state.S0)}) · 마지막 변경 후 지난 연수만큼 ±, 매년 최대 1칸 · 더블클릭하면 그 값으로 이후를 평탄화 <FormulaHelp id="step" /></span>
        <span className="flex gap-2">{toggle}<Button onClick={() => dlg.current?.showModal()}>확대</Button></span>
      </div>
      <ScheduleEditor height={400} amount={amount} />
      <CelebrationBar />
      <ScaleSection />
      <dialog ref={dlg} className="m-auto w-[min(96vw,1400px)] rounded-lg bg-white p-4 shadow-xl backdrop:bg-navy/50"
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
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
