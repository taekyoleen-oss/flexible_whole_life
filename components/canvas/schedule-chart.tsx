"use client";
import { useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { useDesign } from "@/components/design-provider";
import { Button, Card } from "@/components/ui";
import { FIX_YEARS } from "@/lib/engine";
import { mult, won } from "@/lib/format";

export function ScheduleChart() {
  const { state, result } = useDesign();
  const [amount, setAmount] = useState(true);
  const k = amount ? state.S0 : 1;
  const age = state.profile.age;
  const data = result.S.map((s, t) => ({ age: age + t, death: s * k, celebration: result.C[t] > 0 ? result.C[t] * k : null }));
  const fmt = (v: number) => (amount ? won(v) : mult(v));
  return (
    <Card title={<span className="flex items-center justify-between">보험금 스케줄 <Button onClick={() => setAmount(!amount)}>{amount ? "배수로 보기" : "금액으로 보기"}</Button></span>}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#1b284518" />
            <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} tickCount={8} unit="세" fontSize={11} />
            <YAxis width={64} fontSize={11} tickFormatter={(v: unknown) => (amount ? `${Math.round(Number(v) / 1e4).toLocaleString()}만` : `${Number(v)}배`)} />
            <Tooltip labelFormatter={(a: unknown) => `${a}세`} formatter={(v: unknown) => fmt(Number(v))} />
            <ReferenceArea x1={age} x2={age + FIX_YEARS} fill="#4a90c2" fillOpacity={0.12} label={{ value: "초기 고정", position: "insideTopLeft", fontSize: 11, fill: "#1b2845" }} />
            <Line type="stepAfter" dataKey="death" name="사망보험금" stroke="#1b2845" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter dataKey="celebration" name="축하금" fill="#4a90c2" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
