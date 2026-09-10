"use client";
import { useState, type ReactNode } from "react";
import { BlockCards } from "@/components/canvas/block-cards";
import { BudgetPanel } from "@/components/canvas/budget-panel";
import { DesignToolbar } from "@/components/canvas/design-toolbar";
import { InputSummary } from "@/components/canvas/input-summary";
import { PresetPicker } from "@/components/canvas/preset-picker";
import { ScheduleChart } from "@/components/canvas/schedule-chart";
import { useDesign } from "@/components/design-provider";
import { Evidence } from "@/components/result/evidence";
import { PremiumSummary } from "@/components/result/premium-summary";
import { ResultChart } from "@/components/result/result-chart";
import { ValidationBadges } from "@/components/result/validation-badges";
import { Button } from "@/components/ui";

const TABS = ["입력", "설계"] as const;
type Tab = (typeof TABS)[number];

export default function DesignPage() {
  const { loaded } = useDesign();
  const [tab, setTab] = useState<Tab>("설계");
  if (!loaded) return null;
  const col = (name: Tab, node: ReactNode) => <div className={`${tab === name ? "block" : "hidden"} space-y-4 lg:block`}>{node}</div>;
  return (
    <>
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
            <BlockCards />
            <Evidence />
          </>
        ))}
      </div>
    </>
  );
}
