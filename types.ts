export interface VocabularyItem {
  id: string;
  word: string;
  definition: string;
  matched?: boolean;
}

export enum GameMode {
  MENU = 'MENU',
  FLASHCARD = 'FLASHCARD',
  QUIZ = 'QUIZ',
  MATCHING = 'MATCHING'
}

export interface GameState {
  vocab: VocabularyItem[];
  mode: GameMode;
}
