export type PreviewScenario = {
  projectId?: string;
  name: string;
  releaseVersion: string;
  releaseNotes: string;
  passwordResetRequired: boolean;
  commitmentRequired: boolean;
  profileComplete: boolean;
  connectionsComplete: boolean;
};

export type PreviewEvent = { method: string; details: Record<string, unknown> };

// An independent in-memory API: no live client, fetch, storage, or credentials.
export function createPreviewSession(scenario: PreviewScenario, onEvent: (event: PreviewEvent) => void) {
  let user: Record<string, any> = {
    username: "onboarding-preview", name: scenario.name, employee_name: scenario.name,
    employee_email: "preview@example.invalid", role: "EMPLOYEE", employee_role: "EMPLOYEE", token: "",
    ...(scenario.projectId ? { project_id: scenario.projectId, project_ids: [scenario.projectId] } : {}),
    password_reset_required: scenario.passwordResetRequired,
    onboarding_commitment_required: scenario.commitmentRequired,
    linkedin_connected: scenario.connectionsComplete, discord_connected: scenario.connectionsComplete,
    jira_connected: false, onboarding_journey_state: "{}",
    ...(scenario.profileComplete ? {
      employee_profilepicture: "https://example.invalid/profile.png", employee_picture: "https://example.invalid/employee.png",
      linkedin_url: "https://example.invalid/linkedin", discord_url: "https://example.invalid/discord",
      employee_phonenumber: "5550100100", employee_dob: "2000-01-01", employee_address: "Preview address", location: "Preview city",
    } : {}),
  };
  let progress: Record<string, string> = {};
  const record = (method: string, details: Record<string, unknown> = {}) => onEvent({ method, details });
  function patch(patch: Record<string, unknown>) {
    // Never retain or log entered test passwords.
    const { password, token, ...safe } = patch;
    user = { ...user, ...safe };
    record("session.patch", { ...safe, ...(password ? { password: "[redacted]" } : {}) });
  }
  function complete(step: string, releaseVersion: string) {
    progress = { ...progress, releaseVersion, [`${step}ReleaseVersion`]: releaseVersion };
    user = { ...user, onboarding_journey_state: JSON.stringify(progress),
      ...(step === "welcome" ? { last_seen_release_version: releaseVersion } : {}) };
    return { ok: true, onboardingJourneyState: { ...progress } };
  }
  const api = {
    async getArcadeReleaseConfig() {
      record("getArcadeReleaseConfig");
      return { releaseVersion: scenario.releaseVersion, releaseNotes: scenario.releaseNotes };
    },
    async getMe() { record("getMe"); return { ...user }; },
    async getJiraConnectStatus() { return { connected: !!user.jira_connected }; },
    async markReleaseSeen({ releaseVersion }: { releaseVersion: string }) {
      record("markReleaseSeen", { releaseVersion }); return complete("welcome", releaseVersion);
    },
    async updateOnboardingJourneyProgress({ step, releaseVersion }: { step: string; releaseVersion: string }) {
      record("updateOnboardingJourneyProgress", { step, releaseVersion }); return complete(step, releaseVersion);
    },
    async updateUser(body: Record<string, unknown>) {
      patch(body); record("updateUser", { fields: Object.keys(body) }); return { ok: true };
    },
    async selfInitiateWallet(body: { amount_cents: number }) {
      record("selfInitiateWallet", { amount_cents: body.amount_cents, simulated: true });
      return { ok: true, credited_fgc: body.amount_cents / 100 };
    },
    async awardAchievement() { record("awardAchievement", { simulated: true }); return { ok: true }; },
  };
  return { api, patch, getUser: () => ({ ...user }) };
}
