"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DesignProvider, useDesign } from "@/components/design-provider";
import { SharedView } from "@/components/shared/shared-view";
import { decodeShare, SHARE_VERSION, type SharePayload } from "@/lib/share";

export default function SharePage() {
  const root = useDesign();                       // 레이아웃의 Provider(내 설계)
  const router = useRouter();
  const [payload, setPayload] = useState<SharePayload | null | undefined>(undefined);
  useEffect(() => { decodeShare(location.hash).then(setPayload); }, []);
  if (payload === undefined) return <p className="text-sm text-navy/60">불러오는 중…</p>;
  if (payload === null) return <p className="text-sm text-red-700">링크가 올바르지 않거나 지원하지 않는 형식입니다.</p>;
  const importIt = () => {
    if (root.state.updatedAt > 0 && !confirm("현재 설계를 이 링크의 설계로 바꿉니다. 계속할까요?")) return;
    root.dispatch({ type: "load", state: { ...payload.state, updatedAt: Date.now() } });
    router.push("/design");
  };
  return (
    <>
      {payload.app !== SHARE_VERSION && <p className="mb-2 text-xs text-amber-700">다른 버전({payload.app})에서 만든 링크입니다. 값이 조금 다를 수 있습니다.</p>}
      <DesignProvider initial={payload.state} persist={false}>
        <SharedView app={payload.app} onImport={importIt} />
      </DesignProvider>
    </>
  );
}
