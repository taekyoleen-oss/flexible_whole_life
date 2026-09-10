"use client";
import Link from "next/link";
import { useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button } from "@/components/ui";
import { encodeShare } from "@/lib/share";

export function DesignToolbar() {
  const { state } = useDesign();
  const [msg, setMsg] = useState("");
  const share = async () => {
    const url = `${location.origin}/s#${await encodeShare(state)}`;
    try { await navigator.clipboard.writeText(url); setMsg("공유 링크를 복사했습니다"); }
    catch { window.prompt("복사해서 보내세요", url); }
    setTimeout(() => setMsg(""), 2500);
  };
  const link = "rounded border border-navy/20 px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy/5";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Link href="/compare" className={link}>같은 예산 3안 비교</Link>
      <Link href="/print" className={link}>제안서 인쇄</Link>
      <Button onClick={share}>공유 링크 복사</Button>
      <Link href="/settings" className={link}>설정</Link>
      {msg && <span className="text-xs text-emerald-700">{msg}</span>}
    </div>
  );
}
