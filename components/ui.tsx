"use client";
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { clamp } from "@/lib/format";

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-navy/10 bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 font-display text-lg text-navy">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-navy/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy/50">{hint}</span>}
    </label>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded border border-navy/20 px-2 py-1.5 font-mono text-sm focus:border-sky focus:outline-none ${className}`} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded border border-navy/20 bg-white px-2 py-1.5 text-sm ${className}`} />;
}

export function Button({ primary, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  const look = primary ? "bg-sky text-white hover:bg-sky/90" : "border border-navy/20 text-navy hover:bg-navy/5";
  return <button type="button" {...props} className={`rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${look} ${className}`} />;
}

/** 숫자 입력. 타이핑 중에는 로컬 문자열을 쓰고, blur/Enter에 숫자로 확정한다(clamp로 값이 튀지 않게). */
export function NumInput({ value, onCommit, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "onBlur" | "onKeyDown"> & { value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (text.trim() !== "" && Number.isFinite(n) && n !== value) onCommit(n);
    setText(String(value)); // 부모가 clamp해 되돌려도 표시를 맞춘다; value가 바뀌면 effect가 다시 덮는다
  };
  return <Input {...rest} type="number" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />;
}

/** 만원 단위 입력. value·onChange는 원. min/max/step은 만원. */
export function ManwonInput({ value, onChange, min = 0, max = 1e6, step = 1 }: { value: number; onChange: (won: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="flex items-center gap-1">
      <NumInput value={Math.round(value / 1e4)} min={min} max={max} step={step} inputMode="numeric"
        onCommit={(n) => onChange(clamp(Math.round(n * 1e4), min * 1e4, max * 1e4))} />
      <span className="shrink-0 text-sm text-navy/60">만원</span>
    </div>
  );
}
