export const PROD_API_BASE = "https://xtipeal88c.execute-api.us-east-1.amazonaws.com";
const API_MODE_STORAGE_KEY = "arcade_api_mode";

function isLocalhost(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  );
}

export function resolveDefaultApiBase(): string {
  return (
    (import.meta.env.VITE_API_BASE as string | undefined)?.trim() ||
    (isLocalhost() ? "/api" : PROD_API_BASE)
  );
}

export function resolveApiBase(): string {
  const fallback = resolveDefaultApiBase();
  if (!isLocalhost()) return fallback;

  try {
    const mode = window.localStorage.getItem(API_MODE_STORAGE_KEY);
    if (mode === "production") return PROD_API_BASE;
    if (mode === "local") return fallback;
  } catch {}

  return fallback;
}

export let API_BASE = resolveApiBase();

export function setApiBase(nextBase: string) {
  const trimmed = String(nextBase || "").trim();
  API_BASE = trimmed || resolveApiBase();

  if (isLocalhost()) {
    try {
      const mode = API_BASE === PROD_API_BASE ? "production" : "local";
      window.localStorage.setItem(API_MODE_STORAGE_KEY, mode);
    } catch {}
  }
}

// Resolves the sibling public website's base URL from arcade's own current origin, so
// cross-app links (e.g. the intake "Try" button) always land on the matching environment
// instead of a single hardcoded domain. This mirrors how each app is actually deployed —
// same branch, same env, to a matching subdomain/subfolder pair — so reading the current
// hostname at runtime is reliable (see arcade/.github/workflows/main.yml + website/.github/
// workflows/main.yml for the deploy mapping this depends on).
//   localhost                          -> http://localhost:3000 (website's local dev port)
//   arcade.flukegamestudio.com         -> https://www.flukegamestudio.com
//   dev.arcade.flukegamestudio.com     -> https://dev.flukegamestudio.com
//   qa.arcade.flukegamestudio.com      -> https://qa.flukegamestudio.com
//   anything unrecognized              -> production website (safe default)
function resolveWebsiteBase(): string {
  if (typeof window === "undefined") return "https://www.flukegamestudio.com";
  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//localhost:3000`;
  }
  if (hostname === "arcade.flukegamestudio.com") {
    return "https://www.flukegamestudio.com";
  }
  if (hostname.includes("arcade.flukegamestudio.com")) {
    // Strips the "arcade." segment while preserving any env prefix: dev.arcade.x -> dev.x
    return `https://${hostname.replace(/(^|\.)arcade\./, "$1")}`;
  }
  return "https://www.flukegamestudio.com";
}

export const PUBLIC_WEBSITE_BASE = resolveWebsiteBase();
