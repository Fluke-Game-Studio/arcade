export type ApiApplicantListItem = {
  applicant_id: string;
  fullName?: string;
  email?: string;
  roleId?: string;
  roleTitle?: string;
  status?: string;
  shortlistRating?: string;
  shortlistUpdatedAt?: string;
  shortlistUpdatedBy?: string;
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
  roleOptions?: string[];
  genderOptions?: string[];
};

export type ApplicantRichEmailType =
  | "INTRO"
  | "TECH"
  | "REJECT"
  | "CONFIRMATION"
  | "GENERIC";

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
  attachments?: EmailAttachment[];
  from?: string;
  cc?: string[];
  bcc?: string[];
  customHtmlBody?: string;
  customTextBody?: string;
  customBody?: string;
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
  attachments?: EmailAttachment[];
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
  createEmployeeUser?: boolean;
  requireCommitment?: boolean;
  attachments?: EmailAttachment[];
};

export type EmailAttachment = {
  name: string;
  mimeType: string;
  // At least one of dataUrl / contentBase64 / s3Key must be set — the backend
  // (normalizeAttachmentsFromBody) reads them in that priority order. Attachments
  // staged via the presigned-upload flow only need s3Key; the backend fetches the
  // bytes from S3 itself, so there's no need to also inline the file as base64.
  dataUrl?: string;
  contentBase64?: string;
  size: number;
  s3Key?: string;
  publicUrl?: string;
};

export type EmployeeDocEmailType = "EXPERIENCE" | "RECOMMENDATION" | "TERMINATION";

export type SendEmployeeDocEmailBody = {
  type: EmployeeDocEmailType;
  roleTitle?: string;
  subjectOverride?: string;
  setStatus?: string;
  dateStarted?: string;
  dateEnded?: string;
  wordCount?: number;
  coreSkills?: string;
  peopleSkills?: string;
  recommendationBody?: string;
  terminationReason?: string;
  terminationBody?: string;
  vars?: Record<string, any>;
};
