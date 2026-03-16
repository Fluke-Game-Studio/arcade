export type ApiProject = {
  projectId: string;
  name: string;
  slug?: string;
  description?: string;
  project_owner?: string;
  project_producer?: string;
  project_budget_total?: number | string;
  project_budget_consumed?: number | string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  last_activity_at?: string;
  [k: string]: any;
};

export type SaveProjectBody = {
  projectId?: string;
  name: string;
  description?: string;
  project_owner?: string;
  project_producer?: string;
  project_budget_total?: string | number;
  project_budget_consumed?: string | number;
  status?: string;
};