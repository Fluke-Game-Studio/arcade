import type { OnboardingProgress } from "./types";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function parseOnboardingProgress(raw: unknown): OnboardingProgress {
  if (!raw) return {};

  const value =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        })()
      : raw;

  if (!value || typeof value !== "object") return {};

  const obj = value as Record<string, unknown>;
  return {
    releaseVersion: safeStr(obj.releaseVersion),
    welcomeReleaseVersion: safeStr(obj.welcomeReleaseVersion),
    profileReleaseVersion: safeStr(obj.profileReleaseVersion),
    commitmentReleaseVersion: safeStr(obj.commitmentReleaseVersion),
    agreementReleaseVersion: safeStr(obj.agreementReleaseVersion),
    paymentReleaseVersion: safeStr(obj.paymentReleaseVersion),
  };
}

export function mergeOnboardingProgress(base: OnboardingProgress, next: Partial<OnboardingProgress>) {
  return {
    ...base,
    ...next,
  };
}

export function serializeOnboardingProgress(progress: OnboardingProgress) {
  return JSON.stringify(progress || {});
}
