export type ApiAwardRuleAchievement = {
  id: string;
  type?: "achievement";
  title: string;
  description?: string;
  metric?: string;
  threshold?: number;
  isActive?: boolean;
};

export type ApiAwardRuleTrophy = {
  id: string;
  type?: "trophy";
  title: string;
  description?: string;
  tier?: string;
  achievementThreshold?: number;
  isActive?: boolean;
};

export type ApiMvpRule = {
  id: string;
  type?: "mvp";
  weeklySubmissionsWeight: number;
  fileUploadsWeight: number;
  featureCompletionsWeight: number;
  timesheetWeight: number;
  retroWeight: number;
  isActive?: boolean;
};

export type ApiProgressHistoryEntry = {
  id?: string;
  type?: string;
  at?: string;
  title?: string;
  by?: string;
  achievementId?: string;
  trophyId?: string;
  weekStart?: string;
  score?: number;
  eventType?: string;
  metricKey?: string;
  delta?: number;
  [k: string]: any;
};

export type ApiProgressAchievement = {
  id: string;
  title: string;
  description?: string;
  metric?: string;
  threshold?: number;
  source?: string;
  awardedBy?: string;
  awardedAt?: string;
  [k: string]: any;
};

export type ApiProgressTrophy = {
  id: string;
  title: string;
  description?: string;
  tier?: string;
  source?: string;
  awardedBy?: string;
  awardedAt?: string;
  [k: string]: any;
};

export type ApiUserProgress = {
  pk?: string;
  sk?: string;
  type?: string;
  username: string;
  achievements: ApiProgressAchievement[];
  trophies: ApiProgressTrophy[];
  stats: {
    loginCount?: number;
    loginDaysCount?: number;
    fileUploads?: number;
    featureCompletions?: number;
    weeklySubmissions?: number;
    timesheetSubmissions?: number;
    retroSubmissions?: number;
    totalHoursLogged?: number;
    daysWithHoursLogged?: number;
    [k: string]: any;
  };
  history: ApiProgressHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
};

export type ApiAwardsProgressSummaryUser = {
  username: string;
  displayName?: string;
  name?: string;
  employee_name?: string;
  projectId?: string;
  manager?: string;
  achievementsCount?: number;
  trophiesCount?: number;
  historyCount?: number;
  lastAwardAt?: string;
  updatedAt?: string;
  stats?: Record<string, number>;
  [k: string]: any;
};

export type ApiAwardsStudioLeaderboardEntry = {
  username: string;
  displayName?: string;
  value?: number;
  score?: number;
  achievementsCount?: number;
  trophiesCount?: number;
  totalAwards?: number;
  [k: string]: any;
};

export type ApiAwardsRecentItem = {
  id?: string;
  type?: string;
  eventType?: string;
  username?: string;
  title?: string;
  description?: string;
  tier?: string;
  achievementId?: string;
  trophyId?: string;
  weekStart?: string;
  score?: number;
  awardedAt?: string;
  at?: string;
  awardedBy?: string;
  by?: string;
  [k: string]: any;
};

export type ApiWeeklyMvpAward = {
  pk?: string;
  sk?: string;
  type?: string;
  weekStart: string;
  username: string;
  score: number;
  breakdown?: Record<string, number>;
  notes?: string;
  awardedBy?: string;
  updatedAt?: string;
  createdAt?: string;
};

export type ApiAwardsStudioSummary = {
  ok?: boolean;
  weekStart?: string;
  totals?: {
    users?: number;
    achievements?: number;
    trophies?: number;
    awards?: number;
    mvpAwards?: number;
    [k: string]: any;
  };
  recentAchievements?: ApiAwardsRecentItem[];
  recentTrophies?: ApiAwardsRecentItem[];
  recentAwards?: ApiAwardsRecentItem[];
  weeklyMvp?: ApiWeeklyMvpAward | null;
  leaderboards?: {
    byAwards?: ApiAwardsStudioLeaderboardEntry[];
    byAchievements?: ApiAwardsStudioLeaderboardEntry[];
    byTrophies?: ApiAwardsStudioLeaderboardEntry[];
    byScore?: ApiAwardsStudioLeaderboardEntry[];
    [k: string]: any;
  };
  [k: string]: any;
};

export type AwardAchievementBody = {
  username: string;
  achievementId?: string;
  id?: string;
  title?: string;
  description?: string;
  metric?: string;
  threshold?: number;
};

export type AwardAchievementResponse = {
  ok: boolean;
  username: string;
  achievement: ApiProgressAchievement;
  progress: ApiUserProgress;
};

export type AwardTrophyBody = {
  username: string;
  trophyId?: string;
  id?: string;
  title?: string;
  description?: string;
  tier?: string;
};

export type AwardTrophyResponse = {
  ok: boolean;
  username: string;
  trophy: ApiProgressTrophy;
  progress: ApiUserProgress;
};

export type SetWeeklyMvpManualBody = {
  weekStart: string;
  username: string;
  score?: number;
  breakdown?: Record<string, number>;
  notes?: string;
};

export type SetWeeklyMvpManualResponse = {
  ok: boolean;
  award: ApiWeeklyMvpAward;
};

export type AutoAwardWeeklyMvpBody = {
  weekStart: string;
  usernames: string[];
};

export type ApiWeeklyMvpCandidateScore = {
  username: string;
  score: number;
  breakdown: Record<string, number>;
  stats: Record<string, number>;
};

export type AutoAwardWeeklyMvpResponse = {
  ok: boolean;
  weekStart: string;
  winner: ApiWeeklyMvpCandidateScore;
  leaderboard: ApiWeeklyMvpCandidateScore[];
  award: ApiWeeklyMvpAward;
};

export type GetProgressAdminResponse = {
  ok: boolean;
  progress: ApiUserProgress;
};

export type GetAllProgressResponse = {
  ok?: boolean;
  items: ApiUserProgress[];
  count?: number;
  [k: string]: any;
};

export type GetAllProgressSummaryResponse = {
  ok?: boolean;
  items: ApiAwardsProgressSummaryUser[];
  count?: number;
  [k: string]: any;
};

export type GetStudioSummaryResponse = ApiAwardsStudioSummary;

export type GetRecentAwardsResponse = {
  ok?: boolean;
  items: ApiAwardsRecentItem[];
  count?: number;
  limit?: number;
  weekStart?: string;
  [k: string]: any;
};

export type GenerateAwardsNarrativeBody = {
  question?: string;
  username?: string;
  weekStart?: string;
  projectId?: string;
  provider?: "auto" | "openai" | "ollama";
  model?: string;
};

export type GenerateAwardsNarrativeResponse = {
  ok?: boolean;
  provider?: string;
  model?: string;
  contextType?: string;
  contextLabel?: string;
  reply: string;
  meta?: Record<string, any>;
  manager?: Record<string, any>;
};

export type CreateAwardAchievementRuleBody = {
  id: string;
  title: string;
  description?: string;
  metric: string;
  threshold: number;
  isActive?: boolean;
};

export type UpdateAwardAchievementRuleBody = {
  title?: string;
  description?: string;
  metric?: string;
  threshold?: number;
  isActive?: boolean;
};

export type DeleteAwardAchievementRuleResponse = {
  ok: boolean;
  id: string;
};

export type CreateAwardTrophyRuleBody = {
  id: string;
  title: string;
  description?: string;
  tier?: string;
  achievementThreshold: number;
  isActive?: boolean;
};

export type UpdateAwardTrophyRuleBody = {
  title?: string;
  description?: string;
  tier?: string;
  achievementThreshold?: number;
  isActive?: boolean;
};

export type DeleteAwardTrophyRuleResponse = {
  ok: boolean;
  id: string;
};

export type GamificationApiClient = {
  getAwardAchievementRules?: () => Promise<ApiAwardRuleAchievement[]>;
  createAwardAchievementRule?: (
    body: CreateAwardAchievementRuleBody
  ) => Promise<ApiAwardRuleAchievement>;
  updateAwardAchievementRule?: (
    ruleId: string,
    body: UpdateAwardAchievementRuleBody
  ) => Promise<ApiAwardRuleAchievement>;
  deleteAwardAchievementRule?: (
    ruleId: string
  ) => Promise<DeleteAwardAchievementRuleResponse>;

  getAwardTrophyRules?: () => Promise<ApiAwardRuleTrophy[]>;
  createAwardTrophyRule?: (
    body: CreateAwardTrophyRuleBody
  ) => Promise<ApiAwardRuleTrophy>;
  updateAwardTrophyRule?: (
    ruleId: string,
    body: UpdateAwardTrophyRuleBody
  ) => Promise<ApiAwardRuleTrophy>;
  deleteAwardTrophyRule?: (
    ruleId: string
  ) => Promise<DeleteAwardTrophyRuleResponse>;

  getMvpRule?: () => Promise<ApiMvpRule>;
  getProgressAdmin?: (username: string) => Promise<GetProgressAdminResponse>;
  getAllProgress?: () => Promise<GetAllProgressResponse>;
  getAllProgressSummary?: () => Promise<GetAllProgressSummaryResponse>;
  getStudioSummary?: (weekStart?: string) => Promise<GetStudioSummaryResponse>;
  getRecentAwards?: (params?: { limit?: number; weekStart?: string }) => Promise<GetRecentAwardsResponse>;

  awardAchievement?: (body: AwardAchievementBody) => Promise<AwardAchievementResponse>;
  awardTrophy?: (body: AwardTrophyBody) => Promise<AwardTrophyResponse>;
  setWeeklyMvpManual?: (body: SetWeeklyMvpManualBody) => Promise<SetWeeklyMvpManualResponse>;
  autoAwardWeeklyMvp?: (body: AutoAwardWeeklyMvpBody) => Promise<AutoAwardWeeklyMvpResponse>;

  generateAwardsNarrative?: (
    body: GenerateAwardsNarrativeBody
  ) => Promise<GenerateAwardsNarrativeResponse>;

  chatOverUpdates?: (body: {
    question: string;
    username?: string;
    weekStart?: string;
    projectId?: string;
    provider?: "auto" | "openai" | "ollama";
    model?: string;
    context?: string;
    agentRole?: string;
    perform?: boolean;
  }) => Promise<GenerateAwardsNarrativeResponse>;
};

function missing(name: string): never {
  throw new Error(`Missing API method: ${name}`);
}

export function createGamificationAPI(api: GamificationApiClient) {
  return {
    getAchievementRules: async () => {
      if (!api.getAwardAchievementRules) missing("getAwardAchievementRules");
      return api.getAwardAchievementRules();
    },

    createAchievementRule: async (body: CreateAwardAchievementRuleBody) => {
      if (!api.createAwardAchievementRule) missing("createAwardAchievementRule");
      return api.createAwardAchievementRule(body);
    },

    updateAchievementRule: async (
      ruleId: string,
      body: UpdateAwardAchievementRuleBody
    ) => {
      if (!api.updateAwardAchievementRule) missing("updateAwardAchievementRule");
      return api.updateAwardAchievementRule(ruleId, body);
    },

    deleteAchievementRule: async (ruleId: string) => {
      if (!api.deleteAwardAchievementRule) missing("deleteAwardAchievementRule");
      return api.deleteAwardAchievementRule(ruleId);
    },

    getTrophyRules: async () => {
      if (!api.getAwardTrophyRules) missing("getAwardTrophyRules");
      return api.getAwardTrophyRules();
    },

    createTrophyRule: async (body: CreateAwardTrophyRuleBody) => {
      if (!api.createAwardTrophyRule) missing("createAwardTrophyRule");
      return api.createAwardTrophyRule(body);
    },

    updateTrophyRule: async (
      ruleId: string,
      body: UpdateAwardTrophyRuleBody
    ) => {
      if (!api.updateAwardTrophyRule) missing("updateAwardTrophyRule");
      return api.updateAwardTrophyRule(ruleId, body);
    },

    deleteTrophyRule: async (ruleId: string) => {
      if (!api.deleteAwardTrophyRule) missing("deleteAwardTrophyRule");
      return api.deleteAwardTrophyRule(ruleId);
    },

    getMvpRule: async () => {
      if (!api.getMvpRule) missing("getMvpRule");
      return api.getMvpRule();
    },

    getProgressAdmin: async (username: string) => {
      if (!api.getProgressAdmin) missing("getProgressAdmin");
      return api.getProgressAdmin(username);
    },

    getAllProgress: async () => {
      if (!api.getAllProgress) missing("getAllProgress");
      return api.getAllProgress();
    },

    getAllProgressSummary: async () => {
      if (!api.getAllProgressSummary) missing("getAllProgressSummary");
      return api.getAllProgressSummary();
    },

    getStudioSummary: async (weekStart?: string) => {
      if (!api.getStudioSummary) missing("getStudioSummary");
      return api.getStudioSummary(weekStart);
    },

    getRecentAwards: async (params?: { limit?: number; weekStart?: string }) => {
      if (!api.getRecentAwards) missing("getRecentAwards");
      return api.getRecentAwards(params);
    },

    awardAchievement: async (body: AwardAchievementBody) => {
      if (!api.awardAchievement) missing("awardAchievement");
      return api.awardAchievement(body);
    },

    awardTrophy: async (body: AwardTrophyBody) => {
      if (!api.awardTrophy) missing("awardTrophy");
      return api.awardTrophy(body);
    },

    setWeeklyMvpManual: async (body: SetWeeklyMvpManualBody) => {
      if (!api.setWeeklyMvpManual) missing("setWeeklyMvpManual");
      return api.setWeeklyMvpManual(body);
    },

    autoAwardWeeklyMvp: async (body: AutoAwardWeeklyMvpBody) => {
      if (!api.autoAwardWeeklyMvp) missing("autoAwardWeeklyMvp");
      return api.autoAwardWeeklyMvp(body);
    },

    generateAwardsNarrative: async (body: GenerateAwardsNarrativeBody) => {
      if (api.generateAwardsNarrative) return api.generateAwardsNarrative(body);

      if (api.chatOverUpdates) {
        return api.chatOverUpdates({
          question:
            body.question ||
            "Create a polished narrative about how the studio functions, the culture of the team, and the awards and recognition the team has been earning.",
          username: body.username,
          weekStart: body.weekStart,
          projectId: body.projectId,
          provider: body.provider,
          model: body.model,
          context: "internal",
        });
      }

      missing("generateAwardsNarrative or chatOverUpdates");
    },
  };
}
