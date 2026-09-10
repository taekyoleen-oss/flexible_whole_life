import { parseFormula } from "@/lib/formula-text";

/** 평문 수식을 실제 아래·위첨자로. block이면 줄바꿈을 살린 수식 상자 */
export function FormulaText({ text, block = false, className = "" }: { text: string; block?: boolean; className?: string }) {
  const segs = parseFormula(text).map((x, i) => x.kind === "text" ? x.text : x.kind === "sub" ? <sub key={i}>{x.text}</sub> : <sup key={i}>{x.text}</sup>);
  return block
    ? <div className={`overflow-x-auto whitespace-pre-wrap rounded bg-cream p-3 font-mono text-sm leading-relaxed text-navy ${className}`}>{segs}</div>
    : <span className={className}>{segs}</span>;
}
