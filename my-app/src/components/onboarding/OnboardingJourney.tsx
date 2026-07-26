import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { DEFAULT_RELEASE_NOTES, DEFAULT_RELEASE_VERSION } from "../ReleaseHighlightsPanel";
import { useIntegrations } from "../account/useIntegrations";
import AgreementStep from "./AgreementStep";
import CommitmentStep from "./CommitmentStep";
import ConnectStep from "./ConnectStep";
import ProfileDetailsStep from "./ProfileDetailsStep";
import PasswordResetStep from "./PasswordResetStep";
import WelcomeStep from "./WelcomeStep";
import { mergeOnboardingProgress, parseOnboardingProgress } from "./progress";
import type { ConnectRequirement, OnboardingProgress } from "./types";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

type StepId = "welcome" | "password" | "profile" | "connect" | "agreement" | "commitment";

function isProfileComplete(user: any) {
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

function stepPill(active: boolean, complete: boolean, label: string) {
  return (
    <div
      key={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "8px 12px",
        border: active
          ? "1px solid rgba(37,99,235,.28)"
          : complete
            ? "1px solid rgba(34,197,94,.22)"
            : "1px solid rgba(148,163,184,.16)",
        background: active
          ? "rgba(37,99,235,.10)"
          : complete
            ? "rgba(34,197,94,.08)"
            : "rgba(255,255,255,.82)",
        color: active ? "#1d4ed8" : complete ? "#166534" : "#64748b",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: ".06em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 20,
          height: 20,
          borderRadius: 999,
          background: active ? "#dbeafe" : complete ? "#dcfce7" : "#e2e8f0",
          color: active ? "#1d4ed8" : complete ? "#166534" : "#64748b",
          fontSize: 11,
        }}
      >
        {complete ? "✓" : label.slice(0, 1)}
      </span>
      {label}
    </div>
  );
}

export default function OnboardingJourney() {
  const { api, user, refreshSession, transientPassword, applySessionPatch, clearTransientPassword } = useAuth();
  const integrations = useIntegrations(api, user, { onConnected: refreshSession });
  const roleLower = safeStr((user as any)?.employee_role || (user as any)?.role).toLowerCase().replace(/_/g, "-");
  const isTestUser = roleLower === "test";

  const [releaseConfig, setReleaseConfig] = useState({
    releaseVersion: DEFAULT_RELEASE_VERSION,
    releaseNotes: DEFAULT_RELEASE_NOTES,
  });
  const [releaseLoading, setReleaseLoading] = useState(true);
  const [progress, setProgress] = useState<OnboardingProgress>({});
  const [activeStep, setActiveStep] = useState<StepId | null>(null);
  const [journeyComplete, setJourneyComplete] = useState(false);
  const [commitmentAccepted, setCommitmentAccepted] = useState(false);
  const [timesheetAccepted, setTimesheetAccepted] = useState(false);
  const [discordAccepted, setDiscordAccepted] = useState(false);
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [savingCommitment, setSavingCommitment] = useState(false);
  const [savingAgreement, setSavingAgreement] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setReleaseLoading(true);
        const resp = await (api as any).getArcadeReleaseConfig?.();
        if (cancelled || !resp) return;
        setReleaseConfig({
          releaseVersion: safeStr(resp.releaseVersion) || DEFAULT_RELEASE_VERSION,
          releaseNotes: String(resp.releaseNotes ?? "").trim() || DEFAULT_RELEASE_NOTES,
        });
      } catch {
        if (cancelled) return;
        setReleaseConfig({
          releaseVersion: DEFAULT_RELEASE_VERSION,
          releaseNotes: DEFAULT_RELEASE_NOTES,
        });
      } finally {
        if (!cancelled) setReleaseLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  const backendProgress = useMemo(
    () => parseOnboardingProgress((user as any)?.onboarding_journey_state),
    [user]
  );

  useEffect(() => {
    setProgress((current) => mergeOnboardingProgress(current, backendProgress));
  }, [backendProgress]);

  const releaseVersion = releaseConfig.releaseVersion;
  const releaseSeen = safeStr((user as any)?.last_seen_release_version) === releaseVersion;
  const welcomeDone = releaseSeen || progress.welcomeReleaseVersion === releaseVersion;
  const passwordResetRequired = Boolean((user as any)?.password_reset_required);
  const passwordResetDone = !passwordResetRequired;
  const stepOrder: StepId[] = useMemo(
    () =>
      passwordResetRequired
        ? ["welcome", "password", "profile", "connect", "agreement", "commitment"]
        : ["welcome", "profile", "connect", "agreement", "commitment"],
    [passwordResetRequired]
  );
  const profileFieldsComplete = isProfileComplete(user);
  const profileDone = progress.profileReleaseVersion === releaseVersion || profileFieldsComplete;
  const commitmentDone = progress.commitmentReleaseVersion === releaseVersion;
  const agreementDone = progress.agreementReleaseVersion === releaseVersion;
  const connectedReady = Boolean(integrations.status.linkedin && integrations.status.discord && integrations.status.jira);

  const nextStep: StepId | null = useMemo(() => {
    if (!welcomeDone) return "welcome";
    if (!passwordResetDone) return "password";
    if (!profileDone) return "profile";
    if (!connectedReady) return "connect";
    if (!agreementDone) return "agreement";
    if (!commitmentDone) return "commitment";
    return null;
  }, [agreementDone, commitmentDone, connectedReady, passwordResetDone, profileDone, welcomeDone]);

  useEffect(() => {
    if (journeyComplete) {
      setActiveStep(null);
      return;
    }

    if (!nextStep) {
      setJourneyComplete(true);
      setActiveStep(null);
      return;
    }

    setActiveStep((current) => {
      if (!current) return nextStep;
      if (!stepOrder.includes(current)) return nextStep;
      const currentIdx = stepOrder.indexOf(current);
      const nextIdx = stepOrder.indexOf(nextStep);
      return currentIdx > nextIdx ? nextStep : current;
    });
  }, [journeyComplete, nextStep]);

  const currentStep: StepId | null = journeyComplete ? null : activeStep || nextStep;

  const requirements: ConnectRequirement[] = useMemo(
    () => [
      {
        key: "linkedin",
        label: "LinkedIn",
        subtitle:
          safeStr((user as any)?.linkedin_email) ||
          "Required. This keeps profile identity and employee workflows aligned.",
        connected: integrations.status.linkedin,
        icon: "link",
        optional: false,
      },
      {
        key: "discord",
        label: "Discord",
        subtitle:
          safeStr((user as any)?.discord_name || (user as any)?.discord_email) ||
          "Required. Discord powers notifications and approvals.",
        connected: integrations.status.discord,
        icon: "sports_esports",
        optional: false,
      },
      {
        key: "jira",
        label: "Jira",
        subtitle: integrations.status.jiraCloudName
          ? `Required. Connected site: ${integrations.status.jiraCloudName}`
          : "Required. Connect Jira now so project workflow hooks are ready from day one.",
        connected: integrations.status.jira,
        icon: "schema",
        optional: false,
      },
    ],
    [integrations.status.discord, integrations.status.jira, integrations.status.jiraCloudName, integrations.status.linkedin, user]
  );

  function setBackendProgress(next: Partial<OnboardingProgress>) {
    const merged = mergeOnboardingProgress(progress, next);
    setProgress(merged);
    return merged;
  }

  function goBack() {
    if (!currentStep) return;
    const idx = stepOrder.indexOf(currentStep);
    if (idx <= 0) return;
    setActiveStep(stepOrder[idx - 1]);
  }

  function advanceTo(step: StepId | null) {
    setActiveStep(step);
  }

  async function markWelcomeComplete() {
    if (!user || savingWelcome) return;
    setSavingWelcome(true);
    try {
      const resp = await (api as any).markReleaseSeen({ releaseVersion });
      setBackendProgress(
        resp?.onboardingJourneyState ||
          {
            releaseVersion,
            welcomeReleaseVersion: releaseVersion,
          }
      );
      await refreshSession();
      advanceTo(passwordResetRequired ? "password" : "profile");
    } finally {
      setSavingWelcome(false);
    }
  }

  async function markPasswordComplete() {
    applySessionPatch({
      password_reset_required: false,
      password_reset_at: new Date().toISOString(),
    });
    clearTransientPassword();
    await refreshSession();
    advanceTo("profile");
  }

  async function markProfileComplete() {
    try {
      const resp = await (api as any).updateOnboardingJourneyProgress({
        releaseVersion,
        step: "profile",
      });
      setBackendProgress(
        resp?.onboardingJourneyState ||
          {
            releaseVersion,
            profileReleaseVersion: releaseVersion,
          }
      );
      await refreshSession();
      advanceTo("connect");
    } catch (err) {
      throw err;
    }
  }

  async function markCommitmentComplete() {
    if (savingCommitment) return;
    setSavingCommitment(true);
    try {
      const resp = await (api as any).updateOnboardingJourneyProgress({
        releaseVersion,
        step: "commitment",
      });
      setBackendProgress(
        resp?.onboardingJourneyState ||
          {
            releaseVersion,
            commitmentReleaseVersion: releaseVersion,
          }
      );
      setJourneyComplete(true);
      await refreshSession();
      advanceTo(null);
    } finally {
      setSavingCommitment(false);
    }
  }

  async function markAgreementComplete() {
    if (savingAgreement) return;
    setSavingAgreement(true);
    try {
      const resp = await (api as any).updateOnboardingJourneyProgress({
        releaseVersion,
        step: "agreement",
      });
      setBackendProgress(
        resp?.onboardingJourneyState ||
          {
            releaseVersion,
            agreementReleaseVersion: releaseVersion,
          }
      );
      await refreshSession();
      advanceTo("commitment");
    } finally {
      setSavingAgreement(false);
    }
  }

  if (!user || releaseLoading || journeyComplete || !nextStep || !currentStep || isTestUser) return null;

  const canCommitmentContinue = commitmentAccepted && !savingCommitment;
  const canAgreementContinue = timesheetAccepted && discordAccepted && !savingAgreement;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(2,6,23,.78)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(940px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,.10)",
          background: "linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(248,250,252,.99) 100%)",
          boxShadow: "0 28px 80px rgba(15,23,42,.28)",
        }}
      >
        <div style={{ padding: "24px 24px 18px", borderBottom: "1px solid rgba(148,163,184,.16)", display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.03em" }}>
                Onboarding journey
              </div>
              <div style={{ marginTop: 8, maxWidth: 760, fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
                Your setup adapts to what you have already completed. Finished steps stay hidden on later visits.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stepPill(currentStep === "welcome", welcomeDone, "Welcome")}
              {passwordResetRequired ? stepPill(currentStep === "password", passwordResetDone, "Password Reset") : null}
              {stepPill(currentStep === "profile", profileDone, "Profile")}
              {stepPill(currentStep === "connect", connectedReady, "Connect")}
              {stepPill(currentStep === "agreement", agreementDone, "Agreement")}
              {stepPill(currentStep === "commitment", commitmentDone, "Commitment")}
            </div>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {currentStep === "welcome" && (
            <WelcomeStep
              releaseVersion={releaseVersion}
              releaseNotes={releaseConfig.releaseNotes}
              onContinue={() => void markWelcomeComplete()}
            />
          )}

          {currentStep === "password" && (
            <PasswordResetStep
              api={api}
              user={user}
              tempPassword={transientPassword}
              onBack={goBack}
              onSaved={() => void markPasswordComplete()}
            />
          )}

          {currentStep === "profile" && (
            <ProfileDetailsStep
              api={api}
              user={user}
              onBack={goBack}
              onContinue={() => void markProfileComplete()}
            />
          )}

          {currentStep === "connect" && (
            <ConnectStep
              requirements={requirements}
              onConnect={(key) => {
                setActiveStep("connect");
                integrations.startConnect(key);
              }}
              onBack={goBack}
              onContinue={() => {
                if (connectedReady) {
                  advanceTo("agreement");
                  void refreshSession();
                }
              }}
              canContinue={connectedReady}
            />
          )}

          {currentStep === "agreement" && (
            <AgreementStep
              timesheetAccepted={timesheetAccepted}
              discordAccepted={discordAccepted}
              onTimesheetChange={setTimesheetAccepted}
              onDiscordChange={setDiscordAccepted}
              onBack={goBack}
              onContinue={() => {
                if (canAgreementContinue) void markAgreementComplete();
              }}
            />
          )}

          {currentStep === "commitment" && (
            <CommitmentStep
              accepted={commitmentAccepted}
              onAcceptedChange={setCommitmentAccepted}
              onContinue={() => {
                if (canCommitmentContinue) void markCommitmentComplete();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
