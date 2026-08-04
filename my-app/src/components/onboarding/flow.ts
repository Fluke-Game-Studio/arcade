import type { OnboardingChapterStatus, OnboardingStepId, OnboardingProgress } from "./types";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export function isProfileComplete(user: any) {
  const requiredFields = [
    "employee_profilepicture",
    "employee_picture",
    "linkedin_url",
    "discord_url",
    "employee_phonenumber",
    "employee_dob",
    "employee_address",
    "location",
  ];

  return requiredFields.every((key) => Boolean(safeStr(user?.[key])));
}

export function getStepOrder(passwordResetRequired: boolean): OnboardingStepId[] {
  return passwordResetRequired
    ? ["welcome", "password", "profile", "agreement", "commitment", "connect"]
    : ["welcome", "profile", "agreement", "commitment", "connect"];
}

export function getNextStep(params: {
  welcomeDone: boolean;
  passwordResetDone: boolean;
  profileDone: boolean;
  agreementDone: boolean;
  commitmentDone: boolean;
  connectedReady: boolean;
}): OnboardingStepId | null {
  const { welcomeDone, passwordResetDone, profileDone, agreementDone, commitmentDone, connectedReady } = params;
  if (!welcomeDone) return "welcome";
  if (!passwordResetDone) return "password";
  if (!profileDone) return "profile";
  if (!agreementDone) return "agreement";
  if (!commitmentDone) return "commitment";
  if (!connectedReady) return "connect";
  return null;
}

export function getChapterStatuses(params: {
  currentStep: OnboardingStepId | null;
  welcomeDone: boolean;
  passwordResetRequired: boolean;
  passwordResetDone: boolean;
  profileDone: boolean;
  agreementDone: boolean;
  commitmentDone: boolean;
  connectedReady: boolean;
}): OnboardingChapterStatus[] {
  const { currentStep, welcomeDone, passwordResetRequired, passwordResetDone, profileDone, agreementDone, commitmentDone, connectedReady } = params;
  const chapters: Array<OnboardingChapterStatus | null> = [
    { id: "welcome", label: "Welcome", active: currentStep === "welcome", complete: welcomeDone },
    passwordResetRequired
      ? { id: "password", label: "Password Reset", active: currentStep === "password", complete: passwordResetDone }
      : null,
    { id: "profile", label: "Profile", active: currentStep === "profile", complete: profileDone },
    { id: "agreement", label: "Agreement", active: currentStep === "agreement", complete: agreementDone },
    { id: "commitment", label: "Commitment", active: currentStep === "commitment", complete: commitmentDone },
    { id: "connect", label: "Connect", active: currentStep === "connect", complete: connectedReady },
  ];

  return chapters.filter(Boolean) as OnboardingChapterStatus[];
}

export function mergeProgress(current: OnboardingProgress, next: Partial<OnboardingProgress>) {
  return {
    ...(current || {}),
    ...(next || {}),
  };
}
