import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { DEFAULT_RELEASE_NOTES, DEFAULT_RELEASE_VERSION } from "../ReleaseHighlightsPanel";
import { useIntegrations } from "../account/useIntegrations";
import AgreementStep from "./AgreementStep";
import CommitmentStep from "./CommitmentStep";
import ConnectStep from "./ConnectStep";
import OnboardingFooterButton from "./OnboardingFooterButton";
import OnboardingShell from "./OnboardingShell";
import PasswordResetStep from "./PasswordResetStep";
import ProfileDetailsStep from "./ProfileDetailsStep";
import WelcomeStep from "./WelcomeStep";
import { parseOnboardingProgress } from "./progress";
import { getChapterStatuses, getNextStep, getStepOrder, isProfileComplete, mergeProgress } from "./flow";
import type { ConnectRequirement, OnboardingProgress, OnboardingStepId } from "./types";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export default function OnboardingJourney() {
  const { api, user, refreshSession, transientPassword, applySessionPatch, clearTransientPassword } = useAuth();
  const integrations = useIntegrations(api, user, {
    onConnected: async (payload?: any) => {
      const type = safeStr(payload?.type);
      if (type === "discord-connected") {
        applySessionPatch({
          discord_connected: true,
          discord_connected_at: safeStr(payload?.connectedAt) || new Date().toISOString(),
          discord_member_id: safeStr(payload?.memberId),
          discord_name: safeStr(payload?.name),
          discord_email: safeStr(payload?.email),
          discord_url: safeStr(payload?.discordUrl),
        });
      }

      await refreshSession();
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const oauth = safeStr(params.get("oauth") || params.get("provider"));
    const oauthStatus = safeStr(params.get("oauthStatus") || params.get("status"));
    const discordConnected =
      oauth === "discord" || params.get("discord_connected") === "1" || oauthStatus === "connected";

    if (!discordConnected) return;

    applySessionPatch({
      discord_connected: true,
      discord_connected_at: safeStr(params.get("connectedAt")) || new Date().toISOString(),
      discord_member_id: safeStr(params.get("memberId")),
      discord_name: safeStr(params.get("name")),
      discord_email: safeStr(params.get("email")),
      discord_url: safeStr(params.get("discordUrl")),
    });

    params.delete("oauth");
    params.delete("provider");
    params.delete("oauthStatus");
    params.delete("status");
    params.delete("discord_connected");
    params.delete("connectedAt");
    params.delete("memberId");
    params.delete("name");
    params.delete("email");
    params.delete("discordUrl");

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
    void refreshSession();
  }, [applySessionPatch, refreshSession]);

  const roleLower = safeStr((user as any)?.employee_role || (user as any)?.role).toLowerCase().replace(/_/g, "-");
  const isTestUser = roleLower === "test";

  const [releaseConfig, setReleaseConfig] = useState({
    releaseVersion: DEFAULT_RELEASE_VERSION,
    releaseNotes: DEFAULT_RELEASE_NOTES,
  });
  const [releaseLoading, setReleaseLoading] = useState(true);
  const [progress, setProgress] = useState<OnboardingProgress>({});
  const [activeStep, setActiveStep] = useState<OnboardingStepId | null>(null);
  const [journeyComplete, setJourneyComplete] = useState(false);
  const [commitmentAccepted, setCommitmentAccepted] = useState(false);
  const [commitmentPaymentRecorded, setCommitmentPaymentRecorded] = useState(false);
  const [timesheetAccepted, setTimesheetAccepted] = useState(false);
  const [discordAccepted, setDiscordAccepted] = useState(false);
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [savingCommitment, setSavingCommitment] = useState(false);
  const [savingAgreement, setSavingAgreement] = useState(false);

  const onboardingStepStorageKey = useMemo(() => {
    const username = safeStr((user as any)?.username || (user as any)?.sub);
    return username ? `fluke:onboarding-step:${username}` : "";
  }, [user]);

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

  const backendProgress = useMemo(() => parseOnboardingProgress((user as any)?.onboarding_journey_state), [user]);

  useEffect(() => {
    setProgress((current) => mergeProgress(current, backendProgress));
  }, [backendProgress]);

  useEffect(() => {
    if (typeof window === "undefined" || !onboardingStepStorageKey) return;
    if (journeyComplete) {
      window.localStorage.removeItem(onboardingStepStorageKey);
      return;
    }
    if (activeStep) {
      window.localStorage.setItem(onboardingStepStorageKey, activeStep);
      return;
    }
    const stored = String(window.localStorage.getItem(onboardingStepStorageKey) || "").trim() as OnboardingStepId;
    if (stored && ["welcome", "password", "profile", "connect", "agreement", "commitment"].includes(stored)) {
      setActiveStep(stored);
    }
  }, [activeStep, journeyComplete, onboardingStepStorageKey]);

  const releaseVersion = releaseConfig.releaseVersion;
  const releaseSeen = safeStr((user as any)?.last_seen_release_version) === releaseVersion;
  const welcomeDone = releaseSeen || progress.welcomeReleaseVersion === releaseVersion;
  const passwordResetRequired = Boolean((user as any)?.password_reset_required);
  const passwordResetDone = !passwordResetRequired;
  const commitmentRequired = Boolean((user as any)?.onboarding_commitment_required);
  const stepOrder = useMemo(() => getStepOrder(passwordResetRequired), [passwordResetRequired]);
  const profileDone = progress.profileReleaseVersion === releaseVersion || isProfileComplete(user);
  const commitmentDone = progress.commitmentReleaseVersion === releaseVersion;
  const agreementDone = progress.agreementReleaseVersion === releaseVersion;
  const connectedReady = Boolean(integrations.status.linkedin && integrations.status.discord && integrations.status.jira);

  const nextStep: OnboardingStepId | null = useMemo(
    () =>
      getNextStep({
        welcomeDone,
        passwordResetDone,
        profileDone,
        agreementDone,
        commitmentDone,
        connectedReady,
      }),
    [agreementDone, commitmentDone, connectedReady, passwordResetDone, profileDone, welcomeDone]
  );

  useEffect(() => {
    if (journeyComplete) {
      setActiveStep(null);
      return;
    }

    if (!nextStep) {
      if (activeStep === "connect") return;
      setJourneyComplete(true);
      setActiveStep(null);
      return;
    }

    setActiveStep((current) => {
      if (!current) return nextStep;
      if (!stepOrder.includes(current)) return nextStep;
      return current;
    });
  }, [activeStep, journeyComplete, nextStep, stepOrder]);

  const currentStep: OnboardingStepId | null = journeyComplete ? null : activeStep || nextStep;

  const requirements: ConnectRequirement[] = useMemo(
    () => [
      {
        key: "linkedin",
        label: "LinkedIn",
        subtitle: safeStr((user as any)?.linkedin_email) || "Required. This keeps profile identity and employee workflows aligned.",
        connected: integrations.status.linkedin,
        icon: "link",
        optional: false,
      },
      {
        key: "discord",
        label: "Discord",
        subtitle: safeStr((user as any)?.discord_name || (user as any)?.discord_email) || "Required. Discord powers notifications and approvals.",
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
    const merged = mergeProgress(progress, next);
    setProgress(merged);
    return merged;
  }

  function goBack() {
    if (!currentStep) return;
    const idx = stepOrder.indexOf(currentStep);
    if (idx <= 0) return;
    setActiveStep(stepOrder[idx - 1]);
  }

  function advanceTo(step: OnboardingStepId | null) {
    setActiveStep(step);
  }

  async function markWelcomeComplete() {
    if (!user || savingWelcome) return;
    setSavingWelcome(true);
    try {
      const resp = await (api as any).markReleaseSeen({ releaseVersion });
      setBackendProgress(resp?.onboardingJourneyState || { releaseVersion, welcomeReleaseVersion: releaseVersion });
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
      setBackendProgress(resp?.onboardingJourneyState || { releaseVersion, profileReleaseVersion: releaseVersion });
      await refreshSession();
      advanceTo("agreement");
    } catch (err) {
      throw err;
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
      setBackendProgress(resp?.onboardingJourneyState || { releaseVersion, agreementReleaseVersion: releaseVersion });
      await refreshSession();
      advanceTo("commitment");
    } finally {
      setSavingAgreement(false);
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
      setBackendProgress(resp?.onboardingJourneyState || { releaseVersion, commitmentReleaseVersion: releaseVersion });
      await refreshSession();
      advanceTo("connect");
    } finally {
      setSavingCommitment(false);
    }
  }

  async function markConnectComplete() {
    if (!connectedReady) return;
    try {
      const resp = await (api as any).updateOnboardingJourneyProgress({
        releaseVersion,
        step: "connect",
      });
      setBackendProgress(resp?.onboardingJourneyState || { releaseVersion, connectReleaseVersion: releaseVersion });
      await refreshSession();
      setJourneyComplete(true);
      advanceTo(null);
    } catch (err) {
      throw err;
    }
  }

  if (!user || releaseLoading || journeyComplete || !currentStep || isTestUser) return null;

  const canCommitmentContinue = commitmentAccepted && (!commitmentRequired || commitmentPaymentRecorded) && !savingCommitment;
  const canAgreementContinue = timesheetAccepted && discordAccepted && !savingAgreement;

  const footer = (() => {
    switch (currentStep) {
      case "welcome":
        return (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <OnboardingFooterButton icon="arrow_forward" onClick={() => void markWelcomeComplete()} primary>
              Continue
            </OnboardingFooterButton>
          </div>
        );
      case "password":
        return (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <OnboardingFooterButton icon="arrow_back" onClick={goBack}>
              Back
            </OnboardingFooterButton>
          </div>
        );
      case "profile":
        return (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <OnboardingFooterButton icon="arrow_back" onClick={goBack}>
              Back
            </OnboardingFooterButton>
            <OnboardingFooterButton icon="arrow_forward" onClick={() => void markProfileComplete()} primary>
              Continue
            </OnboardingFooterButton>
          </div>
        );
      case "agreement":
        return (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <OnboardingFooterButton icon="arrow_back" onClick={goBack}>
              Back
            </OnboardingFooterButton>
            <OnboardingFooterButton
              icon="task_alt"
              onClick={() => void markAgreementComplete()}
              disabled={!canAgreementContinue}
              primary
            >
              Agree and continue
            </OnboardingFooterButton>
          </div>
        );
      case "commitment":
        return (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <OnboardingFooterButton icon="arrow_back" onClick={goBack}>
              Back
            </OnboardingFooterButton>
            <OnboardingFooterButton
              icon="check_circle"
              onClick={() => void markCommitmentComplete()}
              disabled={!canCommitmentContinue}
              primary
            >
              Continue
            </OnboardingFooterButton>
          </div>
        );
      case "connect":
        return (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <OnboardingFooterButton icon="arrow_back" onClick={goBack}>
              Back
            </OnboardingFooterButton>
            <OnboardingFooterButton
              icon="arrow_forward"
              onClick={() => void markConnectComplete()}
              disabled={!connectedReady}
              primary
            >
              Continue
            </OnboardingFooterButton>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <OnboardingShell
      title="Onboarding journey"
      subtitle="Your setup adapts to what you have already completed. Finished steps stay hidden on later visits."
      chapters={getChapterStatuses({
        currentStep,
        welcomeDone,
        passwordResetRequired,
        passwordResetDone,
        profileDone,
        agreementDone,
        commitmentDone,
        connectedReady,
      })}
      footer={footer}
    >
      {currentStep === "welcome" && (
        <WelcomeStep
          releaseVersion={releaseVersion}
          releaseNotes={releaseConfig.releaseNotes}
        />
      )}

      {currentStep === "password" && (
        <PasswordResetStep
          api={api}
          user={user}
          tempPassword={transientPassword}
          onSaved={() => void markPasswordComplete()}
        />
      )}

      {currentStep === "profile" && (
        <ProfileDetailsStep
          api={api}
          user={user}
        />
      )}

      {currentStep === "agreement" && (
        <AgreementStep
          timesheetAccepted={timesheetAccepted}
          discordAccepted={discordAccepted}
          onTimesheetChange={setTimesheetAccepted}
          onDiscordChange={setDiscordAccepted}
        />
      )}

      {currentStep === "commitment" && (
        <CommitmentStep
          api={api}
          accepted={commitmentAccepted}
          commitmentRequired={commitmentRequired}
          onAcceptedChange={setCommitmentAccepted}
          paymentRecorded={commitmentPaymentRecorded}
          onPaymentRecordedChange={setCommitmentPaymentRecorded}
        />
      )}

      {currentStep === "connect" && (
        <ConnectStep
          requirements={requirements}
          onConnect={(key) => {
            setActiveStep("connect");
            integrations.startConnect(key);
          }}
          canContinue={connectedReady}
        />
      )}
    </OnboardingShell>
  );
}
