"use client";
import Link from "next/link";
import { CompareTable } from "@/components/compare/compare-table";
import { useDesign } from "@/components/design-provider";
import { Card } from "@/components/ui";

export default function ComparePage() {
  const { loaded } = useDesign();
  if (!loaded) return null;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="font-display text-2xl text-navy">같은 예산 3안 비교</h1><Link href="/design" className="text-sm text-sky hover:underline">← 설계로</Link></div>
      <Card><CompareTable /></Card>
    </div>
  );
}
