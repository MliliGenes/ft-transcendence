import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Feed — Nook" };

export default function FeedPage() {
  return <ComingSoon title="Feed" />;
}
