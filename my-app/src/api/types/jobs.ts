export type JobStatus = "enabled" | "disabled" | "paused";

export type JobQuestionType =
  | "short_text"
  | "long_text"
  | "checkbox"
  | "multi_select"
  | "single_select"
  | "number"
  | "email"
  | "phone"
  | "url"
  | "date"
  | "file";

export type JobQuestion = {
  id: string;
  label: string;
  type: JobQuestionType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  meta?: Record<string, any>;
};

export type QuestionBank = {
  general: JobQuestion[];
  personal: JobQuestion[];
  updatedAt?: string;
  updatedBy?: string;
};

export type ApiJob = {
  jobId: string;
  title: string;
  slug?: string;
  location?: string;
  department?: string;
  description?: string;
  tags?: string[];
  status: JobStatus;
  roleQuestions?: JobQuestion[];
  generalBankVersion?: string;
  personalBankVersion?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

export type UpsertJobBody = {
  jobId?: string;
  title: string;
  slug?: string;
  location?: string;
  department?: string;
  description?: string;
  tags?: string[];
  status?: JobStatus;
  roleQuestions?: JobQuestion[];
};

export type SetJobStatusBody = {
  status: JobStatus;
};

export type SaveQuestionBankBody = {
  general: JobQuestion[];
  personal: JobQuestion[];
};