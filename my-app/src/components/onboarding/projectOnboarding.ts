export type ProjectOnboardingTab = "groups" | "version_control" | "editor";
export type SetupPlatform = "windows" | "macos" | "linux";
export function projectOnboardingPermissions(mode: "preview" | "employee", role: string) {
  return {
    canSkip: mode === "preview" && (role === "super" || role === "admin"),
    canManage: mode === "preview" && role === "super",
  };
}
export type ProjectInstruction = { text: string; href?: string; code?: string };
export type ProjectSetupSection = { id: string; title: string; instructions: ProjectInstruction[]; platforms?: SetupPlatform[] };
export const PROJECT_ONBOARDING_TABS: Array<{ id: ProjectOnboardingTab; label: string }> = [
  { id: "groups", label: "Groups" }, { id: "version_control", label: "Version Control" }, { id: "editor", label: "Editor" },
];

export function getProjectOnboarding(project: { projectId: string; name: string; slug?: string }) {
  const pavan = /pavan/i.test(`${project.projectId} ${project.name} ${project.slug || ""}`);
  const server = pavan ? "18.216.128.9:1666" : "The Perforce server address supplied by your project lead";
  const stream = pavan ? "//codename-pavan-depot/main" : "The project stream supplied by your lead";
  const projectFile = pavan ? "Superhuman.uproject" : "Your project's .uproject file";
  const solution = pavan ? "Superhuman.sln" : "Your project's .sln file";
  const groups: ProjectSetupSection[] = [
    { id: "google-group", title: "Google group and Google Drive", instructions: pavan ? [
      { text: "Request an invitation to flukegames_pavan@googlegroups.com from your project lead to receive the project Google Drive permissions.", href: "https://groups.google.com/g/flukegames_pavan" },
      { text: "Accept the invitation with your work Google account and confirm you can access the project files in Google Drive." },
    ] : [
      { text: `Ask your project lead for the ${project.name} Google group invitation and Google Drive permissions.` },
      { text: "Accept the invitation with your work Google account and confirm access to the project Drive." },
    ] },
    { id: "miro", title: "Miro", instructions: [
      pavan ? { text: "Open the Pavan Miro invitation.", href: "https://miro.com/welcomeonboard/UDJTT2VhUWhQbjJyR2ZhS0hoYTZhdkF3ZytGTUV4M08xNmRwNC96MkR1YnVUSFQybFV6MnZVKzd2Q1hNTklGUzNoTTR3NzVwMTdXN2x2T1pZdDVNU3JYeGJBTjNHQ0twSXBIZG12b2o0QTJHNmFCNEFtVnRDNVBLZVp3dFZNa2JNakdSWkpBejJWRjJhRnhhb1UwcS9BPT0hdjE=?share_link_id=532661244009" }
        : { text: "Request the project Miro invitation from your lead. The invite link has not been configured yet." },
      { text: "Accept the invitation and confirm that you can open the project board." },
    ] },
    { id: "trello", title: "Trello", instructions: [
      pavan ? { text: "Open the Pavan Trello invitation.", href: "https://trello.com/invite/b/68723d4237615dd41971a7c4/ATTI8c97194ee7eee47c753317d215d599026D2AFC42/codename-pavan" }
        : { text: "Request the project Trello invitation from your lead. The invite link has not been configured yet." },
      { text: "Accept the invitation and confirm that you can access the project board and assigned tasks." },
    ] },
  ];
  const version_control: ProjectSetupSection[] = [
    { id: "install-p4v", title: "1. Install P4V (Perforce Visual Client)", instructions: [
      { text: "Download P4V from Perforce, or find the installer in the shared Assets/Software folder in Google Drive.", href: "https://www.perforce.com/downloads/helix-visual-client-p4v" },
      { text: "Download the version for your operating system: Windows, macOS, or Linux." },
      { text: "Install P4V by following the on-screen installer instructions, then launch P4V." },
    ] },
    { id: "install-sso", title: "2. Download and install the Fluke Games Version Control SSO", instructions: [
      { text: "Download and install the Fluke Games Version Control SSO. Use the installer attached to this step, or ask your project lead for the download link." },
    ] },
    { id: "p4v-connection", title: "3. Set up a new connection", instructions: [
      { text: "On first launch, open the New Connection dialog." },
      { text: "Enter the project server address.", code: server },
      { text: pavan ? "User: p4vShared, or the account provided by your project admin." : "User: the Perforce account provided by your project admin.", code: pavan ? "p4vShared" : undefined },
      { text: pavan ? "Under Workspace, click New. Use the shared Perforce password below." : "Under Workspace, click New. Use the Perforce password supplied by your project admin.", code: pavan ? "p4vSharedPassword@2025!" : undefined },
      { text: "After configuring the workspace below, click OK and confirm that P4V connects." },
    ] },
    { id: "workspace", title: "4. Create a new workspace", instructions: [
      { text: "In the Workspace section, click New." },
      { text: pavan ? "Workspace name: p4vShared default workspace + your name + the default number assigned." : "Use your project's workspace naming convention, including your name and assigned number." },
      { text: "Set Root to a new local folder, for example D:\\FlukeProject on Windows, or a project folder in your home directory on macOS/Linux." },
      { text: "Ensure the selected drive has at least 50 GB of free space." },
      { text: "Choose the project stream in the Stream field.", code: stream },
      { text: "Click OK to create the workspace." },
    ] },
    { id: "sync", title: "5. Get latest files (sync project)", instructions: [
      { text: "With the new workspace selected, open the Depot tab." },
      { text: "Right-click the project stream, for example //main, and select Get Latest Revision." },
      { text: "Wait for the full project to download to your chosen folder." },
    ] },
  ];
  const editor: ProjectSetupSection[] = [
    { id: "launch", title: "5. Launch the Unreal Engine project", instructions: [
      { text: "Once synced, go to your project folder." },
      { text: "Double-click the .uproject file (e.g., Superhuman.uproject).", code: projectFile },
      { text: "Unreal will ask to update to your current version (e.g., 5.6) — click Yes." },
    ] },
    { id: "access-windows", title: "Windows: configure project access", platforms: ["windows"], instructions: [
      { text: "Download and install the FlukeGameProjectSetup.exe or run the FlukeGameProjectSetup.cmd from the \\GOAT-Superhuman\\ProjectSetup\\ folder." },
    ] },
    { id: "access-macos", title: "macOS: configure project access", platforms: ["macos"], instructions: [
      { text: "Open Terminal in the ProjectSetup folder and make the access script executable.", code: "chmod +x Set-AccessURL.command" },
      { text: "Double-click the .command file to run it. Match the exact filename in the folder; the supplied guide also refers to Set-AccessUrl.command." },
    ] },
    { id: "access-linux", title: "Linux: configure project access", platforms: ["linux"], instructions: [
      { text: "Ask your lead for the Linux access-gate script and required Unreal build instructions; the supplied project guide provides Windows and macOS access setup only." },
    ] },
    { id: "generate", title: "6. If the project fails to open: generate project files", platforms: ["windows"], instructions: [
      { text: "Right-click on the .uproject file." },
      { text: "Click \"Generate Visual Studio project files\"." },
      { text: "The following files should be created: the solution file, a .vs/ folder, and auto-created Intermediate/ and Binaries/ folders.", code: solution },
    ] },
    { id: "visual-studio", title: "7. Install Visual Studio 2022 (if not already installed)", platforms: ["windows"], instructions: [
      { text: "Download Visual Studio 2022 Community Edition.", href: "https://visualstudio.microsoft.com/downloads/" },
      { text: "During setup, select these workloads: C++ Game Development." },
      { text: "Also select: .NET desktop development." },
      { text: "(Optional) Unreal Engine Installer Toolset." },
    ] },
    { id: "paths", title: "8. Configure environment paths", platforms: ["windows"], instructions: [
      { text: "During installation, ensure that \"Set environment path for C++ toolchain\" is checked." },
      { text: "If missed, manually set the environment path: search \"Edit the system environment variables\"." },
      { text: "Click Environment Variables." },
      { text: "Under System Variables, find and edit Path." },
      { text: "Add:", code: "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC\\<version>\\bin\\Hostx64\\x64" },
    ] },
    { id: "build", title: "9. Build the Unreal project", platforms: ["windows"], instructions: [
      { text: "Open the project solution in Visual Studio 2022.", code: solution },
      { text: "At the top, select Development Editor." },
      { text: "Select platform: Win64." },
      { text: pavan ? "Select project: Superhuman or the correct target." : "Select project: your project's correct target." },
      { text: "Click Build > Build Solution (Ctrl+Shift+B)." },
      { text: "If the build fails, open the Output tab, copy the full error log, and share it with the instructor or dev lead." },
    ] },
    { id: "editor-credentials", title: "10. Connect Unreal Engine credentials", instructions: [
      { text: "Once the project builds and opens in Unreal, you will be prompted for your username and password, which should have been delivered to you by your lead. If not, contact your lead or admin for the password." },
      { text: "The admin might push a notification about a change in the hash — if so, open the ProjectSetup folder and run the setup.ps1 PowerShell setup again." },
    ] },
    { id: "editor-perforce", title: "11. Connect Perforce in Unreal Engine", instructions: [
      { text: "Once the project builds and opens in Unreal, go to Edit > Editor Preferences > Loading & Saving > Source Control." },
      { text: "Enable Use Source Control (or go to File > Source Control > Connect)." },
      { text: "In the dialog, set Provider: Perforce and Server:", code: server },
      { text: pavan ? "User: your assigned username. Workspace: your_workspace_name, e.g. pavan_fluke_ws." : "User: your assigned username. Workspace: your_workspace_name." },
      { text: "Click Accept Settings." },
      { text: "If successful, a green checkmark should appear in the Source Control toolbar in Unreal." },
    ] },
  ];
  return { groups, version_control, editor };
}

export function visibleProjectSections(sections: ProjectSetupSection[], platform: SetupPlatform) {
  return sections
    .filter(section => !section.platforms || section.platforms.includes(platform))
    .map((section, index) => ({ ...section, title: `${index + 1}. ${section.title.replace(/^\d+\.\s*/, "")}` }));
}
export function projectSectionComplete(section: ProjectSetupSection, checked: Record<string, boolean>) {
  return section.instructions.every((_, index) => checked[`${section.id}:${index}`] === true);
}
export function projectTabComplete(sections: ProjectSetupSection[], checked: Record<string, boolean>) {
  return sections.length > 0 && sections.every(section => projectSectionComplete(section, checked));
}
