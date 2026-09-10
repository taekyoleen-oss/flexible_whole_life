"use client";
import Link from "next/link";
import { Fragment } from "react";
import { useDesign } from "@/components/design-provider";
import { Card } from "@/components/ui";
import { manwon } from "@/lib/format";
import { ApplyInfoButton } from "./apply-info";

/** 입력 요약. 조건이 있는 항목은 설계에 반영됐는지(반영/미반영) 표시하고, "입력 정보 반영"으로 한 번에 적용한다 */
export function InputSummary() {
  const { state } = useDesign();
  const p = state.profile, f = state.infoApplied;
  const tag = (on: boolean) => on ? <span className="ml-2 rounded bg-sky/10 px-1.5 py-0.5 text-xs text-sky">반영</span> : <span className="ml-2 rounded bg-navy/5 px-1.5 py-0.5 text-xs text-navy/50">미반영</span>;
  const rows: [string, string, boolean | null][] = [
    ["피보험자", `${p.age}세 ${p.sex === "M" ? "남" : "여"}${p.hasSpouse ? " · 배우자" : ""}`, null],
    ["자녀", p.childrenAges.length ? p.childrenAges.map((a) => `${a}세`).join(", ") : "없음", p.childrenAges.length ? f.child : null],
    ["연소득", manwon(p.income), p.income > 0 ? f.income : null],
    ["부채", p.debt > 0 ? `${manwon(p.debt)} · ${p.debtYears}년` : "없음", p.debt > 0 ? f.debt : null],
    ["기존 보장", p.groupCover + p.termCover > 0 ? manwon(p.groupCover + p.termCover) : "없음", p.groupCover > 0 ? f.group : p.termCover > 0 ? f.income : null],
    ["은퇴", `${p.retirementAge}세`, f.retire],
  ];
  return (
    <Card title={<span className="flex items-center justify-between">입력 요약 <Link href="/start" className="font-sans text-sm text-sky hover:underline">수정</Link></span>}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([k, v, on]) => <Fragment key={k}><dt className="text-navy/60">{k}</dt><dd>{v}{on !== null && tag(on)}</dd></Fragment>)}
      </dl>
      <div className="mt-3 flex items-center gap-2">
        <ApplyInfoButton />
        <span className="text-xs text-navy/50">설계는 1억·표준 경계로 시작합니다. 누르면 미반영 항목을 골라 적용합니다.</span>
      </div>
    </Card>
  );
}
