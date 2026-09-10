"use client";
import { useRouter } from "next/navigation";
import { useDesign } from "@/components/design-provider";
import { LibraryPanel } from "@/components/library-panel";
import { Button, Card } from "@/components/ui";
import { won } from "@/lib/format";
import { buildSample, SAMPLES } from "@/lib/samples";
import { effective } from "@/lib/state";

export default function Home() {
  const { state, dispatch, loaded, result } = useDesign();
  const router = useRouter();
  const hasSaved = loaded && state.updatedAt > 0;
  return (
    <div className="space-y-10">
      <section className="max-w-2xl">
        <h1 className="font-display text-3xl text-navy">보험금을 인생 곡선에 맞춰 설계합니다</h1>
        <p className="mt-2 text-navy/70">자녀 독립·부채 상환·은퇴·상속 시점에 맞춰 연령별 보험금을 정하면 보험료·준비금·해약환급금이 바로 계산됩니다.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {hasSaved && <Button primary onClick={() => router.push("/design")}>이어서 설계 ({state.profile.age}세 {state.profile.sex === "M" ? "남" : "여"} · 월 {won(effective(result, state.payYears).monthly)})</Button>}
          <Button primary={!hasSaved} onClick={() => { dispatch({ type: "reset" }); router.push("/design"); }}>새 설계 시작</Button>
        </div>
      </section>
      <section className="max-w-3xl"><LibraryPanel /></section>
      <section>
        <h2 className="mb-3 font-display text-xl text-navy">샘플 설계</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {SAMPLES.map((s) => (
            <Card key={s.id} title={s.label}>
              <p className="text-sm text-navy/70">{s.description}</p>
              <Button className="mt-3" onClick={() => { dispatch({ type: "load", state: buildSample(s) }); router.push("/design"); }}>열기</Button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
