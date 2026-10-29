import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Deck, Flashcard, ReviewGrade, ReviewLog } from '../types/flashcard';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const key =
  ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined))?.trim() ?? '';

export const isSupabaseConfigured = url.startsWith('http') && key.length > 0;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

/** Erro lançado quando as tabelas ainda não foram criadas no projeto. */
export class SchemaMissingError extends Error {
  constructor() {
    super('As tabelas do Synapse ainda não existem neste projeto Supabase.');
    this.name = 'SchemaMissingError';
  }
}

type PgError = { code?: string; message: string } | null;

function check(error: PgError): void {
  if (!error) return;
  if (error.code === 'PGRST205' || error.code === '42P01') throw new SchemaMissingError();
  throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Mapeadores snake_case (Postgres) ↔ camelCase (app)
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
const toDeck = (d: any): Deck => ({
  id: d.id,
  title: d.title,
  description: d.description ?? '',
  createdAt: d.created_at,
});

const toCard = (c: any): Flashcard => ({
  id: c.id,
  deckId: c.deck_id,
  front: c.front,
  back: c.back,
  tags: Array.isArray(c.tags) ? c.tags : [],
  repetition: Number(c.repetition ?? 0),
  intervalDays: Number(c.interval_days ?? 0),
  easeFactor: Number(c.ease_factor ?? 2.5),
  dueAt: c.due_at,
  lastReviewedAt: c.last_reviewed_at ?? undefined,
  lapses: Number(c.lapses ?? 0),
  createdAt: c.created_at,
});

const toLog = (l: any): ReviewLog => ({
  id: l.id,
  cardId: l.card_id,
  deckId: l.deck_id,
  grade: Number(l.grade) as ReviewGrade,
  intervalBefore: Number(l.interval_before ?? 0),
  intervalAfter: Number(l.interval_after ?? 0),
  easeAfter: Number(l.ease_after ?? 2.5),
  reviewedAt: l.reviewed_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
export async function fetchLibrary(userId: string): Promise<{ decks: Deck[]; cards: Flashcard[]; logs: ReviewLog[] }> {
  const db = requireClient();
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();

  const [d, c, l] = await Promise.all([
    db.from('decks').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    db.from('cards').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    db
      .from('review_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('reviewed_at', since)
      .order('reviewed_at', { ascending: false }),
  ]);
  check(d.error);
  check(c.error);
  check(l.error);

  return { decks: (d.data ?? []).map(toDeck), cards: (c.data ?? []).map(toCard), logs: (l.data ?? []).map(toLog) };
}

// ---------------------------------------------------------------------------
// Baralhos
// ---------------------------------------------------------------------------
export async function insertDeck(
  userId: string,
  input: { title: string; description: string }
): Promise<Deck> {
  const { data, error } = await requireClient()
    .from('decks')
    .insert({ user_id: userId, title: input.title, description: input.description })
    .select()
    .single();
  check(error);
  return toDeck(data);
}

export async function updateDeckRow(
  userId: string,
  id: string,
  input: { title: string; description: string }
): Promise<void> {
  const { error } = await requireClient().from('decks').update(input).eq('id', id).eq('user_id', userId);
  check(error);
}

export async function deleteDeckRow(userId: string, id: string): Promise<void> {
  const { error } = await requireClient().from('decks').delete().eq('id', id).eq('user_id', userId);
  check(error);
}

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------
export interface CardInput {
  deckId: string;
  front: string;
  back: string;
  tags: string[];
}

export async function insertCard(userId: string, input: CardInput): Promise<Flashcard> {
  const { data, error } = await requireClient()
    .from('cards')
    .insert({
      user_id: userId,
      deck_id: input.deckId,
      front: input.front,
      back: input.back,
      tags: input.tags,
    })
    .select()
    .single();
  check(error);
  return toCard(data);
}

export async function updateCardContent(userId: string, id: string, input: CardInput): Promise<void> {
  const { error } = await requireClient()
    .from('cards')
    .update({ deck_id: input.deckId, front: input.front, back: input.back, tags: input.tags })
    .eq('id', id)
    .eq('user_id', userId);
  check(error);
}

export async function deleteCardRow(userId: string, id: string): Promise<void> {
  const { error } = await requireClient().from('cards').delete().eq('id', id).eq('user_id', userId);
  check(error);
}

// ---------------------------------------------------------------------------
// Revisão
// ---------------------------------------------------------------------------
export async function persistReview(userId: string, card: Flashcard, log: ReviewLog): Promise<void> {
  const db = requireClient();
  const { error: cardErr } = await db
    .from('cards')
    .update({
      repetition: card.repetition,
      interval_days: card.intervalDays,
      ease_factor: card.easeFactor,
      due_at: card.dueAt,
      last_reviewed_at: card.lastReviewedAt,
      lapses: card.lapses,
    })
    .eq('id', card.id)
    .eq('user_id', userId);
  check(cardErr);

  const { error: logErr } = await db.from('review_logs').insert({
    id: log.id,
    user_id: userId,
    card_id: log.cardId,
    deck_id: log.deckId,
    grade: log.grade,
    interval_before: log.intervalBefore,
    interval_after: log.intervalAfter,
    ease_after: log.easeAfter,
    reviewed_at: log.reviewedAt,
  });
  check(logErr);
}
