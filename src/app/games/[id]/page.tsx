"use client";

import { useParams } from "next/navigation";
import { DetailView } from "@/components/detail";

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  return <DetailView type="game" slug={String(params?.id ?? "")} />;
}
