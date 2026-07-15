export type ApiTimesheetEntry = {
  date: string;
  hours: number;
};

export type UploadedFileRef = {
  name: string;
  mimeType: string;
  size: number;
  s3Key: string;
  publicUrl?: string;
};

export type PresignedUploadItem = {
  fileName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  uploadUrl: string;
  publicUrl?: string;
};

export type StorageFileItem = {
  key: string;
  lastModified?: string;
  size: number;
  etag?: string;
  storageClass?: string;
  url?: string;
  uploadedBy?: string;
};

export type CreateWeeklyUpdateUploadUrlsBody = {
  weekStart: string;
  files: Array<{
    fileName: string;
    mimeType: string;
    size: number;
  }>;
};

export type CreateWeeklyUpdateUploadUrlsResponse = {
  files: PresignedUploadItem[];
};

export type CreateStoreImageUploadUrlsBody = {
  itemId?: string;
  itemName?: string;
  files: Array<{
    fileName: string;
    mimeType: string;
    size: number;
  }>;
};

export type CreateStoreImageUploadUrlsResponse = {
  files: PresignedUploadItem[];
};

export type ListStorageFilesResponse = {
  ok?: boolean;
  bucket?: string;
  prefix?: string;
  limit?: number;
  items: StorageFileItem[];
  truncated?: boolean;
  nextContinuationToken?: string;
};

export type DeleteStorageFileResponse = {
  ok?: boolean;
  deletedS3Key?: string;
  bucket?: string;
};

export type ApiUpdateRow = {
  id: string;
  userId: string;
  userName?: string;
  employee_id?: string;
  employee_manager?: string;
  projectId: string;
  weekStart: string;
  accomplishments?: string;
  blockers?: string;
  next?: string;
  retrospective?: {
    worked?: string[];
    didnt?: string[];
    improve?: string[];
    [k: string]: any;
  };
  timesheet?: ApiTimesheetEntry[];
  attachments?: UploadedFileRef[];
  uploadStatus?: string;
  driveFolderLink?: string;
  createdAt?: string;
  [k: string]: any;
};

export type ApiUpdateSummary = {
  userId: string;
  userName?: string;
  employee_id?: string;
  employee_manager?: string;
  projectId: string;
  weekStart: string;
  createdAtFirst?: string;
  createdAtLast?: string;
  totalEntries: number;
  totalHours: number;
  accomplishments: string[];
  blockers: string[];
  next: string[];
  retrospective?: {
    worked?: string[];
    didnt?: string[];
    improve?: string[];
    [k: string]: any;
  };
  timesheet?: ApiTimesheetEntry[];
  attachments?: UploadedFileRef[];
  uploadStatus?: string;
  driveFolderId?: string;
  driveFolderLink?: string;
  [k: string]: any;
};

export type ApiUpdatesResponse = {
  items: ApiUpdateRow[];
  summaries: ApiUpdateSummary[];
  count: number;
  summaryCount: number;
  submitDates?: string[];
  submitDateCount?: number;
  limit?: number;
  cursor?: string;
  nextCursor?: string | null;
};

export type ApiMyUpdatesResponse = {
  summaries: ApiUpdateSummary[];
  summaryCount: number;
  limit?: number;
  cursor?: string;
  nextCursor?: string | null;
};

export type SubmitUpdateBody = {
  weekStart: string;
  accomplishments: string;
  blockers: string;
  next: string;
  submissionSource?: string;
  retrospective: {
    worked: string[];
    didnt: string[];
    improve: string[];
  };
  timesheet: { date: string; hours: number }[];
  uploadedFiles?: UploadedFileRef[];
  projectId?: string;
  jiraTicketKeys?: string[];
  jiraTickets?: Array<{
    key: string;
    summary?: string;
    status?: string;
    assignee?: string;
    updated?: string;
  }>;
};

export type SubmitUpdateResponse = {
  ok?: boolean;
  id?: string;
  uploadStatus?: string;
  driveFolderId?: string;
  driveFolderLink?: string;
  attachments?: UploadedFileRef[];
  message?: string;
};
