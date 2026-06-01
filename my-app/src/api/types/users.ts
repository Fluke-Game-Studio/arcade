export type ApiRole =
  | "super"
  | "admin"
  | "employee"
  | "admin-readonly"
  | "super-readonly";

export type ApiLoginResponse = {
  token: string;
  expiresIn: number;
  username: string;
  role: ApiRole;
  name: string;
  projectStatus?: "ProjectPartialClean" | "ProjectCompleteCleanup" | "none" | string;
  allowed?: boolean;
};

export type ApiUser = {
  username: string;
  employee_name?: string;
  employee_email?: string;
  employee_title?: string;
  employee_dob?: string;
  employee_profilepicture?: string;
  employee_picture?: string;
  linkedin_url?: string;
  linkedin_connected?: boolean;
  linkedin_connected_at?: string;
  linkedin_member_id?: string;
  linkedin_name?: string;
  linkedin_email?: string;
  discord_url?: string;
  discord_connected?: boolean;
  discord_connected_at?: string;
  discord_member_id?: string;
  discord_name?: string;
  discord_email?: string;
  jira_connected?: boolean;
  jira_connected_at?: string;
  jira_account_id?: string;
  jira_email?: string;
  jira_cloud_id?: string;
  jira_cloud_name?: string;
  jira_cloud_url?: string;
  jira_scope?: string;
  employee_phonenumber?: string;
  employment_type?: string;
  department?: string;
  location?: string;
  employee_role?: ApiRole;
  project_id?: string;
  employee_manager?: string;
  employee_last_update_week?: string;
  employee_last_update_hours?: string;
  employee_last_update_summary?: string;
  revoked?: boolean;
  portal_access?: boolean;
  project_access?: boolean;
  version_control_access?: boolean;
  project_setup?: "" | "ProjectPartialCleanUp" | "ProjectCompleteCleanup" | string;
  [k: string]: any;
};

export type CreateUserBody = {
  username: string;
  password: string;
  employee_name?: string;
  employee_dob?: string;
  employee_profilepicture?: string;
  employee_picture?: string;
  linkedin_url?: string;
  linkedin_connected?: boolean;
  linkedin_connected_at?: string;
  linkedin_member_id?: string;
  linkedin_name?: string;
  linkedin_email?: string;
  discord_url?: string;
  discord_connected?: boolean;
  discord_connected_at?: string;
  discord_member_id?: string;
  discord_name?: string;
  discord_email?: string;
  jira_connected?: boolean;
  jira_connected_at?: string;
  jira_account_id?: string;
  jira_email?: string;
  jira_cloud_id?: string;
  jira_cloud_name?: string;
  jira_cloud_url?: string;
  jira_scope?: string;
  employee_phonenumber?: string;
  employee_email?: string;
  employee_title?: string;
  employment_type?: string;
  department?: string;
  location?: string;
  employee_role?: ApiRole;
  project_id?: string;
  employee_manager?: string;
  portal_access?: boolean;
  project_access?: boolean;
  version_control_access?: boolean;
  project_setup?: "" | "ProjectPartialCleanUp" | "ProjectCompleteCleanup" | string;
};

export type UpdateUserBody = Partial<CreateUserBody> & {
  username: string;
  employee_last_update_week?: string;
  employee_last_update_hours?: string;
  employee_last_update_summary?: string;
};

export type StartLinkedInConnectBody = {
  returnTo?: string;
};

export type StartLinkedInConnectResponse = {
  ok: boolean;
  authorizeUrl: string;
  returnTo?: string;
  scopes?: string[];
};

export type StartDiscordConnectBody = {
  returnTo?: string;
};

export type StartDiscordConnectResponse = {
  ok: boolean;
  authorizeUrl: string;
  returnTo?: string;
  joinUrl?: string;
  scopes?: string[];
};

export type StartJiraConnectBody = {
  returnTo?: string;
};

export type StartJiraConnectResponse = {
  ok: boolean;
  authorizeUrl: string;
  returnTo?: string;
  redirectUri?: string;
  scopes?: string[];
};

export type JiraConnectStatusResponse = {
  ok: boolean;
  connected: boolean;
  accountId?: string;
  email?: string;
  cloudId?: string;
  cloudName?: string;
  cloudUrl?: string;
  scope?: string;
  connectedAt?: string;
  tokenExpiresAt?: string;
};
