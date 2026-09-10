"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, Card } from "@/components/ui";
import { loadLibrary, parseImport, remove, saveLibrary, type LibraryEntry } from "@/lib/library";

/** 시작 화면의 보관함: 이 브라우저에 저장한 설계 목록 + JSON 가져오기 */
export function LibraryPanel() {
  const { dispatch } = useDesign();
  const router = useRouter();
  const [list, setList] = useState<LibraryEntry[]>([]);
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { setList(loadLibrary()); }, []);

  const open = (state: LibraryEntry["state"]) => { dispatch({ type: "load", state: { ...state, updatedAt: Date.now() } }); router.push("/design"); };
  const del = (e: LibraryEntry) => { if (!confirm(`"${e.name}"을(를) 삭제할까요?`)) return; const next = remove(list, e.id); saveLibrary(next); setList(next); };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const parsed = parseImport(await f.text());
    if (!parsed) { setMsg("설계 파일이 아닙니다"); return; }
    open(parsed.state);
  };

  return (
    <Card title={<span className="flex items-center justify-between">보관함 (이 브라우저) <span className="flex gap-2"><Button onClick={() => file.current?.click()}>JSON 가져오기</Button></span></span>}>
      <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      {msg && <p className="mb-2 text-xs text-red-700">{msg}</p>}
      {list.length === 0 ? (
        <p className="text-sm text-navy/60">저장된 설계가 없습니다. 설계 화면의 &quot;보관함에 저장&quot;으로 여러 고객의 설계를 이 브라우저에 보관할 수 있습니다. 다른 기기로 옮기려면 JSON 내보내기·가져오기나 공유 링크를 쓰세요.</p>
      ) : (
        <ul className="divide-y divide-navy/10 text-sm">
          {list.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div><div className="text-navy">{e.name}</div><div className="text-xs text-navy/50">{new Date(e.savedAt).toLocaleString("ko-KR")}</div></div>
              <div className="flex gap-2"><Button primary onClick={() => open(e.state)}>열기</Button><Button onClick={() => del(e)}>삭제</Button></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
