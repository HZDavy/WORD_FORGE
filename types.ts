
export interface VocabularyItem {
  id: string;
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
