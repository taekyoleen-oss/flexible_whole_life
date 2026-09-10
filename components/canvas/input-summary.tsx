"use client";
import Link from "next/link";
import { Fragment } from "react";
import { useDesign } from "@/components/design-provider";
import { Card } from "@/components/ui";
import { manwon } from "@/lib/format";

export function InputSummary() {
  const { state } = useDesign();
  const p = state.profile;
  const rows: [string, string][] = [
    ["피보험자", `${p.age}세 ${p.sex === "M" ? "남" : "여"}${p.hasSpouse ? " · 배우자" : ""}`],
    ["자녀", p.childrenAges.length ? p.childrenAges.map((a) => `${a}세`).join(", ") : "없음"],
    ["연소득", manwon(p.income)],
    ["부채", p.debt > 0 ? `${manwon(p.debt)} · ${p.debtYears}년` : "없음"],
    ["기존 보장", p.groupCover + p.termCover > 0 ? manwon(p.groupCover + p.termCover) : "없음"],
    ["은퇴", `${p.retirementAge}세`],
  ];
  return (
    <Card title={<span className="flex items-center justify-between">입력 요약 <Link href="/start" className="font-sans text-sm text-sky hover:underline">수정</Link></span>}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([k, v]) => <Fragment key={k}><dt className="text-navy/60">{k}</dt><dd>{v}</dd></Fragment>)}
      </dl>
    </Card>
  );
}
