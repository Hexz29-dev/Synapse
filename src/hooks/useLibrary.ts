import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck, Flashcard, ReviewGrade, ReviewLog } from '../types/flashcard';
import {
  type CardInput,
  deleteCardRow,
  deleteDeckRow,
  fetchLibrary,
  insertCard,
  insertDeck,
  persistReview,
  SchemaMissingError,
  updateCardContent,
  updateDeckRow,
} from '../lib/supabase';
import {
  enqueuePendingReview,
  listPendingReviews,
  loadLibraryCache,
  removePendingReview,
  saveLibraryCache,
} from '../lib/offlineQueue';
import { calculateSM2 } from '../lib/sm2';
import { DEFAULT_DAILY_NEW_LIMIT } from '../lib/stats';

export type LibraryStatus = 'loading' | 'ready' | 'schema-missing' | 'error';

const DAILY_NEW_LIMIT_KEY = 'synapse_daily_new_limit';

function readDailyNewLimit(): number {
  if (typeof window === 'undefined') return DEFAULT_DAILY_NEW_LIMIT;
  const raw = localStorage.getItem(DAILY_NEW_LIMIT_KEY);
  if (raw === null) return DEFAULT_DAILY_NEW_LIMIT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DAILY_NEW_LIMIT;
}

export function useLibrary(userId: string, onError: (message: string) => void) {
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [dailyNewLimit, setDailyNewLimitState] = useState<number>(readDailyNewLimit);

  const syncingRef = useRef(false);

  const setDailyNewLimit = useCallback((limit: number) => {
    const normalized = Math.max(0, Math.floor(limit));
    setDailyNewLimitState(normalized);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DAILY_NEW_LIMIT_KEY, String(normalized));
    }
  }, []);

  const syncPendingReviews = useCallback(async () => {
    if (syncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    syncingRef.current = true;
    try {
      const pending = await listPendingReviews(userId);
      setPendingSyncCount(pending.length);
      for (const item of pending) {
        await persistReview(userId, item.card, item.log);
        await removePendingReview(item.id);
      }
      const remaining = await listPendingReviews(userId);
      setPendingSyncCount(remaining.length);
    } catch {
      // Mantém na fila local para tentar novamente quando a conexão estabilizar
    } finally {
      syncingRef.current = false;
    }
  }, [userId]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      await syncPendingReviews();
      const [data, pending] = await Promise.all([
        fetchLibrary(userId),
        listPendingReviews(userId),
      ]);

      // Mescla eventuais revisões pendentes locais sobre os dados do servidor
      const pendingCardMap = new Map(pending.map((p) => [p.card.id, p.card]));
      const existingLogIds = new Set(data.logs.map((l) => l.id));
      const unsyncedLogs = pending.map((p) => p.log).filter((l) => !existingLogIds.has(l.id));

      const mergedCards = data.cards.map((c) => pendingCardMap.get(c.id) ?? c);
      const mergedLogs = [...unsyncedLogs.reverse(), ...data.logs];

      setDecks(data.decks);
      setCards(mergedCards);
      setLogs(mergedLogs);
      setPendingSyncCount(pending.length);
      setStatus('ready');

      await saveLibraryCache({
        userId,
        decks: data.decks,
        cards: mergedCards,
        logs: mergedLogs,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    } catch (err) {
      if (err instanceof SchemaMissingError) {
        setStatus('schema-missing');
        return;
      }

      // Fallback offline: carrega o último snapshot do IndexedDB se disponível
      const cached = await loadLibraryCache(userId).catch(() => null);
      const pending = await listPendingReviews(userId).catch(() => []);
      if (cached) {
        setDecks(cached.decks);
        setCards(cached.cards);
        setLogs(cached.logs);
        setPendingSyncCount(pending.length);
        setStatus('ready');
        return;
      }

      setErrorMessage(err instanceof Error ? err.message : 'Falha ao carregar seus dados.');
      setStatus('error');
    }
  }, [userId, syncPendingReviews]);

  useEffect(() => {
    load();
  }, [load]);

  // Monitora reconexão de rede para sincronizar a fila local automaticamente
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncPendingReviews();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingReviews]);

  // Mantém o snapshot em cache atualizado conforme baralhos/cartões/logs mudam
  useEffect(() => {
    if (status !== 'ready') return;
    void saveLibraryCache({
      userId,
      decks,
      cards,
      logs,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  }, [status, userId, decks, cards, logs]);

  const fail = (err: unknown, fallback: string) => onError(err instanceof Error ? err.message : fallback);

  // --- Baralhos -----------------------------------------------------------
  const createDeck = async (input: { title: string; description: string }) => {
    try {
      const deck = await insertDeck(userId, input);
      setDecks((prev) => [...prev, deck]);
      return deck;
    } catch (err) {
      fail(err, 'Não foi possível criar o baralho.');
      return null;
    }
  };

  const updateDeck = async (id: string, input: { title: string; description: string }) => {
    const before = decks;
    setDecks((prev) => prev.map((d) => (d.id === id ? { ...d, ...input } : d)));
    try {
      await updateDeckRow(userId, id, input);
      return true;
    } catch (err) {
      setDecks(before);
      fail(err, 'Não foi possível salvar o baralho.');
      return false;
    }
  };

  const deleteDeck = async (id: string) => {
    const snapshot = { decks, cards, logs };
    setDecks((prev) => prev.filter((d) => d.id !== id));
    setCards((prev) => prev.filter((c) => c.deckId !== id));
    setLogs((prev) => prev.filter((l) => l.deckId !== id));
    try {
      await deleteDeckRow(userId, id);
      return true;
    } catch (err) {
      setDecks(snapshot.decks);
      setCards(snapshot.cards);
      setLogs(snapshot.logs);
      fail(err, 'Não foi possível excluir o baralho.');
      return false;
    }
  };

  // --- Cartões ------------------------------------------------------------
  const createCard = async (input: CardInput) => {
    try {
      const card = await insertCard(userId, input);
      setCards((prev) => [card, ...prev]);
      return true;
    } catch (err) {
      fail(err, 'Não foi possível criar o cartão.');
      return false;
    }
  };

  const updateCard = async (id: string, input: CardInput) => {
    const before = cards;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...input } : c)));
    try {
      await updateCardContent(userId, id, input);
      return true;
    } catch (err) {
      setCards(before);
      fail(err, 'Não foi possível salvar o cartão.');
      return false;
    }
  };

  const deleteCard = async (id: string) => {
    const before = { cards, logs };
    setCards((prev) => prev.filter((c) => c.id !== id));
    setLogs((prev) => prev.filter((l) => l.cardId !== id));
    try {
      await deleteCardRow(userId, id);
      return true;
    } catch (err) {
      setCards(before.cards);
      setLogs(before.logs);
      fail(err, 'Não foi possível excluir o cartão.');
      return false;
    }
  };

  // --- Revisão (otimista + fila offline IndexedDB) ------------------------
  const reviewCard = async (card: Flashcard, grade: ReviewGrade) => {
    const now = new Date();
    const sm2 = calculateSM2(card, grade, now);
    const updated: Flashcard = { ...card, ...sm2, lastReviewedAt: now.toISOString() };
    const log: ReviewLog = {
      id: crypto.randomUUID(),
      cardId: card.id,
      deckId: card.deckId,
      grade,
      intervalBefore: card.intervalDays,
      intervalAfter: sm2.intervalDays,
      easeAfter: sm2.easeFactor,
      reviewedAt: now.toISOString(),
    };

    setCards((prev) => prev.map((c) => (c.id === card.id ? updated : c)));
    setLogs((prev) => [log, ...prev]);

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline');
      }
      await persistReview(userId, updated, log);
      void syncPendingReviews();
    } catch (err) {
      try {
        await enqueuePendingReview({
          id: log.id,
          userId,
          card: updated,
          log,
          createdAt: now.toISOString(),
        });
        setPendingSyncCount((c) => c + 1);
      } catch {
        setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
        setLogs((prev) => prev.filter((l) => l.id !== log.id));
        fail(err, 'Não foi possível salvar a revisão.');
      }
    }
  };

  return {
    status,
    errorMessage,
    decks,
    cards,
    logs,
    isOnline,
    pendingSyncCount,
    dailyNewLimit,
    setDailyNewLimit,
    reload: load,
    syncPendingReviews,
    createDeck,
    updateDeck,
    deleteDeck,
    createCard,
    updateCard,
    deleteCard,
    reviewCard,
  };
}

export type Library = ReturnType<typeof useLibrary>;
