import { Flashcard, MemoryStage, ReviewGrade, SM2Result } from '../types/flashcard';

export const MIN_EASE_FACTOR = 1.3;
export const MAX_EASE_FACTOR = 3.0;
export const MAX_INTERVAL_DAYS = 365;
export const TEN_MINUTES_IN_DAYS = 10 / (24 * 60); // ~0.00694 dias (10 min)

/**
 * Janela de antecipação da fila de estudo (2 min).
 * Deve ser estritamente menor que o intervalo de erro (10 min) para que
 * um cartão marcado como "Errei" não reapareça imediatamente na mesma hora.
 */
export const LEARN_AHEAD_MS = 2 * 60_000;

const DAY_MS = 86_400_000;

export type SM2CardInput = Pick<Flashcard, 'repetition' | 'intervalDays' | 'easeFactor' | 'lapses'> &
  Partial<Pick<Flashcard, 'dueAt' | 'lastReviewedAt'>>;

function clampEase(ef: number): number {
  return Math.min(MAX_EASE_FACTOR, Math.max(MIN_EASE_FACTOR, Number(ef.toFixed(2))));
}

/**
 * Calcula quantos dias realmente se passaram desde a última revisão (`lastReviewedAt`).
 * Retorna `null` quando o cartão é novo ou quando `lastReviewedAt` não foi informado.
 */
function getElapsedDays(card: SM2CardInput, now: Date): number | null {
  if (card.repetition === 0 || card.intervalDays <= 0 || !card.lastReviewedAt) return null;
  const elapsed = (now.getTime() - new Date(card.lastReviewedAt).getTime()) / DAY_MS;
  return Math.max(0, elapsed);
}

/**
 * Executa o cálculo do algoritmo SuperMemo 2 (SM-2) adaptado para 4 níveis de resposta,
 * com proteção contra "Ease Hell", teto de intervalo/facilidade e cálculo proporcional
 * para revisões adiantadas ("Estudar adiantado"):
 *
 * 1 (Errei)   -> Reinicia repetição (0), intervalo de 10 minutos, reduz EF em 0.20
 * 2 (Difícil) -> Mantém progresso com passo conservador (x1.2), reduz EF em 0.15
 * 3 (Bom)     -> Progressão SM-2 (1d -> 4d -> I * EF), recupera EF em +0.05 (evita Ease Hell)
 * 4 (Fácil)   -> Progressão acelerada (3d -> 7d -> I * EF * 1.3), aumenta EF em +0.15
 */
export function calculateSM2(
  card: SM2CardInput,
  grade: ReviewGrade,
  now: Date = new Date()
): SM2Result {
  const prevInterval = card.intervalDays;
  const elapsedDays = getElapsedDays(card, now);
  const isEarlyReview = elapsedDays !== null && elapsedDays < prevInterval;
  const elapsedRatio = isEarlyReview ? Math.min(1, Math.max(0, elapsedDays / prevInterval)) : 1;

  let { repetition, easeFactor, lapses } = card;
  let intervalDays: number;

  if (grade === 1) {
    // Errei: reinicia a sequência de repetições e agenda para daqui a 10 minutos
    repetition = 0;
    intervalDays = TEN_MINUTES_IN_DAYS;
    easeFactor = clampEase(easeFactor - 0.2);
    lapses = (lapses || 0) + 1;
  } else {
    let fullInterval: number;
    let easeDelta: number;

    if (grade === 2) {
      // Difícil: resposta correta com esforço significativo
      if (repetition === 0) {
        fullInterval = 1;
      } else if (repetition === 1) {
        fullInterval = 2;
      } else {
        fullInterval = Math.max(prevInterval + 1, Math.round(prevInterval * 1.2));
      }
      easeDelta = -0.15;
    } else if (grade === 3) {
      // Bom: resposta ideal dentro do esperado pelo SM-2 (+0.05 recupera gradualmente do "Ease Hell")
      if (repetition === 0) {
        fullInterval = 1;
      } else if (repetition === 1) {
        fullInterval = 4;
      } else {
        fullInterval = Math.max(prevInterval + 1, Math.round(prevInterval * easeFactor));
      }
      easeDelta = 0.05;
    } else {
      // Fácil (grade === 4): resposta imediata sem hesitação
      if (repetition === 0) {
        fullInterval = 3;
      } else if (repetition === 1) {
        fullInterval = 7;
      } else {
        fullInterval = Math.max(prevInterval + 2, Math.round(prevInterval * easeFactor * 1.3));
      }
      easeDelta = 0.15;
    }

    if (isEarlyReview) {
      // Revisão antes do vencimento: cresce apenas proporcionalmente ao tempo realmente decorrido
      const gained = Math.max(0, fullInterval - prevInterval);
      const scaledInterval = prevInterval + gained * elapsedRatio;
      intervalDays = Math.min(MAX_INTERVAL_DAYS, Number(scaledInterval.toFixed(4)));
      // Só avança estágio de repetição se pelo menos metade do intervalo previsto já tiver passado
      if (elapsedRatio >= 0.5) {
        repetition += 1;
      }
      const scaledEaseDelta = easeDelta > 0 ? easeDelta * elapsedRatio : easeDelta;
      easeFactor = clampEase(easeFactor + scaledEaseDelta);
    } else {
      intervalDays = Math.min(MAX_INTERVAL_DAYS, fullInterval);
      repetition += 1;
      easeFactor = clampEase(easeFactor + easeDelta);
    }
  }

  const dueTimeMs = now.getTime() + intervalDays * DAY_MS;
  const dueAt = new Date(dueTimeMs).toISOString();

  return {
    repetition,
    intervalDays,
    easeFactor,
    dueAt,
    lapses,
  };
}

/**
 * Formata um intervalo em dias para exibição concisa nos botões de resposta
 */
export function formatIntervalLabel(intervalDays: number): string {
  if (intervalDays < 0.04) {
    const mins = Math.max(1, Math.round(intervalDays * 24 * 60));
    return `${mins} min`;
  }
  if (intervalDays < 1) {
    const hours = Math.max(1, Math.round(intervalDays * 24));
    return `${hours} h`;
  }
  const days = Math.round(intervalDays);
  if (days === 1) return '1 dia';
  if (days < 30) return `${days} dias`;
  if (days < 365) {
    const months = (days / 30).toFixed(days >= 60 ? 0 : 1).replace('.0', '');
    return `${months} ${Number(months) === 1 ? 'mês' : 'meses'}`;
  }
  const years = (days / 365).toFixed(1).replace('.0', '');
  return `${years} ${Number(years) === 1 ? 'ano' : 'anos'}`;
}

/**
 * Retorna os rótulos de intervalo previstos para as 4 notas antes do usuário responder
 */
export function previewNextIntervals(
  card: SM2CardInput,
  now: Date = new Date()
): Record<ReviewGrade, string> {
  return {
    1: formatIntervalLabel(calculateSM2(card, 1, now).intervalDays),
    2: formatIntervalLabel(calculateSM2(card, 2, now).intervalDays),
    3: formatIntervalLabel(calculateSM2(card, 3, now).intervalDays),
    4: formatIntervalLabel(calculateSM2(card, 4, now).intervalDays),
  };
}

/**
 * Classifica o cartão em um dos 4 estágios de memória (Caixas de Leitner)
 */
export function getMemoryStage(card: Pick<Flashcard, 'repetition' | 'intervalDays' | 'lastReviewedAt'>): MemoryStage {
  if (card.repetition === 0 && !card.lastReviewedAt) {
    return 'new';
  }
  if (card.intervalDays < 3) {
    return 'learning';
  }
  if (card.intervalDays < 21) {
    return 'young';
  }
  return 'mature';
}

export function isCardDue(card: Pick<Flashcard, 'dueAt'>, referenceDate: Date = new Date()): boolean {
  return new Date(card.dueAt).getTime() <= referenceDate.getTime();
}
