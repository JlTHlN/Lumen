"use client";

import { useParams } from "next/navigation";
import { DetailView } from "@/components/detail";

export default function MovieDetailPage() {
  const params = useParams<{ id: string }>();
  return <DetailView type="movie" slug={String(params?.id ?? "")} />;
}
