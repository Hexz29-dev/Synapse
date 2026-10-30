import type { Deck, Flashcard, ReviewLog } from '../types/flashcard';

export interface PendingReviewItem {
  id: string; // log.id
  userId: string;
  card: Flashcard;
  log: ReviewLog;
  createdAt: string;
}

export interface CachedLibrarySnapshot {
  userId: string;
  decks: Deck[];
  cards: Flashcard[];
  logs: ReviewLog[];
  updatedAt: string;
}

const DB_NAME = 'synapse_offline_db';
const DB_VERSION = 1;
const STORE_REVIEWS = 'pending_reviews';
const STORE_CACHE = 'library_cache';

const memoryReviews = new Map<string, PendingReviewItem>();
const memoryCache = new Map<string, CachedLibrarySnapshot>();

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_REVIEWS)) {
        const store = db.createObjectStore(STORE_REVIEWS, { keyPath: 'id' });
        store.createIndex('by_user', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'userId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir IndexedDB'));
  });
}

export async function enqueuePendingReview(item: PendingReviewItem): Promise<void> {
  if (!hasIndexedDB()) {
    memoryReviews.set(item.id, item);
    return;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REVIEWS, 'readwrite');
    tx.objectStore(STORE_REVIEWS).put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Falha ao salvar revisão na fila local'));
    };
  });
}

export async function listPendingReviews(userId: string): Promise<PendingReviewItem[]> {
  if (!hasIndexedDB()) {
    return Array.from(memoryReviews.values())
      .filter((item) => item.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REVIEWS, 'readonly');
    const idx = tx.objectStore(STORE_REVIEWS).index('by_user');
    const req = idx.getAll(userId);
    req.onsuccess = () => {
      db.close();
      const items = (req.result as PendingReviewItem[]) ?? [];
      items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(items);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('Falha ao listar revisões pendentes'));
    };
  });
}

export async function removePendingReview(id: string): Promise<void> {
  if (!hasIndexedDB()) {
    memoryReviews.delete(id);
    return;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REVIEWS, 'readwrite');
    tx.objectStore(STORE_REVIEWS).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Falha ao remover revisão sincronizada'));
    };
  });
}

export async function saveLibraryCache(snapshot: CachedLibrarySnapshot): Promise<void> {
  if (!hasIndexedDB()) {
    memoryCache.set(snapshot.userId, snapshot);
    return;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    tx.objectStore(STORE_CACHE).put(snapshot);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Falha ao salvar cache local'));
    };
  });
}

export async function loadLibraryCache(userId: string): Promise<CachedLibrarySnapshot | null> {
  if (!hasIndexedDB()) {
    return memoryCache.get(userId) ?? null;
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readonly');
    const req = tx.objectStore(STORE_CACHE).get(userId);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as CachedLibrarySnapshot | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('Falha ao ler cache local'));
    };
  });
}

