// Shared "how long should the AI draft be" control used by the applicant and
// employee-doc composers. Threads through to the backend as `maxTokens`, which
// the AI worker now actually honors (previously drafts had no explicit output
// budget at all, so they could get cut off mid-sentence with no way to ask for
// more or less).
export type DraftLength = "short" | "medium" | "long";

export const DRAFT_LENGTH_OPTIONS: Array<{ value: DraftLength; label: string; words: string; maxTokens: number }> = [
  { value: "short", label: "Short", words: "~120-180 words", maxTokens: 400 },
  { value: "medium", label: "Medium", words: "~250-350 words", maxTokens: 800 },
  { value: "long", label: "Long", words: "~450-600 words", maxTokens: 1400 },
];

export function draftLengthMaxTokens(length: DraftLength): number {
  return DRAFT_LENGTH_OPTIONS.find((o) => o.value === length)?.maxTokens || 800;
}

export function draftLengthWordsHint(length: DraftLength): string {
  return DRAFT_LENGTH_OPTIONS.find((o) => o.value === length)?.words || "~250-350 words";
}
