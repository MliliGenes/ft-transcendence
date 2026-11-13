"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { IconCheck, IconAlertTriangle, IconX, IconRefresh, IconArrowLeft } from "@tabler/icons-react";
import type { PlatformStatus } from "@/lib/platform-status";
import { Button } from "@/components/ui/button";

export default function StatusPage() {
  const { data, error: statusError, isFetching: loading, refetch } = useQuery<PlatformStatus>({
    queryKey: ["public", "platform-status"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/status", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Status endpoint error");
      return response.json();
    },
    refetchInterval: 15000,
    retry: false,
  });
  const error = statusError ? "Unable to reach the platform status endpoint." : null;

  const allOperational = data?.status === "operational";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <main className="max-w-3xl mx-auto px-4 py-12 w-full">
        <header className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <IconArrowLeft size={16} aria-hidden="true" /> Back to Nook
          </Link>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">System Health</p>
              <h1 className="text-3xl font-bold tracking-tight mt-1">Platform Status</h1>
            </div>
            <div className="flex items-center gap-3">
              {data && (
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={loading}
                className="gap-1.5 text-xs"
              >
                <IconRefresh size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {/* Overall Status Banner */}
        {error ? (
          <section className="p-5 rounded-lg border mb-8 flex items-center gap-4 bg-destructive/10 border-destructive/30 text-destructive">
            <div className="p-2 rounded-full bg-destructive text-white">
              <IconX size={24} stroke={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Gateway Unreachable</h2>
              <p className="text-xs opacity-90 mt-0.5">{error}</p>
            </div>
          </section>
        ) : loading && !data ? (
          <div className="p-8 rounded-lg border bg-muted/40 animate-pulse text-center text-sm text-muted-foreground mb-8">
            Checking services status…
          </div>
        ) : (
          <section
            className={`p-5 rounded-lg border mb-8 flex items-center gap-4 ${
              allOperational
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
            }`}
            aria-label="Overall System Status"
          >
            <div className={`p-2 rounded-full ${allOperational ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
              {allOperational ? <IconCheck size={24} stroke={2.5} /> : <IconAlertTriangle size={24} stroke={2.5} />}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {allOperational ? "All Systems Operational" : "Some Services Degraded"}
              </h2>
              <p className="text-xs opacity-90 mt-0.5">
                {allOperational
                  ? "All microservices and database engines are responding within nominal latency thresholds."
                  : "One or more background processes are experiencing elevated response times."}
              </p>
            </div>
          </section>
        )}

        {/* Services List */}
        <section aria-labelledby="services-heading" className="space-y-3">
          <h2 id="services-heading" className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-4">
            Service Availability
          </h2>

          <div className="divide-y divide-border border rounded-lg bg-card overflow-hidden">
            {data?.services.map((svc) => (
              <div key={svc.name} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2.5 rounded-full shrink-0 ${
                        svc.status === "operational"
                          ? "bg-emerald-500"
                          : svc.status === "degraded"
                            ? "bg-amber-500"
                            : "bg-destructive"
                      }`}
                      aria-hidden="true"
                    />
                    <h3 className="font-semibold text-sm truncate">{svc.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-4.5">{svc.description}</p>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded capitalize ${
                      svc.status === "operational"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : svc.status === "degraded"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {svc.status}
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    {svc.latencyMs}ms latency
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer info */}
        <footer className="mt-12 text-center text-xs text-muted-foreground border-t pt-6 space-y-2">
          <p>
            Nook platform infrastructure is containerized with Docker Compose and monitored with Alloy, Prometheus, and Grafana.
          </p>
          <div className="flex justify-center gap-4 text-xs">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <span>·</span>
            <Link href="/status" className="hover:underline">System Status</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
