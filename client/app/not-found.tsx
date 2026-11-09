import type { Metadata } from "next";
import { ErrorPage } from "@/components/error-page";

export const metadata: Metadata = { title: "Page not found — Nook" };

export default function NotFound() {
  return (
    <ErrorPage
      standalone
      code="404"
      eyebrow="Page not found"
      title="This nook doesn’t exist"
      description="The page you’re looking for may have moved, been removed, or the link might be incorrect."
    />
  );
}
