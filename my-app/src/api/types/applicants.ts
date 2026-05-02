export type ApiApplicantListItem = {
  applicant_id: string;
  fullName?: string;
  email?: string;
  roleId?: string;
  roleTitle?: string;
  status?: string;
  source?: string;
  formVersion?: string;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  sourceIp?: string;
  userAgent?: string;
  emailHistory?: string | any;
  payload?: any;
  [k: string]: any;
};

export type ApiApplicantDetails = ApiApplicantListItem;

export type ApiApplicantPageResponse = {
  items: ApiApplicantListItem[];
  count?: number;
  limit?: number;
  cursor?: string;
  nextCursor?: string | null;
};

export type ApplicantRichEmailType =
  | "INTRO"
  | "TECH"
  | "REJECT"
  | "CONFIRMATION";

export type SendApplicantRichEmailBody = {
  type: ApplicantRichEmailType;
  roleTitle: string;
  calendlyUrl?: string;
  vars?: { extraInfo?: string } & Record<string, any>;
  setStatus?: string;
  meetingTitle?: string;
  meetingWhen?: string;
  meetingLink?: string;
  subjectOverride?: string;
};

export type ApplicantDocEmailType = "NDA" | "OFFER";

export type SendApplicantDocEmailBody = {
  type: ApplicantDocEmailType;
  roleTitle: string;
  subjectOverride?: string;
  setStatus?: string;
  vars?: Record<string, any>;
  dateStarted?: string;
  employment_type?: string;
  employee_role?: "super" | "admin" | "employee";
  createEmployeeUser?: boolean;
};

export type SendApplicantWelcomeEmailBody = {
  type: "WELCOME";
  roleTitle: string;
  department?: string;
  address?: string;
  city?: string;
  dateStarted?: string;
  subjectOverride?: string;
  applicantId?: string;
  extraInfo?: string;
  vars?: Record<string, any>;
  setStatus?: string;
};

export type EmployeeDocEmailType = "EXPERIENCE";

export type SendEmployeeDocEmailBody = {
  type: EmployeeDocEmailType;
  roleTitle?: string;
  subjectOverride?: string;
  setStatus?: string;
  dateStarted?: string;
  dateEnded?: string;
  vars?: Record<string, any>;
};
