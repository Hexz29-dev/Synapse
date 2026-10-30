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
// Tipos das linhas do Postgres e Mapeadores snake_case ↔ camelCase
// ---------------------------------------------------------------------------
interface DeckRow {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface CardRow {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  tags: string[] | null;
  repetition: number | string | null;
  interval_days: number | string | null;
  ease_factor: number | string | null;
  due_at: string;
  last_reviewed_at: string | null;
  lapses: number | string | null;
  created_at: string;
}

interface ReviewLogRow {
  id: string;
  card_id: string;
  deck_id: string;
  grade: number | string;
  interval_before: number | string | null;
  interval_after: number | string | null;
  ease_after: number | string | null;
  reviewed_at: string;
}

const toDeck = (d: DeckRow): Deck => ({
  id: d.id,
  title: d.title,
  description: d.description ?? '',
  createdAt: d.created_at,
});

const toCard = (c: CardRow): Flashcard => ({
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

const toLog = (l: ReviewLogRow): ReviewLog => ({
  id: l.id,
  cardId: l.card_id,
  deckId: l.deck_id,
  grade: Number(l.grade) as ReviewGrade,
  intervalBefore: Number(l.interval_before ?? 0),
  intervalAfter: Number(l.interval_after ?? 0),
  easeAfter: Number(l.ease_after ?? 2.5),
  reviewedAt: l.reviewed_at,
});

// ---------------------------------------------------------------------------
// Paginação automática para contornar o limite de 1000 linhas do PostgREST
// ---------------------------------------------------------------------------
const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PgError }>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await fetchPage(offset, offset + PAGE_SIZE - 1);
    check(error);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
export async function fetchLibrary(userId: string): Promise<{ decks: Deck[]; cards: Flashcard[]; logs: ReviewLog[] }> {
  const db = requireClient();
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();

  const [deckRows, cardRows, logRows] = await Promise.all([
    fetchAllPages<DeckRow>((from, to) =>
      db
        .from('decks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllPages<CardRow>((from, to) =>
      db
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllPages<ReviewLogRow>((from, to) =>
      db
        .from('review_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('reviewed_at', since)
        .order('reviewed_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
    ),
  ]);

  return {
    decks: deckRows.map(toDeck),
    cards: cardRows.map(toCard),
    logs: logRows.map(toLog),
  };
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
  return toDeck(data as DeckRow);
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
  return toCard(data as CardRow);
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
// Revisão (atômica via RPC `review_card`)
// ---------------------------------------------------------------------------
export async function persistReview(_userId: string, card: Flashcard, log: ReviewLog): Promise<void> {
  const db = requireClient();
  const { error } = await db.rpc('review_card', {
    p_card_id: card.id,
    p_log_id: log.id,
    p_grade: log.grade,
    p_repetition: card.repetition,
    p_interval_before: log.intervalBefore,
    p_interval_after: card.intervalDays,
    p_ease_after: card.easeFactor,
    p_due_at: card.dueAt,
    p_reviewed_at: log.reviewedAt,
    p_lapses: card.lapses,
  });
  check(error);
}
