"use client";
import { useDesign } from "@/components/design-provider";
import { pct, won } from "@/lib/format";

const YEARS = [1, 2, 3, 5, 10, 15, 20, 30];

export function Evidence() {
  const { state, result: r } = useDesign();
  const u = r.perUnit, k = r.per100k;
  const per100k: [string, string][] = [
    ["순보험료", `${k.net.toLocaleString()}원`],
    ["기준연납순보험료", `${k.base.toLocaleString()}원`],
    ["영업보험료", `${k.gross.toLocaleString()}원`],
    ["신계약비 (적용 / 표준 / 적용값)", `${k.alpha.toLocaleString()} / ${k.alphaStd.toLocaleString()} / ${k.newBiz.toLocaleString()}원`],
  ];
  const mid: [string, string][] = [
    ["급부 현가 PVB (radix 10만)", u.pvb.toFixed(6)],
    ["월납 보정 납입기수 N*", u.nStar.toFixed(6)],
    ["β′ 포함 연납순보험료 (1단위당)", u.pBeta.toFixed(8)],
    ["보장기간 n / 최종연령 ω", `${r.n}년 / ${r.omega}세`],
  ];
  const L = r.loading;
  const loading: [string, string][] = [
    ["신계약비 α", won(L.alpha)], ["유지비 정액 β_S", won(L.betaS)], ["납입 후 유지비 β′", won(L.betaPrime)], ["유지비율 β_G", won(L.betaG)], ["수금비 γ", won(L.gamma)],
  ];
  const Table = ({ rows }: { rows: [string, string][] }) => (
    <table className="w-full text-xs"><tbody>{rows.map(([a, b]) => <tr key={a} className="border-t border-navy/10"><td className="py-1 text-navy/70">{a}</td><td className="py-1 text-right font-mono">{b}</td></tr>)}</tbody></table>
  );
  return (
    <details className="rounded-lg border border-navy/10 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer font-display text-lg text-navy">산출 근거</summary>
      <h3 className="mt-3 text-sm font-medium">10만원당 (월납 1회)</h3><Table rows={per100k} />
      <h3 className="mt-3 text-sm font-medium">중간값</h3><Table rows={mid} />
      <h3 className="mt-3 text-sm font-medium">부가보험료 분해 (가입금액 {won(state.S0)} 기준, 1회 납입)</h3><Table rows={loading} />
      <h3 className="mt-3 text-sm font-medium">해약환급금</h3>
      <table className="w-full text-xs">
        <thead><tr className="text-navy/60"><th className="py-1 text-left">경과</th><th className="text-right">납입 누계</th><th className="text-right">환급금</th><th className="text-right">환급률</th></tr></thead>
        <tbody>{YEARS.filter((t) => t <= r.n).map((t) => <tr key={t} className="border-t border-navy/10 font-mono"><td className="py-1">{t}년</td><td className="text-right">{won(r.surrender.paid[t])}</td><td className="text-right">{won(r.surrender.cash[t])}</td><td className="text-right">{pct(r.surrender.rate[t])}</td></tr>)}</tbody>
      </table>
    </details>
  );
}
