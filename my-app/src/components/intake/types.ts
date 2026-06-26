export type StoredIntakeContext = {
  key: string;
  label: string;
  description: string;
  questions: string[];
  backgroundInfo: string;
  sessionPrompt?: string;
  customInstructions: string;
  followUpInstructions: string;
  endNote: string;
  mcpActions: string[];
  includeJobQuestions?: boolean;
  intakeLinkMode?: "public" | "arcade";
  transcriptEmailEnabled?: boolean;
  transcriptEmailTo?: string;
};

export type FeedbackState = {
  stars: number;
  completedQs: boolean | null;
  listenedFully: string | null;
  stuckToTopic: string | null;
};

export type DebugEvent = {
  ts: number;
  dir: "out" | "in" | "info";
  type: string;
  detail: string;
};
