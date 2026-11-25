// GENERATED from server/src/shared — do not edit here. Run `pnpm sync-shared` in server/.
// Wire contract for learner chapter actions under /api/v1/chapters/:chapterId.

export type LearningLogSaveResult = { savedAt: string };

export const CHAPTER_ERROR_CODES = {
  CHAPTER_LOCKED: "CHAPTER_LOCKED",
  CHECKPOINTS_INCOMPLETE: "CHECKPOINTS_INCOMPLETE",
  REFLECTION_INCOMPLETE: "REFLECTION_INCOMPLETE",
} as const;

export type PracticeQuizOption = {
  id: string;
  label: string;
};

export type PracticeQuizQuestion = {
  id: string;
  quizType: "single" | "multiple" | "true-false";
  prompt: string;
  options: PracticeQuizOption[];
};

export type PracticeQuizGenerateResponse = {
  questions: PracticeQuizQuestion[];
  answerToken: string;
  remaining: number;
  dailyLimit: number;
};

export type PracticeQuizCheckItemResult = {
  id: string;
  selected: string[];
  isCorrect: boolean;
  correctOptionIds: string[];
  explanation: string;
};

export type PracticeQuizCheckResponse = {
  score: number;
  maxScore: number;
  results: PracticeQuizCheckItemResult[];
};

