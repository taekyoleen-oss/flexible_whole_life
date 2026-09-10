"use client";
import { useRouter } from "next/navigation";
import { BudgetFields, ContractFields } from "@/components/canvas/budget-panel";
import { RecommendCard } from "@/components/canvas/recommend-card";
import { useDesign } from "@/components/design-provider";
import { Button, Card, Field, Input, ManwonInput, NumInput, Select } from "@/components/ui";
import type { Profile } from "@/lib/state";

const parseAges = (s: string) => s.split(/[,\s]+/).filter(Boolean).map(Number).filter(Number.isFinite);

export default function StartPage() {
  const { state, dispatch, loaded } = useDesign();
  const router = useRouter();
  if (!loaded) return null;
  const p = state.profile;
  const setP = (patch: Partial<Profile>) => dispatch({ type: "profile", patch });
  const kids = p.childrenAges.join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-2xl text-navy">고객 정보 입력</h1>
      <p className="text-sm text-navy/60">필수는 성별·연령·예산 세 가지입니다. 나머지는 기본값으로 진행할 수 있습니다.</p>

      <Card title="1. 피보험자">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="성별">
            <Select value={p.sex} onChange={(e) => setP({ sex: e.target.value as Profile["sex"] })}><option value="M">남</option><option value="F">여</option></Select>
          </Field>
          <Field label="가입연령" hint="15~70세"><NumInput value={p.age} min={15} max={70} onCommit={(n) => setP({ age: n })} /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" className="accent-sky" checked={p.hasSpouse} onChange={(e) => setP({ hasSpouse: e.target.checked })} />배우자 있음</label>
        </div>
      </Card>

      <Card title="2. 가족">
        <Field label="자녀 나이" hint="쉼표로 구분. 예: 3, 6 (없으면 비움)">
          <Input key={kids} defaultValue={kids} placeholder="3, 6"
            onBlur={(e) => { const a = parseAges(e.target.value); e.target.value = a.join(", "); setP({ childrenAges: a }); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        </Field>
      </Card>

      <Card title="3. 재무">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="연소득"><ManwonInput value={p.income} onChange={(v) => setP({ income: v })} max={1e5} /></Field>
          <Field label="유동자산"><ManwonInput value={p.liquidAssets} onChange={(v) => setP({ liquidAssets: v })} max={1e6} /></Field>
          <Field label="부채 잔액"><ManwonInput value={p.debt} onChange={(v) => setP({ debt: v })} max={1e6} /></Field>
          <Field label="부채 만기까지" hint="년"><NumInput value={p.debtYears} min={1} max={40} onCommit={(n) => setP({ debtYears: n })} /></Field>
          <Field label="은퇴 예정 연령"><NumInput value={p.retirementAge} min={40} max={80} onCommit={(n) => setP({ retirementAge: n })} /></Field>
        </div>
      </Card>

      <Card title="4. 기존 보장">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="단체보험 보험금"><ManwonInput value={p.groupCover} onChange={(v) => setP({ groupCover: v })} max={1e6} /></Field>
          <Field label="단체보험 만기 나이"><NumInput value={p.groupCoverEndAge} min={20} max={80} onCommit={(n) => setP({ groupCoverEndAge: n })} /></Field>
          <Field label="정기보험 보험금"><ManwonInput value={p.termCover} onChange={(v) => setP({ termCover: v })} max={1e6} /></Field>
          <Field label="정기보험 만기 나이"><NumInput value={p.termCoverEndAge} min={20} max={100} onCommit={(n) => setP({ termCoverEndAge: n })} /></Field>
        </div>
      </Card>

      <RecommendCard />

      <Card title="5. 예산·계약">
        <div className="grid gap-6 sm:grid-cols-2">
          <BudgetFields />
          <ContractFields />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={() => dispatch({ type: "reset" })}>기본값으로</Button>
        <Button primary onClick={() => router.push("/design")}>설계로 이동 →</Button>
      </div>
    </div>
  );
}
