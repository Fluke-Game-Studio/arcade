export type ApiTimeLogRow = {
  id: string;
  projectId: string;
  weekStart: string;
  userId: string;
  userName?: string;
  startedAt: string;
  stoppedAt: string;
  durationMinutes: number;
  notes?: string;
  source?: string;
  createdAt?: string;
  [k: string]: any;
};

export type SubmitTimeLogBody = {
  startedAt: string;
  stoppedAt: string;
  durationMinutes?: number;
  notes?: string;
  source?: string;
  projectId?: string;
};