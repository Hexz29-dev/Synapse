import { describe, expect, it } from 'vitest';
import type { Flashcard, ReviewLog } from '../../types/flashcard';
import {
  activityByDay,
  buildDueQueue,
  computeRetention,
  computeStreak,
  dueCount,
  forecast,
  newCardsReviewedToday,
  reviewedToday,
  stageBreakdown,
} from '../stats';

const DAY = 86_400_000;

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    deckId: overrides.deckId ?? 'deck-1',
    front: overrides.front ?? 'Frente',
    back: overrides.back ?? 'Verso',
    tags: overrides.tags ?? [],
    repetition: overrides.repetition ?? 0,
    intervalDays: overrides.intervalDays ?? 0,
    easeFactor: overrides.easeFactor ?? 2.5,
    dueAt: overrides.dueAt ?? new Date('2026-10-30T10:00:00.000Z').toISOString(),
    lastReviewedAt: overrides.lastReviewedAt,
    lapses: overrides.lapses ?? 0,
    createdAt: overrides.createdAt ?? new Date('2026-10-01T10:00:00.000Z').toISOString(),
  };
}

function makeLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    cardId: overrides.cardId ?? 'card-1',
    deckId: overrides.deckId ?? 'deck-1',
    grade: overrides.grade ?? 3,
    intervalBefore: overrides.intervalBefore ?? 0,
    intervalAfter: overrides.intervalAfter ?? 1,
    easeAfter: overrides.easeAfter ?? 2.5,
    reviewedAt: overrides.reviewedAt ?? new Date('2026-10-30T10:00:00.000Z').toISOString(),
  };
}

describe('stats', () => {
  const now = new Date('2026-10-30T15:00:00.000Z');

  it('calcula ofensiva (streak) de dias consecutivos terminando hoje ou ontem', () => {
    expect(computeStreak([], now)).toBe(0);

    const logs = [
      makeLog({ reviewedAt: new Date(now.getTime()).toISOString() }),
      makeLog({ reviewedAt: new Date(now.getTime() - DAY).toISOString() }),
      makeLog({ reviewedAt: new Date(now.getTime() - 2 * DAY).toISOString() }),
    ];
    expect(computeStreak(logs, now)).toBe(3);

    // Se ainda não revisou hoje mas revisou ontem e anteontem, mantém a ofensiva viva
    const logsYesterday = logs.slice(1);
    expect(computeStreak(logsYesterday, now)).toBe(2);
  });

  it('calcula taxa de retenção dos últimos 30 dias', () => {
    expect(computeRetention([], now)).toBeNull();

    const logs = [
      makeLog({ grade: 3, reviewedAt: now.toISOString() }),
      makeLog({ grade: 4, reviewedAt: now.toISOString() }),
      makeLog({ grade: 2, reviewedAt: now.toISOString() }),
      makeLog({ grade: 1, reviewedAt: now.toISOString() }),
      // Mais antigo que 30 dias (deve ser ignorado)
      makeLog({ grade: 1, reviewedAt: new Date(now.getTime() - 40 * DAY).toISOString() }),
    ];
    expect(computeRetention(logs, now)).toBe(75);
  });

  it('conta revisões de hoje e cartões novos introduzidos hoje', () => {
    const logs = [
      makeLog({ cardId: 'c1', intervalBefore: 0, reviewedAt: now.toISOString() }),
      makeLog({ cardId: 'c1', intervalBefore: 0.0069, reviewedAt: now.toISOString() }),
      makeLog({ cardId: 'c2', intervalBefore: 0, reviewedAt: now.toISOString() }),
      makeLog({ cardId: 'c3', intervalBefore: 4, reviewedAt: now.toISOString() }),
    ];
    expect(reviewedToday(logs, now)).toBe(4);
    expect(newCardsReviewedToday(logs, now)).toBe(2);
  });

  it('respeita o limite diário de cartões novos na fila de estudo sem bloquear revisões antigas', () => {
    const cards = [
      makeCard({ id: 'new-1', repetition: 0 }),
      makeCard({ id: 'new-2', repetition: 0 }),
      makeCard({ id: 'new-3', repetition: 0 }),
      makeCard({ id: 'rev-1', repetition: 2, intervalDays: 4, lastReviewedAt: new Date(now.getTime() - 4 * DAY).toISOString() }),
    ];

    // 1 cartão novo já estudado hoje, limite de 2 novos/dia -> permite apenas mais 1 novo + todas as revisões
    const logs = [makeLog({ cardId: 'new-0', intervalBefore: 0, reviewedAt: now.toISOString() })];

    const queue = buildDueQueue(cards, logs, { dailyNewLimit: 2, now });
    expect(queue.map((c) => c.id)).toEqual(['new-1', 'rev-1']);
    expect(dueCount(cards, now, { logs, dailyNewLimit: 2 })).toBe(2);
  });

  it('agrupa estágios de memória, atividade diária e previsão de 7 dias', () => {
    const cards = [
      makeCard({ repetition: 0, intervalDays: 0, dueAt: now.toISOString() }),
      makeCard({ repetition: 1, intervalDays: 1, lastReviewedAt: now.toISOString(), dueAt: new Date(now.getTime() + DAY).toISOString() }),
      makeCard({ repetition: 3, intervalDays: 10, lastReviewedAt: now.toISOString(), dueAt: new Date(now.getTime() + 2 * DAY).toISOString() }),
      makeCard({ repetition: 5, intervalDays: 30, lastReviewedAt: now.toISOString(), dueAt: new Date(now.getTime() + 30 * DAY).toISOString() }),
    ];

    expect(stageBreakdown(cards)).toEqual({ new: 1, learning: 1, young: 1, mature: 1 });

    const next7 = forecast(cards, 7, now);
    expect(next7).toHaveLength(7);
    expect(next7[0].count).toBe(1);
    expect(next7[1].count).toBe(1);
    expect(next7[2].count).toBe(1);

    const activity = activityByDay([makeLog({ reviewedAt: now.toISOString() })], 7, now);
    expect(activity).toHaveLength(7);
    expect(activity[6].count).toBe(1);
  });
});

