import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Play — Nook" };

export default function PlayPage() {
  return <ComingSoon title="Play" />;
}
