
export interface SourceFile {
  id: string;
  name: string;
  enabled: boolean;
  dateAdded: number;
  wordCount: number;
}

export interface VocabularyItem {
  id: string;
  sourceId?: string; // Links word to a specific source file
  word: string;
  definition: string;
  matched?: boolean;
  marked?: boolean;
  level: number; // 0, 1, 2, 3
  originalIndex: number; // To restore order
}

export enum GameMode {
  MENU = 'MENU',
  FLASHCARD = 'FLASHCARD',
  QUIZ = 'QUIZ',
  MATCHING = 'MATCHING',
  WORD_LIST = 'WORD_LIST'
}

export interface GameState {
  vocab: VocabularyItem[];
  mode: GameMode;
}

export interface GameProgress {
  flashcard?: { index: number };
  quiz?: { currentIndex: number; score: number; answeredState: Record<number, number | null> };
  matching?: { round: number };
}

export interface ForgeSaveData {
  version: string;
  timestamp: number;
  vocab: VocabularyItem[];
  sources: SourceFile[]; // Persist source configurations
  progress: GameProgress;
}
