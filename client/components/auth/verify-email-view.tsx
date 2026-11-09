"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { authApi, AuthRequestError } from "@/lib/auth/client";

type State = "checking" | "verified" | "invalid" | "missing" | "error";

export function VerifyEmailView() {
  // The verification token is single-use, so the request must run exactly once
  // even though React may run effects twice in development.
  const started = useRef(false);
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    // Keep the token out of the address bar, history and referrers.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!token) {
      setState("missing");
      return;
    }

    authApi.verifyEmail(token)
      .then(() => setState("verified"))
      .catch(error => {
        setState(error instanceof AuthRequestError && (error.status === 401 || error.status === 400) ? "invalid" : "error");
      });
  }, []);

  return (
    <section aria-labelledby="verify-title" className="w-full max-w-[420px]">
      <div className="mb-8 text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-nook-accent-text">Email verification</p>
        <h1 id="verify-title" className="text-3xl font-semibold tracking-tight">
          {state === "verified" ? "Email verified" : state === "checking" ? "Verifying your email" : "We couldn’t verify your email"}
        </h1>
      </div>

      {state === "checking" && (
        <p role="status" className="text-center text-sm text-muted-foreground">Checking your verification link…</p>
      )}

      {state === "verified" && (
        <div role="status" className="border border-border bg-card p-5">
          <p className="flex items-start gap-3 text-sm leading-6">
            <IconCheck size={18} className="mt-0.5 shrink-0 text-nook-success" aria-hidden="true" />
            Thanks! Your email address is confirmed.
          </p>
          <Button render={<Link href="/login" />} className="mt-5 min-h-11">Continue to Nook</Button>
        </div>
      )}

      {(state === "invalid" || state === "missing" || state === "error") && (
        <div role="alert" className="border border-border bg-card p-5">
          <p className="flex items-start gap-3 text-sm leading-6">
            <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
            {state === "missing"
              ? "This verification link is missing its token."
              : state === "invalid"
                ? "This verification link is invalid, has expired, or was already used. If you already verified your email, you can simply log in."
                : "Something went wrong while verifying your email. Please try the link again in a moment."}
          </p>
          <Button render={<Link href="/login" />} className="mt-5 min-h-11">Go to log in</Button>
        </div>
      )}
    </section>
  );
}
