import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app/app-shell";

async function SavedSidebarShell({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  return <AppShell defaultSidebarOpen={defaultSidebarOpen}>{children}</AppShell>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <SavedSidebarShell>{children}</SavedSidebarShell>
    </Suspense>
  );
}
