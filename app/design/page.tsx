"use client";
import { useState, type ReactNode } from "react";
import { BlockCards } from "@/components/canvas/block-cards";
import { BudgetPanel } from "@/components/canvas/budget-panel";
import { DesignToolbar } from "@/components/canvas/design-toolbar";
import { InputSummary } from "@/components/canvas/input-summary";
import { PresetPicker } from "@/components/canvas/preset-picker";
import { ScheduleChart } from "@/components/canvas/schedule-chart";
import Link from "next/link";
import { useDesign } from "@/components/design-provider";
import { manwon } from "@/lib/format";
import { Evidence } from "@/components/result/evidence";
import { PremiumSummary } from "@/components/result/premium-summary";
import { ReserveTable } from "@/components/result/reserve-table";
import { ResultChart } from "@/components/result/result-chart";
import { ValidationBadges } from "@/components/result/validation-badges";
import { Button } from "@/components/ui";

const TABS = ["입력", "설계"] as const;
type Tab = (typeof TABS)[number];

export default function DesignPage() {
  const { state, loaded } = useDesign();
  const [tab, setTab] = useState<Tab>("설계");
  if (!loaded) return null;
  const col = (name: Tab, node: ReactNode) => <div className={`${tab === name ? "block" : "hidden"} space-y-4 lg:block`}>{node}</div>;
  const p = state.profile;
  const subject = [
    `${p.age}세 ${p.sex === "M" ? "남" : "여"}`,
    p.hasSpouse ? "배우자 있음" : "배우자 없음",
    p.childrenAges.length ? `자녀 ${p.childrenAges.map((a) => `${a}세`).join("·")}` : "자녀 없음",
    `연소득 ${manwon(p.income)}`,
    p.debt > 0 ? `부채 ${manwon(p.debt)}` : null,
    `${state.payYears}년납`,
  ].filter(Boolean).join(" · ");
  return (
    <>
      <p className="mb-2 flex flex-wrap items-center gap-x-2 text-sm text-navy">
        <span className="font-medium">피보험자</span><span>{subject}</span>
        <Link href="/start" className="text-xs text-sky hover:underline">수정</Link>
      </p>
      <DesignToolbar />
      <div className="mb-4 flex gap-2 lg:hidden">
        {TABS.map((t) => <Button key={t} primary={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</Button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {col("입력", <><BudgetPanel /><InputSummary /></>)}
        {col("설계", (
          <>
            <PresetPicker />
            <ScheduleChart />
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-4"><PremiumSummary /><ValidationBadges /></div>
              <ResultChart />
            </div>
            <ReserveTable />
            <BlockCards />
            <Evidence />
          </>
        ))}
      </div>
    </>
  );
}
