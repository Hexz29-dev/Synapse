import type { Flashcard, ReviewLog } from '../types/flashcard';
import { getMemoryStage, isCardDue } from './sm2';

const DAY = 86_400_000;

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Dias consecutivos com pelo menos uma revisão, terminando hoje (ou ontem). */
export function computeStreak(logs: ReviewLog[], now = new Date()): number {
  if (logs.length === 0) return 0;
  const days = new Set(logs.map((l) => dayKey(new Date(l.reviewedAt))));
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return streak;
}

/** Percentual de revisões dos últimos 30 dias que não foram "Errei". */
export function computeRetention(logs: ReviewLog[], now = new Date()): number | null {
  const since = now.getTime() - 30 * DAY;
  const recent = logs.filter((l) => new Date(l.reviewedAt).getTime() >= since);
  if (recent.length === 0) return null;
  return Math.round((recent.filter((l) => l.grade >= 2).length / recent.length) * 100);
}

export function reviewedToday(logs: ReviewLog[], now = new Date()): number {
  const key = dayKey(now);
  return logs.filter((l) => dayKey(new Date(l.reviewedAt)) === key).length;
}

export function dueCount(cards: Flashcard[], now = new Date()): number {
  return cards.filter((c) => isCardDue(c, now)).length;
}

export function stageBreakdown(cards: Flashcard[]) {
  const counts = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const c of cards) counts[getMemoryStage(c)] += 1;
  return counts;
}

/** Revisões por dia nas últimas `days` semanas-calendário (para o mapa de atividade). */
export function activityByDay(logs: ReviewLog[], days: number, now = new Date()) {
  const map = new Map<string, number>();
  for (const l of logs) {
    const k = dayKey(new Date(l.reviewedAt));
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today.getTime() - (days - 1 - i) * DAY);
    return { date, count: map.get(dayKey(date)) ?? 0 };
  });
}

/** Cartões agendados para cada um dos próximos `days` dias (atrasados contam em hoje). */
export function forecast(cards: Flashcard[], days: number, now = new Date()) {
  const today = startOfDay(now).getTime();
  return Array.from({ length: days }, (_, i) => {
    const start = today + i * DAY;
    const end = start + DAY;
    const count = cards.filter((c) => {
      const t = new Date(c.dueAt).getTime();
      return i === 0 ? t < end : t >= start && t < end;
    }).length;
    return { date: new Date(start), count };
  });
}

