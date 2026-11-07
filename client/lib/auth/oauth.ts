export type OAuthProvider = "discord" | "github";
export type OAuthFlow = "login" | "link";
export type OAuthError = "authorization" | "conflict" | "configuration" | "unavailable";
export type OAuthNotice = {
  flow: OAuthFlow;
  provider: OAuthProvider | null;
  result: "linked" | "error";
  error?: OAuthError;
};
type OAuthReturn = { route: "/settings" | "/login"; notice: OAuthNotice };

const noticeKey = "nook:oauth-notice";
const pendingProviderKey = "nook:oauth-provider";

function isProvider(value: string | null): value is OAuthProvider {
  return value === "discord" || value === "github";
}

export function parseOAuthReturn(hash: string, pendingProvider: string | null): OAuthReturn | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const linkedProvider = params.get("providerLinked");
  if (isProvider(linkedProvider)) {
    return {
      route: "/settings" as const,
      notice: { flow: "link" as const, provider: linkedProvider, result: "linked" as const },
    };
  }

  const flow = params.get("oauthFlow");
  const error = params.get("oauthError");
  if ((flow !== "login" && flow !== "link") || !isOAuthError(error)) {
    return null;
  }

  const callbackProvider = params.get("oauthProvider");
  const provider = isProvider(callbackProvider)
    ? callbackProvider
    : isProvider(pendingProvider) ? pendingProvider : null;

  return {
    route: flow === "link" ? "/settings" as const : "/login" as const,
    notice: { flow, provider, result: "error" as const, error },
  };
}

function isOAuthError(value: string | null): value is OAuthError {
  return value === "authorization" || value === "conflict" || value === "configuration" || value === "unavailable";
}

export function saveOAuthNotice(notice: OAuthNotice) {
  sessionStorage.setItem(noticeKey, JSON.stringify(notice));
}

export function takeOAuthNotice(flow: OAuthFlow): OAuthNotice | null {
  const value = sessionStorage.getItem(noticeKey);
  if (!value) return null;
  sessionStorage.removeItem(noticeKey);

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || !("flow" in parsed) || parsed.flow !== flow
      || !("result" in parsed) || (parsed.result !== "linked" && parsed.result !== "error")
      || !("provider" in parsed) || (parsed.provider !== null && parsed.provider !== "discord" && parsed.provider !== "github")
      || ("error" in parsed && parsed.error !== undefined && parsed.error !== "authorization" && parsed.error !== "conflict"
        && parsed.error !== "configuration" && parsed.error !== "unavailable")) {
      return null;
    }
    return parsed as OAuthNotice;
  } catch {
    return null;
  }
}

export function rememberOAuthProvider(provider: OAuthProvider) {
  sessionStorage.setItem(pendingProviderKey, provider);
}

export function takePendingOAuthProvider() {
  const provider = sessionStorage.getItem(pendingProviderKey);
  sessionStorage.removeItem(pendingProviderKey);
  return provider;
}

export function oauthNoticeMessage(notice: OAuthNotice) {
  const providerName = notice.provider === "github" ? "GitHub" : notice.provider === "discord" ? "Discord" : "The provider";
  if (notice.result === "linked") return `${providerName} is connected to your Nook account.`;
  if (notice.error === "conflict") return `${providerName} is already connected to another Nook account.`;
  if (notice.error === "configuration" || notice.error === "unavailable") return `${providerName} sign-in is temporarily unavailable. Please try again later.`;
  return `${providerName} authorization was cancelled or expired. Please try again.`;
}
