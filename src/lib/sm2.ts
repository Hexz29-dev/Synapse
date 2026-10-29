import { Flashcard, MemoryStage, ReviewGrade, SM2Result } from '../types/flashcard';

const MIN_EASE_FACTOR = 1.3;
const TEN_MINUTES_IN_DAYS = 10 / (24 * 60); // ~0.00694 dias

/**
 * Executa o cálculo do algoritmo SuperMemo 2 (SM-2) adaptado para 4 níveis de resposta:
 * 1 (Errei)   -> Reinicia repetição (0), intervalo de 10 minutos, reduz EF em 0.20
 * 2 (Difícil) -> Mantém progresso com passo conservador (x1.2), reduz EF em 0.15
 * 3 (Bom)     -> Progressão clássica SM-2 (1d -> 4d -> I * EF), mantém EF estável
 * 4 (Fácil)   -> Progressão acelerada (3d -> 7d -> I * EF * 1.3), aumenta EF em 0.15
 */
export function calculateSM2(
  card: Pick<Flashcard, 'repetition' | 'intervalDays' | 'easeFactor' | 'lapses'>,
  grade: ReviewGrade,
  now: Date = new Date()
): SM2Result {
  let { repetition, intervalDays, easeFactor, lapses } = card;

  if (grade === 1) {
    // Errei: reinicia a sequência de repetições e agenda para daqui a 10 minutos
    repetition = 0;
    intervalDays = TEN_MINUTES_IN_DAYS;
    easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor - 0.2).toFixed(2)));
    lapses = (lapses || 0) + 1;
  } else if (grade === 2) {
    // Difícil: resposta correta com esforço significativo
    if (repetition === 0) {
      intervalDays = 1;
      repetition = 1;
    } else if (repetition === 1) {
      intervalDays = 2;
      repetition = 2;
    } else {
      intervalDays = Math.max(intervalDays + 1, Math.round(intervalDays * 1.2));
      repetition += 1;
    }
    easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor - 0.15).toFixed(2)));
  } else if (grade === 3) {
    // Bom: resposta ideal dentro do esperado pelo SM-2
    if (repetition === 0) {
      intervalDays = 1;
    } else if (repetition === 1) {
      intervalDays = 4;
    } else {
      intervalDays = Math.max(intervalDays + 1, Math.round(intervalDays * easeFactor));
    }
    repetition += 1;
    // No SM-2 original, q=4 mantém o EF praticamente inalterado
    easeFactor = Math.max(MIN_EASE_FACTOR, Number(easeFactor.toFixed(2)));
  } else {
    // Fácil (grade === 4): resposta imediata sem hesitação
    if (repetition === 0) {
      intervalDays = 3;
    } else if (repetition === 1) {
      intervalDays = 7;
    } else {
      intervalDays = Math.max(intervalDays + 2, Math.round(intervalDays * easeFactor * 1.3));
    }
    repetition += 1;
    easeFactor = Number((easeFactor + 0.15).toFixed(2));
  }

  const dueTimeMs = now.getTime() + intervalDays * 24 * 60 * 60 * 1000;
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
  card: Pick<Flashcard, 'repetition' | 'intervalDays' | 'easeFactor' | 'lapses'>
): Record<ReviewGrade, string> {
  return {
    1: formatIntervalLabel(calculateSM2(card, 1).intervalDays),
    2: formatIntervalLabel(calculateSM2(card, 2).intervalDays),
    3: formatIntervalLabel(calculateSM2(card, 3).intervalDays),
    4: formatIntervalLabel(calculateSM2(card, 4).intervalDays),
  };
}

/**
 * Classifica o cartão em um dos 4 estágios de memória (Caixas de Leitner)
 */
export function getMemoryStage(card: Flashcard): MemoryStage {
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

export function isCardDue(card: Flashcard, referenceDate: Date = new Date()): boolean {
  return new Date(card.dueAt).getTime() <= referenceDate.getTime();
}
