"use client";

import { useParams } from "next/navigation";
import { DetailView } from "@/components/detail";

export default function TvDetailPage() {
  const params = useParams<{ id: string }>();
  return <DetailView type="tv" slug={String(params?.id ?? "")} />;
}
