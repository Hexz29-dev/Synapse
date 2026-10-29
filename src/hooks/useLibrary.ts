import { useCallback, useEffect, useState } from 'react';
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
import { calculateSM2 } from '../lib/sm2';

export type LibraryStatus = 'loading' | 'ready' | 'schema-missing' | 'error';

export function useLibrary(userId: string, onError: (message: string) => void) {
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [logs, setLogs] = useState<ReviewLog[]>([]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await fetchLibrary(userId);
      setDecks(data.decks);
      setCards(data.cards);
      setLogs(data.logs);
      setStatus('ready');
    } catch (err) {
      if (err instanceof SchemaMissingError) {
        setStatus('schema-missing');
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Falha ao carregar seus dados.');
        setStatus('error');
      }
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

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

  // --- Revisão (otimista) -------------------------------------------------
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
      await persistReview(userId, updated, log);
    } catch (err) {
      setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
      fail(err, 'Não foi possível salvar a revisão.');
    }
  };

  return {
    status,
    errorMessage,
    decks,
    cards,
    logs,
    reload: load,
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
