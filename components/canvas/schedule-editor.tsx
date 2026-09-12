"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useDesign } from "@/components/design-provider";
import { won, wonShort } from "@/lib/format";
import { addonCurve, addonLabel } from "@/lib/engine";
import { allowedRange, assumptionOf, celebrations, endAgeOf, envelopeOf, firstEditableAge, STEP, type LevelBase } from "@/lib/state";
import { ADDON_COLORS } from "./addons-panel";

const M = { left: 64, right: 16, top: 18, bottom: 28 };
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
/** 선·면 위에서도 읽히도록 글자에 흰 테두리를 두른다 */
const halo = { paintOrder: "stroke" as const, stroke: "#ffffff", strokeWidth: 3, strokeLinejoin: "round" as const };

/** 컨테이너 폭을 ResizeObserver로 읽는다 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * 보험금 스케줄 편집기. 연령을 클릭·드래그하거나 화살표 키로 배수를 STEP 단위로 바꾼다.
 * 규칙(허용 범위·하한·뒤 구간 이동)은 전부 lib/state의 allowedRange·level 액션에 있다.
 */
export function ScheduleEditor({ height, amount, readOnly = false }: { height: number; amount: boolean; readOnly?: boolean }) {
  const { state, dispatch, result } = useDesign();
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<{ age: number; base: LevelBase; py0: number; moved: boolean } | null>(null);   // py0: 누른 위치. 이동량을 그 기준으로 재서 살짝 눌러도 값이 튀지 않는다

  const x0 = state.profile.age, n = result.n, S = result.S, S0 = state.S0;
  const env = envelopeOf(state);
  const first = firstEditableAge(state.profile, env), endAge = endAgeOf(state.profile);
  // 추가 조건은 원 단위 곡선을 기준보험금 배수로 환산해 별도 선으로 그린다(결합 전에는 스케줄에 영향 없음)
  const addons = state.addons.map((a, i) => ({ a, color: ADDON_COLORS[i % ADDON_COLORS.length], m: addonCurve(a, n, assumptionOf(state).needs.independenceAge).map((v) => v / S0) }));
  const yMax = Math.max(env.maxMultiple, Math.ceil((Math.max(...S, ...addons.flatMap((x) => x.m)) + 0.3) * 2) / 2);
  const W = Math.max(width, 320), H = height;
  const pw = W - M.left - M.right, ph = H - M.top - M.bottom;
  const xs = (age: number) => M.left + ((age - x0) / n) * pw;
  const ys = (m: number) => M.top + ph - (m / yMax) * ph;
  const ageAt = (px: number) => Math.min(endAge, Math.max(x0, Math.round(x0 + ((px - M.left) / pw) * n)));
  const levelAt = (py: number) => ((M.top + ph - py) / ph) * yMax;
  const at = (age: number) => S[Math.min(Math.max(age - x0, 0), n - 1)];
  const label = (m: number) => (amount ? won(m * S0) : `${r4(m)}배`);

  const line = S.map((m, t) => `${t === 0 ? "M" : "L"}${xs(x0 + t)},${ys(m)} L${xs(x0 + t + 1)},${ys(m)}`).join(" ");
  const area = `${line} L${xs(x0 + n)},${ys(0)} L${xs(x0)},${ys(0)} Z`;

  const pos = (e: PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
  /** 누른 위치에서 움직인 만큼을 칸 수로 양자화해 dispatch. 드래그 시작 시점(base)을 기준으로 계산하므로 되돌리면 원래대로 온다 */
  const moveTo = (d: NonNullable<typeof drag.current>, py: number) => {
    const r = allowedRange(state, d.age, d.base);
    if (!r.editable) return;
    const k = Math.round((levelAt(py) - levelAt(d.py0)) / STEP);
    if (k === 0 && !d.moved) return;   // 아직 한 칸도 안 움직였으면 손대지 않는다(더블클릭 사이의 떨림 등)
    d.moved = true;
    dispatch({ type: "level", age: d.age, multiple: r.prev + k * STEP, base: d.base });
  };
  /** 클릭은 선택만 한다. 값은 움직일 때(onMove)만 바뀐다. 더블클릭의 두 번째 누름은 드래그로 잡지 않는다 */
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    const { px, py } = pos(e);
    const age = ageAt(px);
    setSelected(age);
    e.currentTarget.focus({ preventScroll: true });
    if (age < first || e.detail >= 2) return;
    drag.current = { age, base: { S: S.slice(), anchors: state.anchors }, py0: py, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const { px, py } = pos(e);
    if (drag.current) moveTo(drag.current, py);
    else setHover(ageAt(px));
  };
  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  /** 더블클릭: 그 연령의 값으로 이후를 평탄하게 */
  const onDouble = (e: PointerEvent<SVGSVGElement>) => { drag.current = null; const age = ageAt(pos(e).px); if (age >= first) dispatch({ type: "flatten", age }); };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "Escape") { setSelected(null); return; }
    if (selected === null) return;
    if (e.key === "ArrowLeft") setSelected(Math.max(x0, selected - 1));
    else if (e.key === "ArrowRight") setSelected(Math.min(endAge, selected + 1));
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") dispatch({ type: "level", age: selected, multiple: at(selected) + (e.key === "ArrowUp" ? STEP : -STEP) });
    else return;
    e.preventDefault();
  };

  const focus = drag.current?.age ?? selected ?? hover;
  const range = focus === null ? null : allowedRange(state, focus, drag.current?.base);
  const cels = celebrations(state.blocks);
  const gridLevels = Array.from({ length: Math.round(yMax / STEP) + 1 }, (_, i) => r4(i * STEP));
  const xTicks: number[] = [];
  for (let a = x0; a <= x0 + n; a += 5) xTicks.push(a);

  return (
    <div ref={box} className="w-full select-none overflow-x-auto">
      <svg width={W} height={H} tabIndex={readOnly ? -1 : 0} role={readOnly ? "img" : "application"}
        aria-label={readOnly ? "보험금 스케줄" : `보험금 스케줄 편집기. ${first}세 이후 연령을 클릭하고 위아래로 드래그하거나 화살표 키로 조정`}
        className="block touch-none rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky"
        style={{ cursor: !readOnly && focus !== null && focus >= first ? "ns-resize" : "default" }}
        onPointerDown={readOnly ? undefined : onDown} onPointerMove={readOnly ? undefined : onMove} onPointerUp={readOnly ? undefined : onUp} onPointerCancel={readOnly ? undefined : onUp}
        onPointerLeave={readOnly ? undefined : () => setHover(null)} onKeyDown={readOnly ? undefined : onKey} onDoubleClick={readOnly ? undefined : onDouble}>
        <rect x={xs(x0)} y={M.top} width={xs(first) - xs(x0)} height={ph} fill="#4a90c2" fillOpacity={0.1} />
        {gridLevels.map((m) => (
          <line key={m} x1={M.left} x2={W - M.right} y1={ys(m)} y2={ys(m)} stroke="#1b2845" strokeOpacity={Math.round(m * 10) % 5 === 0 ? 0.15 : 0.05} />
        ))}
        {gridLevels.filter((m) => Math.round(m * 10) % 5 === 0).map((m) => (
          <text key={m} x={M.left - 6} y={ys(m) + 4} fontSize={11} textAnchor="end" fill="#1b2845">
            {amount ? wonShort(m * S0) : `${m}배`}
          </text>
        ))}
        {xTicks.map((a) => (
          <g key={a}>
            <line x1={xs(a)} x2={xs(a)} y1={M.top} y2={M.top + ph} stroke="#1b2845" strokeOpacity={0.08} />
            <text x={xs(a)} y={H - 8} fontSize={11} textAnchor="middle" fill="#1b2845">{a}세</text>
          </g>
        ))}
        <path d={area} fill="#1b2845" fillOpacity={0.06} />
        <path d={line} fill="none" stroke="#1b2845" strokeWidth={2.5} />
        {addons.map(({ a, color, m }) => {
          const d = m.map((v, t) => `${t === 0 ? "M" : "L"}${xs(x0 + t)},${ys(v)} L${xs(x0 + t + 1)},${ys(v)}`).join(" ");
          return (
            <g key={a.id}>
              <path d={d} fill="none" stroke={color} strokeWidth={2} strokeDasharray="6 3" />
              <text x={xs(x0) + 6} y={ys(m[0]) - 6} fontSize={11} fill={color} {...halo}>{addonLabel(a)} {label(m[0])}</text>
            </g>
          );
        })}
        {state.anchors.map((a) => (
          <rect key={a} x={xs(a) - 4} y={ys(at(a)) - 4} width={8} height={8} transform={`rotate(45 ${xs(a)} ${ys(at(a))})`} fill="#1b2845" stroke="#fff" strokeWidth={1.5}>
            <title>{a}세 변경점</title>
          </rect>
        ))}
        <text x={xs(x0) + 6} y={M.top + 14} fontSize={11} fill="#1b2845" {...halo}>초기 고정 {x0}~{first - 1}세</text>
        {cels.map((c) => (
          <g key={c.fromAge}>
            <circle cx={xs(c.fromAge)} cy={ys(at(c.fromAge))} r={6} fill="#4a90c2" stroke="#fff" strokeWidth={2} />
            <text x={xs(c.fromAge)} y={ys(at(c.fromAge)) - 12} fontSize={11} textAnchor="middle" fill="#1b2845" {...halo}>축하금 {won(c.multiple * S0)}</text>
          </g>
        ))}
        {focus !== null && range && (
          <g>
            <line x1={xs(focus)} x2={xs(focus)} y1={M.top} y2={M.top + ph} stroke="#4a90c2" strokeDasharray="3 3" />
            {range.editable && <rect x={xs(focus) - 3} y={ys(range.max)} width={6} height={Math.max(2, ys(range.min) - ys(range.max))} rx={3} fill="#4a90c2" fillOpacity={0.35} />}
            <circle cx={xs(focus)} cy={ys(at(focus))} r={5} fill="#fff" stroke="#4a90c2" strokeWidth={2} />
            <text x={Math.min(xs(focus) + 8, W - 190)} y={Math.max(M.top + 30, ys(at(focus)) - 10)} fontSize={12} fontWeight={600} fill="#1b2845" {...halo}>{focus}세 {label(at(focus))}</text>
            <text x={Math.min(xs(focus) + 8, W - 190)} y={Math.max(M.top + 44, ys(at(focus)) + 4)} fontSize={11} fill={range.editable ? "#1b2845" : "#b91c1c"} {...halo}>
              {range.editable ? `${range.ref}세 기준 ±${range.steps}칸 (${range.min}~${range.max}배)` : "고정 구간 (편집 불가)"}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
