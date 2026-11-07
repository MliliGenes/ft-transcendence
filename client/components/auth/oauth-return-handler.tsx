"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { parseOAuthReturn, saveOAuthNotice, takePendingOAuthProvider } from "@/lib/auth/oauth";

export function OAuthReturnHandler() {
  const { isRestoring, session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || isRestoring) return;

    const hash = window.location.hash;
    const isOAuthReturn = /(?:^#|&)providerLinked=|(?:^#|&)oauthError=/.test(hash);
    const result = parseOAuthReturn(hash, isOAuthReturn ? takePendingOAuthProvider() : null);
    if (result) {
      handled.current = true;
      saveOAuthNotice(result.notice);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      router.replace(result.route);
      return;
    }

    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (pathname === "/" && session) router.replace("/feed");
  }, [isRestoring, pathname, router, session]);

  return null;
}
