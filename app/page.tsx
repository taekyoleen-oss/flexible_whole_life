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
        <h1 className="font-display text-3xl text-navy">보험금을 인생 곡선에 맞춰 직접 설계합니다</h1>
        <p className="mt-2 text-navy/70">지금까지는 보험사가 정한 보험금 구조에 계약자가 보험료를 맞췄습니다. 이 상품은 반대로, 계약자가 자녀 독립·부채 상환·은퇴·상속 시점에 맞춰 연령별 보험금을 직접 정하고 보험료·준비금·해약환급금을 바로 확인합니다. 프리셋은 근거 있는 출발점이고, 최종 모양은 계약자가 그립니다.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {hasSaved && <Button primary onClick={() => router.push("/design")}>이어서 설계 ({state.profile.age}세 {state.profile.sex === "M" ? "남" : "여"} · 월 {won(effective(result, state.payYears).monthly)})</Button>}
          <Button primary={!hasSaved} onClick={() => { if (hasSaved && !confirm("현재 설계를 지우고 새로 시작합니다. 보관함에 저장하지 않은 설계는 사라집니다.")) return; dispatch({ type: "reset" }); router.push("/design"); }}>새 설계 시작</Button>
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
