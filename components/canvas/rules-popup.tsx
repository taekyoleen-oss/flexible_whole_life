"use client";
import { useRef } from "react";
import { useDesign } from "@/components/design-provider";
import { FormulaHelp } from "@/components/formula-help";
import { Button, onBackdropClick } from "@/components/ui";
import { won } from "@/lib/format";
import { envelopeOf, STEP, CELEBRATION_RATIO } from "@/lib/state";

/** "설계 규칙" 버튼 + 팝업. 현재 설정값으로 E01~E08과 그래프·프리셋 규칙을 한눈에 */
export function RulesButton() {
  const { state } = useDesign();
  const dlg = useRef<HTMLDialogElement>(null);
  const e = envelopeOf(state), x = state.profile.age;
  const rows: [string, string, string][] = [
    ["E01", "초기 고정", `가입 후 ${e.fixYears}년(${x}~${x + e.fixYears - 1}세)은 보험금을 바꿀 수 없습니다. 첫 편집 연령은 ${x + e.fixYears}세입니다.`],
    ["1칸", "단위", `그래프 1칸 = 기준보험금의 ${STEP * 100}% (${won(STEP * state.S0)}). 기준보험금은 1천만원 단위입니다.`],
    ["±칸", "이동 범위", "연령 A에서 움직일 수 있는 칸 수 = A − 직전 변경점(없으면 첫 편집 연령). 직전 변경점이 정한 수준에서 그 칸 수만큼 위아래로."],
    ["1칸/년", "매년 한 칸", "올리든 내리든 보험금은 매년 한 칸을 넘게 변하지 않습니다. 변경 연령 앞에는 매년 한 칸씩 잇는 램프가 놓입니다."],
    ["E02", "연 증가율", `한 해 증가율은 ${e.maxGrowth * 100}%를 넘을 수 없습니다(단, 한 칸 10%는 항상 허용).`],
    ["E03", "증액 종료", `${e.growthEndAge}세 이후에는 증액할 수 없습니다(감액은 가능).`],
    ["E04", "상한", `보험금 배수는 최대 ${e.maxMultiple}배입니다.`],
    ["E05", "감액 하한", `기준보험금의 ${e.minMultiple * 100}% 아래로 줄일 수 없습니다.`],
    ["E06", "최소 금액", `보험금은 ${won(e.minAmount)} 이상이어야 합니다.`],
    ["E07", "심사 한도", `기준보험금은 ${won(e.uwLimit)}까지입니다.`],
    ["E08", "축하금", `축하금은 해당 연령 사망보험금의 ${CELEBRATION_RATIO * 100}%이며, 누계가 그때까지 낸 보험료를 넘을 수 없습니다.`],
    ["편집", "더블클릭·변경점", "선을 더블클릭하면 그 연령 이후가 그 값으로 평탄해집니다. 직선 위에 남는 변경점(마름모)은 자동으로 지워집니다."],
    ["프리셋", "조건 반영", "프리셋 카드의 조건을 반영하면 필요액 곡선을 위 규칙에 맞춰 그립니다. 증액은 필요 시점에 맞춰 미리 시작하고 감액은 매년 한 칸씩 늦게 내려가 보장이 필요액 아래로 가지 않게 합니다."],
  ];
  return (
    <>
      <Button onClick={() => dlg.current?.showModal()}>설계 규칙</Button>
      <dialog ref={dlg} className="m-auto w-[min(92vw,680px)] whitespace-normal rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50" onClick={onBackdropClick}>
        <h3 className="font-display text-lg text-navy">설계 규칙 <FormulaHelp id="envelope" /> <FormulaHelp id="step" /></h3>
        <p className="mt-1 text-xs text-navy/60">설정 화면의 값을 그대로 보여줍니다. 모든 프리셋과 그래프 편집은 이 규칙 안에서만 움직입니다.</p>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {rows.map(([code, name, text]) => (
              <tr key={code + name} className="border-t border-navy/10 align-top">
                <td className="py-1.5 pr-2 font-mono text-xs text-navy/60">{code}</td>
                <td className="py-1.5 pr-2 whitespace-nowrap font-medium text-navy">{name}</td>
                <td className="py-1.5 text-ink">{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end"><Button onClick={() => dlg.current?.close()}>닫기</Button></div>
      </dialog>
    </>
  );
}
