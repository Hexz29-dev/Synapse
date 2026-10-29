export type ReviewGrade = 1 | 2 | 3 | 4;
// 1 = Errei · 2 = Difícil · 3 = Bom · 4 = Fácil

export type MemoryStage = 'new' | 'learning' | 'young' | 'mature';

export interface Deck {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  tags: string[];
  repetition: number;
  intervalDays: number; // pode ser fração de dia (ex.: 0.007 ≈ 10 min)
  easeFactor: number; // inicia em 2.50, mínimo 1.30
  dueAt: string; // ISO
  lastReviewedAt?: string;
  lapses: number;
  createdAt: string;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  deckId: string;
  grade: ReviewGrade;
  intervalBefore: number;
  intervalAfter: number;
  easeAfter: number;
  reviewedAt: string;
}

export interface SM2Result {
  repetition: number;
  intervalDays: number;
  easeFactor: number;
  dueAt: string;
  lapses: number;
}
