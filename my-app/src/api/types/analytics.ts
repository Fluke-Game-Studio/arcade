// src/api/analytics.ts

export type AnalyticsEmployeeLite = {
  username: string;
  name: string;
  email?: string;
  role?: string;
  department?: string;
  title?: string;
};

export type AnalyticsWeeklyStatusRow = AnalyticsEmployeeLite & {
  updatesCount: number;
  submittedUpdate: boolean;
  timesheetEntries: number;
  submittedTimesheet: boolean;
  totalHours: number;
  lastUpdateAt?: string;
  lastTimesheetAt?: string;
};

export type AnalyticsProjectBreakdownItem = {
  projectId: string;
  updates: number;
  totalHours: number;
  contributors: number;
};

export type AnalyticsContributorBreakdownItem = {
  username: string;
  name: string;
  email?: string;
  role?: string;
  department?: string;
  updates: number;
  totalHours: number;
};

export type AnalyticsUnderReportedItem = AnalyticsEmployeeLite & {
  totalHours: number;
  missingHours: number;
  timesheetEntries: number;
  lastTimesheetAt?: string;
};

export type AnalyticsOverview = {
  teamSize: number;
  updatesCount: number;
  timesheetEntries: number;
  contributors: number;
  totalHours: number;
};

export type AnalyticsComplianceTotals = {
  employees: number;
  submittedUpdates: number;
  missingUpdates: number;
  submittedTimesheets: number;
  missingTimesheets: number;
  underReportedHours: number;
  noActivity: number;
  fullySubmitted: number;
  partiallySubmitted: number;
  totalHours: number;
};

export type AnalyticsWeeklySubmissionResponse = {
  ok: true;
  weekStart: string;
  projectId?: string;
  totals: {
    employees: number;
    submittedUpdates: number;
    missingUpdates: number;
    submittedTimesheets: number;
    missingTimesheets: number;
    fullySubmitted: number;
    partiallySubmitted: number;
    totalHours: number;
  };
  rows: AnalyticsWeeklyStatusRow[];
};

export type AnalyticsMissingListResponse = {
  ok: true;
  weekStart: string;
  projectId?: string;
  count: number;
  items: AnalyticsEmployeeLite[];
};

export type AnalyticsUnderReportedResponse = {
  ok: true;
  weekStart: string;
  projectId?: string;
  minHours: number;
  count: number;
  items: AnalyticsUnderReportedItem[];
};

export type AnalyticsProjectBreakdownResponse = {
  ok: true;
  weekStart: string;
  projectId?: string;
  count: number;
  items: AnalyticsProjectBreakdownItem[];
};

export type AnalyticsContributorBreakdownResponse = {
  ok: true;
  weekStart: string;
  projectId?: string;
  count: number;
  items: AnalyticsContributorBreakdownItem[];
};

export type AnalyticsTeamOverviewResponse = {
  ok: true;
  weekStart: string;
  projectId?: string;
  totals: AnalyticsOverview;
};

export type AnalyticsWeeklyComplianceResponse = {
  ok: true;
  weekStart: string;
  projectId?: string;
  totals: AnalyticsComplianceTotals;
  missingUpdates: AnalyticsEmployeeLite[];
  missingTimesheets: AnalyticsEmployeeLite[];
  underReportedHours: AnalyticsUnderReportedItem[];
  noActivity: AnalyticsEmployeeLite[];
  rows: AnalyticsWeeklyStatusRow[];
};

export type AnalyticsDashboardAttention = {
  missingUpdates: AnalyticsEmployeeLite[];
  missingTimesheets: AnalyticsEmployeeLite[];
  underReportedHours: AnalyticsUnderReportedItem[];
  noActivity: AnalyticsEmployeeLite[];
};

export type AnalyticsDashboardResponse = {
  ok: true;
  weekStart: string;
  projectId?: string;
  overview: AnalyticsOverview;
  compliance: AnalyticsComplianceTotals;
  projectBreakdown: AnalyticsProjectBreakdownItem[];
  contributorBreakdown: AnalyticsContributorBreakdownItem[];
  attention: AnalyticsDashboardAttention;
  rows: AnalyticsWeeklyStatusRow[];
};

export type AnalyticsQuery = {
  weekStart?: string;
  weekOf?: string;
  projectId?: string;
  department?: string;
  role?: string;
  minHours?: number;
  includeInactive?: boolean;
  includeRows?: boolean;
};

export type ApiRequest = <T = any>(
  path: string,
  init?: RequestInit
) => Promise<T>;

function cleanQuery(query?: AnalyticsQuery): string {
  const params = new URLSearchParams();

  if (!query) return "";

  if (query.weekStart) {
    params.set("weekStart", query.weekStart);
  } else if (query.weekOf) {
    params.set("weekOf", query.weekOf);
  }

  if (query.projectId) params.set("projectId", query.projectId);
  if (query.department) params.set("department", query.department);
  if (query.role) params.set("role", query.role);

  if (typeof query.minHours === "number" && Number.isFinite(query.minHours)) {
    params.set("minHours", String(query.minHours));
  }

  if (typeof query.includeInactive === "boolean") {
    params.set("includeInactive", String(query.includeInactive));
  }

  if (typeof query.includeRows === "boolean") {
    params.set("includeRows", String(query.includeRows));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function createAnalyticsAPI(request: ApiRequest) {
  return {
    getDashboard(query?: AnalyticsQuery) {
      return request<AnalyticsDashboardResponse>(
        `/analytics/dashboard${cleanQuery(query)}`
      );
    },

    getWeeklyCompliance(query?: AnalyticsQuery) {
      return request<AnalyticsWeeklyComplianceResponse>(
        `/analytics/weekly-compliance${cleanQuery(query)}`
      );
    },

    getSubmissionStatus(query?: AnalyticsQuery) {
      return request<AnalyticsWeeklySubmissionResponse>(
        `/analytics/submission-status${cleanQuery(query)}`
      );
    },

    getMissingUpdates(query?: AnalyticsQuery) {
      return request<AnalyticsMissingListResponse>(
        `/analytics/missing-updates${cleanQuery(query)}`
      );
    },

    getMissingTimesheets(query?: AnalyticsQuery) {
      return request<AnalyticsMissingListResponse>(
        `/analytics/missing-timesheets${cleanQuery(query)}`
      );
    },

    getUnderReportedHours(query?: AnalyticsQuery) {
      return request<AnalyticsUnderReportedResponse>(
        `/analytics/under-reported-hours${cleanQuery(query)}`
      );
    },

    getNoActivity(query?: AnalyticsQuery) {
      return request<AnalyticsMissingListResponse>(
        `/analytics/no-activity${cleanQuery(query)}`
      );
    },

    getProjectBreakdown(query?: AnalyticsQuery) {
      return request<AnalyticsProjectBreakdownResponse>(
        `/analytics/project-breakdown${cleanQuery(query)}`
      );
    },

    getContributorBreakdown(query?: AnalyticsQuery) {
      return request<AnalyticsContributorBreakdownResponse>(
        `/analytics/contributor-breakdown${cleanQuery(query)}`
      );
    },

    getTeamOverview(query?: AnalyticsQuery) {
      return request<AnalyticsTeamOverviewResponse>(
        `/analytics/team-overview${cleanQuery(query)}`
      );
    },
  };
}

export type AnalyticsAPI = ReturnType<typeof createAnalyticsAPI>;