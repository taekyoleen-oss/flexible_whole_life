"use client";
import { useRef } from "react";
import { Button } from "@/components/ui";
import { getFormula, type FormulaId } from "@/lib/formulas";

/** 숫자 옆의 "?" 버튼. 누르면 그 값의 산출 수식·의미·변수를 팝업으로 보여준다 */
export function FormulaHelp({ id, className = "" }: { id: FormulaId; className?: string }) {
  const f = getFormula(id);
  const dlg = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" aria-label={`${f.title} 수식 설명`} title={f.title}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-navy/30 align-middle text-[10px] leading-none text-navy/60 hover:bg-sky/10 hover:text-sky print:hidden ${className}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); dlg.current?.showModal(); }}>?</button>
      <dialog ref={dlg} className="m-auto w-[min(92vw,640px)] rounded-lg bg-white p-5 text-left shadow-xl backdrop:bg-navy/50"
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="mb-1 text-xs text-navy/50">{f.group}</div>
        <h3 className="font-display text-lg text-navy">{f.title}</h3>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded bg-cream p-3 font-mono text-sm text-navy">{f.formula}</pre>
        <p className="mt-3 text-sm text-ink">{f.meaning}</p>
        {f.vars.length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {f.vars.map(([k, v]) => <div key={k} className="contents"><dt className="font-mono text-navy">{k}</dt><dd className="text-navy/70">{v}</dd></div>)}
          </dl>
        )}
        <p className="mt-3 text-xs text-navy/50">앱에서: {f.where}</p>
        <div className="mt-4 flex justify-end"><Button onClick={() => dlg.current?.close()}>닫기</Button></div>
      </dialog>
    </>
  );
}
