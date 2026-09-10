"use client";
import { useDesign } from "@/components/design-provider";
import { Button } from "@/components/ui";

const AUTO = new Set(["E01", "E04", "E05"]);

export function ValidationBadges() {
  const { violations, dispatch } = useDesign();
  if (violations.length === 0) return <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ 설계 제약 E01~E08 통과</div>;
  return (
    <ul className="space-y-2">
      {violations.map((v) => (
        <li key={v.code} className="rounded border border-red-200 bg-red-50 p-3 text-sm">
          <div className="font-medium text-red-800">{v.code} · {v.message}</div>
          <div className="text-red-700/80">{v.suggestion}</div>
          {AUTO.has(v.code) && <Button className="mt-2" onClick={() => dispatch({ type: "autoFix", code: v.code as "E01" | "E04" | "E05" })}>자동 수정</Button>}
        </li>
      ))}
    </ul>
  );
}
