"use client";
import Link from "next/link";
import { useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button } from "@/components/ui";
import { autoName, downloadJson, exportJson, loadLibrary, saveLibrary, upsert } from "@/lib/library";
import { encodeShare } from "@/lib/share";

export function DesignToolbar() {
  const { state } = useDesign();
  const [msg, setMsg] = useState("");
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 2500); };
  const share = async () => {
    const url = `${location.origin}/s#${await encodeShare(state)}`;
    try { await navigator.clipboard.writeText(url); flash("공유 링크를 복사했습니다"); }
    catch { window.prompt("복사해서 보내세요", url); }
  };
  const save = () => {
    const name = window.prompt("보관함에 저장할 이름", autoName(state));
    if (!name?.trim()) return;
    saveLibrary(upsert(loadLibrary(), { id: String(Date.now()), name: name.trim(), savedAt: Date.now(), state }));
    flash(`"${name.trim()}" 저장됨 · 시작 화면 보관함에서 열 수 있습니다`);
  };
  const exportFile = () => {
    const name = autoName(state);
    downloadJson(`설계_${name.replace(/[^\w가-힣]+/g, "_")}.json`, exportJson(state, name));
  };
  const link = "rounded border border-navy/20 px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy/5";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button primary onClick={save}>보관함에 저장</Button>
      <Button onClick={exportFile}>JSON 내보내기</Button>
      <Button onClick={share}>공유 링크 복사</Button>
      <Link href="/compare" className={link}>같은 예산 3안 비교</Link>
      <Link href="/print" className={link}>제안서 인쇄</Link>
      <Link href="/settings" className={link}>설정</Link>
      {msg && <span className="text-xs text-emerald-700">{msg}</span>}
    </div>
  );
}
