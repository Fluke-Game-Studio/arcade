export type OnboardingProgress = {
  releaseVersion?: string;
  welcomeReleaseVersion?: string;
  profileReleaseVersion?: string;
  commitmentReleaseVersion?: string;
  agreementReleaseVersion?: string;
  paymentReleaseVersion?: string;
};

export type ConnectRequirement = {
  key: "linkedin" | "discord" | "jira";
  label: string;
  subtitle: string;
  connected: boolean;
  icon: string;
  optional: boolean;
};

export type OnboardingStepId =
  | "welcome"
  | "password"
  | "profile"
  | "agreement"
  | "commitment"
  | "connect";

export type OnboardingChapterStatus = {
  id: OnboardingStepId;
  label: string;
  active: boolean;
  complete: boolean;
};
