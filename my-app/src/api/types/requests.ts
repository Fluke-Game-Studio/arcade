export type ApiRequestRecord = {
  requestId: string;
  kind: string;
  requestType: string;
  title: string;
  summary?: string;
  username: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  agentId?: string;
  reason?: string;
  payload?: Record<string, any>;
  [k: string]: any;
};

export type CreateRequestBody = {
  kind: string;
  title: string;
  summary?: string;
  payload?: Record<string, any>;
};

export type ReviewRequestBody = {
  requestId: string;
  decision: "approved" | "rejected";
  reviewNote?: string;
};
