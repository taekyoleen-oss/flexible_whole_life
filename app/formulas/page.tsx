import { FORMULAS } from "@/lib/formulas";

export const metadata = { title: "산출 수식 설명 · 설계형 종신보험" };

/** docs/산출수식_설명.md와 같은 원본(lib/formulas.json)을 화면으로 */
export default function FormulasPage() {
  const groups = [...new Set(FORMULAS.map((f) => f.group))];
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl text-navy">산출 수식 설명</h1>
        <p className="mt-1 text-sm text-navy/60">앱의 각 숫자 옆 &quot;?&quot; 버튼이 보여주는 내용을 한곳에 모았습니다. 기호: x 가입연령, t 경과년, n 보장기간, m 납입기간, S_t 사망보험금 배수, C_t 축하금 배수, S_0 기준보험금, v = 1/(1+예정이율). ′는 납입면제를 반영한 납입 집단 기준입니다.</p>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm">{groups.map((g) => <a key={g} href={`#${g}`} className="rounded border border-navy/20 px-2 py-0.5 text-navy hover:bg-navy/5">{g}</a>)}</nav>
      </div>
      {groups.map((g) => (
        <section key={g} id={g} className="space-y-4">
          <h2 className="font-display text-xl text-navy">{g}</h2>
          {FORMULAS.filter((f) => f.group === g).map((f) => (
            <article key={f.id} id={f.id} className="rounded-lg border border-navy/10 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-navy">{f.title}</h3>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-cream p-3 font-mono text-sm text-navy">{f.formula}</pre>
              <p className="mt-2 text-sm">{f.meaning}</p>
              {f.vars.length > 0 && <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">{f.vars.map(([k, v]) => <div key={k} className="contents"><dt className="font-mono text-navy">{k}</dt><dd className="text-navy/70">{v}</dd></div>)}</dl>}
              <p className="mt-2 text-xs text-navy/50">앱에서: {f.where}</p>
            </article>
          ))}
        </section>
      ))}
      <p className="text-xs text-navy/50">엔진은 워크북 원본 정답값(G1 정기 31세 10만원당 133원, G2 종신공제 59세 2,875원)을 1원 단위로 재현하는 골든 테스트를 통과합니다. 설정 화면의 &quot;검산&quot;에서 G1을 확인할 수 있습니다.</p>
    </div>
  );
}
