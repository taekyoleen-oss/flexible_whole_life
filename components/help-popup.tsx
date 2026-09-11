"use client";
import { useRef, type ReactNode } from "react";
import { Button, onBackdropClick } from "@/components/ui";

/** "?" 버튼 + 짧은 설명 팝업 (수식 없이 근거만 보여줄 때) */
export function HelpPopup({ title, children, label = "근거" }: { title: string; children: ReactNode; label?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" aria-label={`${title} ${label}`} title={`${title} ${label}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-navy/30 align-middle text-[10px] leading-none text-navy/60 hover:bg-sky/10 hover:text-sky print:hidden"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); dlg.current?.showModal(); }}>?</button>
      <dialog ref={dlg} className="m-auto w-[min(92vw,560px)] whitespace-normal rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50"
        onClick={(e) => { e.stopPropagation(); onBackdropClick(e); }}>
        <h3 className="font-display text-lg text-navy">{title} · {label}</h3>
        <div className="mt-3 text-sm text-ink">{children}</div>
        <div className="mt-4 flex justify-end"><Button onClick={() => dlg.current?.close()}>닫기</Button></div>
      </dialog>
    </>
  );
}
