"use client";
import Link from "next/link";
import { useDesign } from "@/components/design-provider";
import { PRODUCT_LABEL } from "@/lib/state";

/** 헤더 브랜드: 현재 설계 중인 상품 이름 */
export function ProductTitle() {
  const { state } = useDesign();
  return <Link href="/" className="font-display text-xl text-navy">{PRODUCT_LABEL[state.profile.product]}</Link>;
}
