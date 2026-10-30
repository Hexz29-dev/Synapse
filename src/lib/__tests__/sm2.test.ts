import { describe, expect, it } from 'vitest';
import {
  calculateSM2,
  formatIntervalLabel,
  getMemoryStage,
  isCardDue,
  LEARN_AHEAD_MS,
  MAX_EASE_FACTOR,
  MAX_INTERVAL_DAYS,
  MIN_EASE_FACTOR,
  previewNextIntervals,
  TEN_MINUTES_IN_DAYS,
} from '../sm2';

describe('sm2', () => {
  const now = new Date('2026-10-30T12:00:00.000Z');

  const newCard = {
    repetition: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    lapses: 0,
  };

  it('garante que LEARN_AHEAD_MS seja menor que o intervalo de erro (10 min)', () => {
    const errorIntervalMs = TEN_MINUTES_IN_DAYS * 24 * 60 * 60 * 1000;
    expect(LEARN_AHEAD_MS).toBeLessThan(errorIntervalMs);
  });

  it('agenda para 10 min e incrementa lapses ao errar (nota 1)', () => {
    const res = calculateSM2({ ...newCard, repetition: 3, intervalDays: 10, easeFactor: 2.5, lapses: 1 }, 1, now);
    expect(res.repetition).toBe(0);
    expect(res.intervalDays).toBeCloseTo(TEN_MINUTES_IN_DAYS, 6);
    expect(res.easeFactor).toBe(2.3);
    expect(res.lapses).toBe(2);
    expect(new Date(res.dueAt).getTime() - now.getTime()).toBeCloseTo(10 * 60_000, -2);
  });

  it('progride corretamente com "Bom" (nota 3) e recupera easeFactor gradualmente', () => {
    const step1 = calculateSM2(newCard, 3, now);
    expect(step1.repetition).toBe(1);
    expect(step1.intervalDays).toBe(1);
    expect(step1.easeFactor).toBe(2.55);

    const step2 = calculateSM2(step1, 3, now);
    expect(step2.repetition).toBe(2);
    expect(step2.intervalDays).toBe(4);
    expect(step2.easeFactor).toBe(2.6);

    const step3 = calculateSM2(step2, 3, now);
    expect(step3.repetition).toBe(3);
    expect(step3.intervalDays).toBe(10); // Math.round(4 * 2.6)
  });

  it('evita "Ease Hell": recupera de 1.30 ao responder "Bom" e respeita piso e teto de EF', () => {
    const hard1 = calculateSM2({ ...newCard, easeFactor: 1.35 }, 2, now);
    expect(hard1.easeFactor).toBe(MIN_EASE_FACTOR);

    const goodRecovery = calculateSM2(hard1, 3, now);
    expect(goodRecovery.easeFactor).toBeGreaterThan(MIN_EASE_FACTOR);
    expect(goodRecovery.easeFactor).toBe(1.35);

    const capped = calculateSM2({ ...newCard, easeFactor: 2.95 }, 4, now);
    expect(capped.easeFactor).toBe(MAX_EASE_FACTOR);
  });

  it('limita o intervalo máximo em MAX_INTERVAL_DAYS', () => {
    const mature = {
      repetition: 8,
      intervalDays: 300,
      easeFactor: 2.5,
      lapses: 0,
    };
    const res = calculateSM2(mature, 4, now);
    expect(res.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it('calcula revisão adiantada proporcionalmente ao tempo decorrido desde a última revisão', () => {
    // Cartão com intervalo de 10 dias revisado há apenas 2 dias (20% do intervalo decorrido)
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000).toISOString();
    const eightDaysAhead = new Date(now.getTime() + 8 * 86_400_000).toISOString();

    const earlyRes = calculateSM2(
      {
        repetition: 3,
        intervalDays: 10,
        easeFactor: 2.5,
        lapses: 0,
        lastReviewedAt: twoDaysAgo,
        dueAt: eightDaysAhead,
      },
      3,
      now
    );

    // No SM-2 completo seria 25 dias (+15 dias). Com 20% decorrido, cresce apenas +3 dias -> 13 dias
    expect(earlyRes.intervalDays).toBe(13);
    // Como menos de 50% do intervalo passou, não infla a contagem de repetições
    expect(earlyRes.repetition).toBe(3);

    // Se revisado imediatamente após a última revisão (0 dias decorridos), não aumenta o intervalo
    const immediateRes = calculateSM2(
      {
        repetition: 3,
        intervalDays: 10,
        easeFactor: 2.5,
        lapses: 0,
        lastReviewedAt: now.toISOString(),
      },
      3,
      now
    );
    expect(immediateRes.intervalDays).toBe(10);
  });

  it('formata rótulos de intervalo e pré-visualiza as 4 notas', () => {
    expect(formatIntervalLabel(TEN_MINUTES_IN_DAYS)).toBe('10 min');
    expect(formatIntervalLabel(0.5)).toBe('12 h');
    expect(formatIntervalLabel(1)).toBe('1 dia');
    expect(formatIntervalLabel(15)).toBe('15 dias');
    expect(formatIntervalLabel(30)).toBe('1 mês');
    expect(formatIntervalLabel(90)).toBe('3 meses');
    expect(formatIntervalLabel(365)).toBe('1 ano');

    const preview = previewNextIntervals(newCard, now);
    expect(preview).toEqual({
      1: '10 min',
      2: '1 dia',
      3: '1 dia',
      4: '3 dias',
    });
  });

  it('classifica estágios de memória e vencimento corretamente', () => {
    expect(getMemoryStage({ repetition: 0, intervalDays: 0 })).toBe('new');
    expect(getMemoryStage({ repetition: 0, intervalDays: 0.007, lastReviewedAt: now.toISOString() })).toBe('learning');
    expect(getMemoryStage({ repetition: 2, intervalDays: 10, lastReviewedAt: now.toISOString() })).toBe('young');
    expect(getMemoryStage({ repetition: 5, intervalDays: 30, lastReviewedAt: now.toISOString() })).toBe('mature');

    expect(isCardDue({ dueAt: '2026-10-30T11:59:00.000Z' }, now)).toBe(true);
    expect(isCardDue({ dueAt: '2026-10-30T12:01:00.000Z' }, now)).toBe(false);
  });
});

