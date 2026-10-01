import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { createPreviewSession } = await loadTypeScript("../src/components/onboarding/previewSession.ts");
const { getNextStep, getStepOrder, isProfileComplete } = await loadTypeScript("../src/components/onboarding/flow.ts");
const { CONDUCT_SECTIONS, CONDUCT_REQUIRED_IDS, isConductComplete, isConductSectionComplete } = await loadTypeScript("../src/components/onboarding/codeOfConduct.ts");
const { getProjectOnboarding, visibleProjectSections, projectTabComplete, projectOnboardingPermissions } = await loadTypeScript("../src/components/onboarding/projectOnboarding.ts");

test("project onboarding keeps Pavan invitations separate from other projects", () => {
  const pavan = getProjectOnboarding({ projectId: "pavan", name: "Codename Pavan" });
  const other = getProjectOnboarding({ projectId: "arcade", name: "Arcade" });
  const links = pavan.groups.flatMap(section => section.instructions.flatMap(item => item.href ? [item.href] : []));
  assert.equal(links.length, 3);
  assert.ok(links.some(url => url.startsWith("https://miro.com/welcomeonboard/") && url.endsWith("share_link_id=532661244009")));
  assert.ok(links.some(url => url.endsWith("/codename-pavan")));
  assert.ok(!JSON.stringify(other.groups).includes("codename-pavan"));
  assert.ok(!JSON.stringify(other.groups).includes("flukegames_pavan"));
  assert.ok(!JSON.stringify(other.version_control).includes("18.216.128.9"));
});

test("project checklists require all instructions for the chosen platform", () => {
  const data = getProjectOnboarding({ projectId: "pavan", name: "Pavan" });
  const windows = visibleProjectSections(data.editor, "windows");
  const mac = visibleProjectSections(data.editor, "macos");
  const linux = visibleProjectSections(data.editor, "linux");
  assert.ok(windows.some(section => section.id === "visual-studio"));
  assert.ok(mac.some(section => section.id === "access-macos"));
  assert.ok(linux.some(section => section.id === "access-linux"));
  assert.ok(!mac.some(section => section.id === "visual-studio"));
  for (const sections of [data.groups, data.version_control, windows, mac, linux]) {
    const ids = sections.flatMap(section => section.instructions.map((_, i) => `${section.id}:${i}`));
    assert.equal(ids.length, new Set(ids).size);
    const checked = Object.fromEntries(ids.map(id => [id, true]));
    assert.equal(projectTabComplete(sections, checked), true);
    assert.equal(projectTabComplete(sections, {}), false);
    for (const id of ids) assert.equal(projectTabComplete(sections, { ...checked, [id]: false }), false);
  }
  const macChecks = Object.fromEntries(mac.flatMap(section => section.instructions.map((_, i) => [`${section.id}:${i}`, true])));
  assert.equal(projectTabComplete(windows, macChecks), false);
});

test("Code of Conduct requires every bullet, nested bullet, and closing acknowledgment", () => {
  assert.equal(CONDUCT_SECTIONS.length, 7);
  assert.equal(new Set(CONDUCT_REQUIRED_IDS).size, CONDUCT_REQUIRED_IDS.length);
  assert.equal(isConductComplete({}), false);
  const accepted = Object.fromEntries(CONDUCT_REQUIRED_IDS.map(id => [id, true]));
  assert.equal(isConductComplete(accepted), true);
  for (const id of CONDUCT_REQUIRED_IDS) {
    assert.equal(isConductComplete({ ...accepted, [id]: false }), false, `Unchecked ${id} must block agreement`);
    const missing = { ...accepted };
    delete missing[id];
    assert.equal(isConductComplete(missing), false, `Missing ${id} must block agreement`);
  }
  const confidentiality = CONDUCT_SECTIONS[0];
  const nested = confidentiality.blocks.filter(block => block.type === "check" && block.nested);
  assert.equal(nested.length, 7);
  assert.equal(isConductSectionComplete(confidentiality, accepted), true);
  assert.equal(isConductSectionComplete(confidentiality, { ...accepted, [nested[0].id]: false }), false);
  assert.equal(isConductComplete({ "timesheet-weekly": true, "discord-notifications": true }), false);
});
const scenario = { projectId: "project-a", name: "Test employee", releaseVersion: "preview-v1", releaseNotes: "Test notes",
  passwordResetRequired: true, commitmentRequired: true, profileComplete: false, connectionsComplete: false };

test("organisation replay has no project assignment and starts fresh on reopening", async () => {
  const { projectId, ...organisation } = scenario;
  const session = createPreviewSession(organisation, () => {});
  assert.equal(session.getUser().project_id, undefined);
  assert.equal(session.getUser().project_ids, undefined);
  await session.api.markReleaseSeen({ releaseVersion: organisation.releaseVersion });
  const reopened = createPreviewSession(organisation, () => {});
  assert.equal(reopened.getUser().last_seen_release_version, undefined);
  assert.equal(reopened.getUser().password_reset_required, true);
});

test("preview actions stay offline, redact passwords, and reset independently", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Preview must not make network requests"); };
  try {
    const events = [];
    const session = createPreviewSession(scenario, (event) => events.push(event));
    assert.equal((await session.api.getArcadeReleaseConfig()).releaseNotes, "Test notes");
    assert.equal((await session.api.getMe()).project_id, "project-a");
    await session.api.updateUser({ employee_phonenumber: "5550100100", password: "secret-test-password" });
    await session.api.markReleaseSeen({ releaseVersion: scenario.releaseVersion });
    for (const step of ["profile", "agreement", "commitment", "connect"]) {
      await session.api.updateOnboardingJourneyProgress({ step, releaseVersion: scenario.releaseVersion });
    }
    session.patch({ linkedin_connected: true, discord_connected: true });
    assert.equal((await session.api.selfInitiateWallet({ amount_cents: 10000 })).credited_fgc, 100);
    assert.equal(session.getUser().linkedin_connected, true);
    assert.equal(JSON.parse(session.getUser().onboarding_journey_state).agreementReleaseVersion, "preview-v1");
    assert.ok(!JSON.stringify([session.getUser(), events]).includes("secret-test-password"));
    const restarted = createPreviewSession({ ...scenario, projectId: "project-b" }, () => {});
    assert.equal(restarted.getUser().onboarding_journey_state, "{}");
    assert.equal(restarted.getUser().linkedin_connected, false);
    assert.equal(restarted.getUser().employee_phonenumber, undefined);
    assert.equal(restarted.getUser().project_id, "project-b");
  } finally { globalThis.fetch = originalFetch; }
});

test("scenario switches exercise the same production step selection", () => {
  const empty = createPreviewSession(scenario, () => {}).getUser();
  const filled = createPreviewSession({ ...scenario, passwordResetRequired: false, profileComplete: true, connectionsComplete: true }, () => {}).getUser();
  assert.equal(isProfileComplete(empty), false);
  assert.equal(isProfileComplete(filled), true);
  assert.deepEqual(getStepOrder(true), ["welcome", "password", "profile", "agreement", "commitment", "connect"]);
  assert.ok(!getStepOrder(filled.password_reset_required).includes("password"));
  const flags = { welcomeDone: false, passwordResetDone: false, profileDone: false, agreementDone: false, commitmentDone: false, connectedReady: false };
  const expected = ["welcome", "password", "profile", "agreement", "commitment", "connect", null];
  const keys = ["welcomeDone", "passwordResetDone", "profileDone", "agreementDone", "commitmentDone", "connectedReady"];
  assert.equal(getNextStep(flags), expected[0]);
  keys.forEach((key, index) => { flags[key] = true; assert.equal(getNextStep(flags), expected[index + 1]); });
});


test("employee onboarding never exposes editing or skip controls regardless of role", () => {
  for (const role of ["employee", "admin", "super", "test"]) {
    assert.deepEqual(projectOnboardingPermissions("employee", role), { canSkip: false, canManage: false });
  }
  assert.deepEqual(projectOnboardingPermissions("preview", "super"), { canSkip: true, canManage: true });
  assert.deepEqual(projectOnboardingPermissions("preview", "admin"), { canSkip: true, canManage: false });
});
