"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDesign } from "@/components/design-provider";
import { Card } from "@/components/ui";
import { won } from "@/lib/format";
import { effective } from "@/lib/state";

export function ResultChart() {
  const { state, result: r } = useDesign();
  const eff = effective(r, state.payYears);
  const data = eff.cash.map((cash, t) => ({ t, paid: eff.paid[t], reserve: r.surrender.reserve[t], cash, std: eff.isLow ? r.surrender.cash[t] : null }));
  return (
    <Card title="준비금 · 해약환급금">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#1b284518" />
            <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} unit="년" fontSize={11} tickCount={8} />
            <YAxis width={64} fontSize={11} tickFormatter={(v: unknown) => `${Math.round(Number(v) / 1e4).toLocaleString()}만`} />
            <Tooltip labelFormatter={(t) => `${t}년 경과`} formatter={(v: unknown) => won(Number(v))} />
            <Legend />
            <Line dataKey="paid" name="납입 누계" stroke="#94a3b8" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            <Line dataKey="reserve" name="준비금" stroke="#4a90c2" dot={false} isAnimationActive={false} />
            <Line dataKey="cash" name={`해약환급금${eff.isLow ? " (저해지)" : ""}`} stroke="#1b2845" strokeWidth={2} dot={false} isAnimationActive={false} />
            {eff.isLow && <Line dataKey="std" name="표준형 환급금 (참고)" stroke="#94a3b8" strokeWidth={1} dot={false} isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
