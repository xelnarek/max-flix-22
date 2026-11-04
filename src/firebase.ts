import { initializeApp, getApps, getApp, setLogLevel } from 'firebase/app';
setLogLevel('error');
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  getDocFromServer,
  DocumentData,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type User, type Unsubscribe } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import {
  getLeaderboardSlice,
  mergeLeaderboardEntries,
  normalizeLeaderboardEntry,
  type LeaderboardEntry,
  type LeaderboardGameMode,
} from './leaderboard.ts';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeStorage = {
  getItem(key: string): string | null {
    if (!isBrowser) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore storage quota or private-mode errors
    }
  },
};

const LEADERBOARD_CACHE_KEY = 'maxfliz_cached_leaderboard';
const PENDING_LEADERBOARD_KEY = 'maxfliz_pending_score_submissions';

interface PendingLeaderboardWrite {
  id: string;
  payload: Omit<LeaderboardEntry, 'id' | 'syncStatus'>;
}

const parseCachedLeaderboard = (): LeaderboardEntry[] => {
  try {
    const raw = safeStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(Boolean).map((item: Partial<LeaderboardEntry>) =>
          normalizeLeaderboardEntry(item, item.id)
        )
      : [];
  } catch {
    return [];
  }
};

const parsePendingLeaderboardWrites = (): PendingLeaderboardWrite[] => {
  try {
    const raw = safeStorage.getItem(PENDING_LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingLeaderboardWrite =>
      Boolean(item && typeof item.id === 'string' && item.payload && typeof item.payload === 'object')
    );
  } catch {
    return [];
  }
};

const persistPendingLeaderboardWrites = (writes: PendingLeaderboardWrite[]): void => {
  safeStorage.setItem(PENDING_LEADERBOARD_KEY, JSON.stringify(writes));
};

const cacheLeaderboardEntries = (entries: readonly LeaderboardEntry[]): void => {
  const merged = mergeLeaderboardEntries(entries, parseCachedLeaderboard());
  safeStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(getLeaderboardSlice(merged, 30)));
};

export type LeaderboardSubmitResult = {
  id: string;
  status: 'online' | 'queued';
};

// Singleton Pattern for Firebase Services
class FirebaseServicesSingleton {
  private static instance: FirebaseServicesSingleton;
  public app: ReturnType<typeof initializeApp>;
  public db: ReturnType<typeof initializeFirestore>;
  public auth: ReturnType<typeof getAuth>;

  private constructor() {
    const existingApps = getApps();
    this.app = existingApps.length ? getApp() : initializeApp(firebaseConfig);

    const firestoreSettings = {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    };

    const databaseId = (firebaseConfig as any).firestoreDatabaseId;
    if (databaseId) {
      this.db = initializeFirestore(this.app, firestoreSettings, databaseId);
    } else {
      this.db = initializeFirestore(this.app, firestoreSettings);
    }

    this.auth = getAuth(this.app);
  }

  public static getInstance(): FirebaseServicesSingleton {
    if (!FirebaseServicesSingleton.instance) {
      FirebaseServicesSingleton.instance = new FirebaseServicesSingleton();
    }
    return FirebaseServicesSingleton.instance;
  }
}

const firebaseServices = FirebaseServicesSingleton.getInstance();

export const app = firebaseServices.app;
export const db = firebaseServices.db;
export const auth = firebaseServices.auth;
export const getFirebaseInstance = () => FirebaseServicesSingleton.getInstance();




export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errCode = (error as { code?: string })?.code || 'unknown_code';
  const errMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  console.error(
    `%c[Firebase:Firestore:ERROR] ❌ Błąd operacji [${operationType.toUpperCase()}] na ścieżce '${path || 'root'}':\n` +
      `  • Kod błędu: ${errCode}\n` +
      `  • Komunikat: ${errMessage}\n` +
      `  • Użytkownik: ${errInfo.authInfo.userId ? `${errInfo.authInfo.userId} (Anonimowy: ${errInfo.authInfo.isAnonymous})` : 'Gość / Niezalogowany'}\n` +
      `  • Dodatkowe detale: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}\n` +
      `  • Czas: ${new Date().toLocaleString('pl-PL')}`,
    'color: #ef4444; font-weight: bold;',
    { details: errInfo, stack, error }
  );

  return errInfo;
}

let currentUser: User | null = null;
let isAuthInitialized = false;
let authPromise: Promise<User | null> | null = null;

// Ensure anonymous sign-in for seamless leaderboard attribution
export function initAuth(): Promise<User | null> {
  if (authPromise) return authPromise;

  authPromise = new Promise((resolve) => {
    if (isAuthInitialized && currentUser) {
      resolve(currentUser);
      return;
    }

    let unsubscribe: Unsubscribe | null = null;
    let settled = false;
    let signInAttempted = false;

    const finish = (user: User | null, retryOnFailure = false) => {
      if (settled) return;
      settled = true;
      currentUser = user;
      isAuthInitialized = true;
      if (user) {
        console.log('[Firebase:Auth] 🟢 Sesja anonimowa gotowa.');
      } else {
        console.warn('[Firebase:Auth] ⚠️ Brak sesji Firebase. Wyniki pozostaną lokalne do czasu ponownej próby logowania.');
      }

      // A transient sign-in failure must not permanently cache a resolved null
      // promise. The next score submission or foreground sync may retry safely.
      if (!user && retryOnFailure) authPromise = null;
      unsubscribe?.();
      resolve(user);
    };

    const subscription = onAuthStateChanged(auth, (user) => {
      if (user) {
        finish(user);
        return;
      }

      if (signInAttempted) return;
      signInAttempted = true;

      signInAnonymously(auth)
        .then((cred) => finish(cred.user))
        .catch((err) => {
          if (err?.code === 'auth/admin-restricted-operation') {
            console.warn('[Firebase:Auth] ⚠️ Logowanie anonimowe jest wyłączone w projekcie Firebase.');
          } else {
            console.warn('[Firebase:Auth] ⚠️ Nie udało się utworzyć sesji Firebase:', err);
          }
          finish(null, true);
        });
    });

    unsubscribe = subscription;
    // Be defensive if an SDK implementation invokes the initial observer
    // synchronously before onAuthStateChanged returns its unsubscribe handle.
    if (settled) unsubscribe();
  });

  return authPromise;
}

export async function ensureLeaderboardServices(): Promise<void> {
  try {
    await initAuth();
    const connected = await testFirestoreConnection();
    if (connected) await syncPendingLeaderboardScores();
  } catch (error) {
    console.warn('[Firebase:Init] ⚠️ Podgrzewanie połączenia pominięte:', error);
  }
}

// Test connection on boot per guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  const targetDoc = 'test/connection';
  if (!currentUser?.uid) {
    console.warn('[Firebase:Firestore] ⚠️ Brak aktywnej sesji; połączenie nie może zostać potwierdzone.');
    return false;
  }
  const startTime = performance.now();

  try {
    const probeDoc = doc(db, 'test', 'connection');
    await getDocFromServer(probeDoc);
    const duration = Math.round(performance.now() - startTime);
    console.log(`[Firebase:Firestore] 🟢 Próba połączenia z bazą zakończona sukcesem (${duration} ms). Target: '${targetDoc}'.`);
    return true;
  } catch (error: unknown) {
    const duration = Math.round(performance.now() - startTime);
    const errCode = (error as { code?: string })?.code || 'unknown_code';
    const errMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn(`[Firebase:Firestore] ⚠️ Klient jest offline (${duration} ms). Brak odpowiedzi od serwera.`);
      return false;
    }
    if (errCode === 'not-found') {
      console.log(`[Firebase:Firestore] 🟢 Odpowiedź serwera Firestore odebrana ('${errCode}', ${duration} ms) -> Połączenie aktywne.`);
      return true;
    }
    console.error(
      `[Firebase:Firestore] ❌ Błąd próby połączenia (${duration} ms):\n` +
      `  • Kod: ${errCode}\n` +
      `  • Komunikat: ${errMessage}\n` +
      `  • Czas: ${new Date().toLocaleString('pl-PL')}`
    );
    return false;
  }
}

/**
 * Persist one finished run. Offline runs enter a durable local outbox and are
 * retried with the same document ID so reconnects cannot create duplicate rows.
 */
export async function submitScore(
  entry: Omit<LeaderboardEntry, 'createdAt' | 'id' | 'syncStatus'>,
): Promise<LeaderboardSubmitResult> {
  const collectionPath = 'leaderboard';
  const cleanId = `mf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const payload: Omit<LeaderboardEntry, 'id' | 'syncStatus'> = {
    mode: (entry.mode === 'survival' ? 'survival' : 'campaign') as LeaderboardGameMode,
    playerName: String(entry.playerName || 'Pracownik Magazynu').trim().slice(0, 32) || 'Pracownik Magazynu',
    hero: String(entry.hero || 'Operator 01').slice(0, 20),
    score: Math.min(10_000_000, Math.max(0, Math.floor(Number.isFinite(entry.score) ? entry.score : 0))),
    coins: Math.min(100_000, Math.max(0, Math.floor(Number.isFinite(entry.coins) ? entry.coins : 0))),
    timeSeconds: Math.max(0, Math.floor(Number.isFinite(entry.timeSeconds) ? entry.timeSeconds : 0)),
    bossDefeated: Boolean(entry.bossDefeated),
    createdAt: new Date().toISOString(),
  };

  console.log(`[Firebase:Leaderboard] 📤 Wynik ${payload.mode} '${payload.playerName}' (${payload.score} pkt) → ${collectionPath}/${cleanId}`);

  const pending = parsePendingLeaderboardWrites();
  const pendingWrite: PendingLeaderboardWrite = { id: cleanId, payload };

  try {
    const user = await initAuth();
    if (!user?.uid) {
      throw new Error('Firebase authentication unavailable; score kept in the local queue.');
    }
    await setDoc(doc(db, collectionPath, cleanId), payload);
    persistPendingLeaderboardWrites(pending.filter((item) => item.id !== cleanId));
    cacheLeaderboardEntries([
      normalizeLeaderboardEntry({ ...payload, id: cleanId, syncStatus: 'online' }),
    ]);
    return { id: cleanId, status: 'online' };
  } catch (error) {
    console.warn('[Firebase:Leaderboard] ⚠️ Brak potwierdzenia zapisu online; wynik trafia do kolejki synchronizacji.');
    handleFirestoreError(error, OperationType.WRITE, `${collectionPath}/${cleanId}`);

    const nextPending = [...pending.filter((item) => item.id !== cleanId), pendingWrite];
    persistPendingLeaderboardWrites(nextPending);
    const wasQueued = parsePendingLeaderboardWrites().some((item) => item.id === cleanId);
    if (!wasQueued) {
      throw new Error('Nie udało się zapisać wyniku online ani utrwalić lokalnej kolejki.');
    }

    cacheLeaderboardEntries([
      normalizeLeaderboardEntry({ ...payload, id: cleanId, syncStatus: 'pending' }),
    ]);
    return { id: cleanId, status: 'queued' };
  }
}

/**
 * Retry offline submissions using their original IDs. If a previous request
 * reached Firestore but its acknowledgement was lost, verify the document
 * instead of attempting to overwrite it (leaderboard documents are immutable).
 */
export async function syncPendingLeaderboardScores(): Promise<number> {
  const pending = parsePendingLeaderboardWrites();
  if (!pending.length) return 0;

  // Do not send writes until the anonymous Firebase session is confirmed.
  const user = await initAuth();
  if (!user?.uid) {
    console.warn('[Firebase:Leaderboard] ⏳ Brak sesji Firebase; kolejka pozostaje lokalna.');
    return 0;
  }

  const remaining: PendingLeaderboardWrite[] = [];
  const acknowledged: LeaderboardEntry[] = [];

  for (const item of pending) {
    const ref = doc(db, 'leaderboard', item.id);
    try {
      await setDoc(ref, item.payload);
      acknowledged.push(normalizeLeaderboardEntry({
        ...item.payload, id: item.id, syncStatus: 'online',
      }));
      continue;
    } catch (error) {
      try {
        const existing = await getDocFromServer(ref);
        const data = existing.exists() ? existing.data() as DocumentData : null;
        const matches = Boolean(data &&
          data.score === item.payload.score &&
          data.mode === item.payload.mode &&
          data.playerName === item.payload.playerName &&
          data.hero === item.payload.hero &&
          data.createdAt === item.payload.createdAt);
        if (matches) {
          acknowledged.push(normalizeLeaderboardEntry({
            ...item.payload, id: item.id, syncStatus: 'online',
          }));
          continue;
        }
      } catch {
        // Still offline or unreadable; retain the item for the next retry.
      }
      remaining.push(item);
      console.warn(`[Firebase:Leaderboard] ⏳ Wynik ${item.id} nadal czeka na synchronizację.`, error);
    }
  }

  persistPendingLeaderboardWrites(remaining);
  if (acknowledged.length) cacheLeaderboardEntries(acknowledged);
  return acknowledged.length;
}

/**
 * Fetch top shift high scores from Firebase with graceful local cache fallback
 */
export async function getTopLeaderboard(maxEntries = 15): Promise<LeaderboardEntry[]> {
  const collectionPath = 'leaderboard';
  console.log(`[Firebase:Leaderboard] 📥 Pobieranie rankingu wszystkich trybów z kolekcji '${collectionPath}'...`);

  try {
    await syncPendingLeaderboardScores();
    // Fetch a wider global window, then merge offline entries and apply one shared
    // cross-mode comparator. Mode labels do not split the default global ranking.
    const q = query(collection(db, collectionPath), orderBy('score', 'desc'), limit(Math.max(100, maxEntries)));
    const snapshot = await getDocs(q);
    const cloudEntries = snapshot.docs.map((d) => {
      const data = d.data() as DocumentData;
      return normalizeLeaderboardEntry({
        id: d.id,
        playerName: data.playerName,
        hero: data.hero,
        mode: data.mode,
        score: data.score,
        coins: data.coins,
        timeSeconds: data.timeSeconds,
        bossDefeated: data.bossDefeated,
        createdAt: data.createdAt,
        syncStatus: 'online',
      }, d.id);
    });
    const pendingEntries = parsePendingLeaderboardWrites().map((item) =>
      normalizeLeaderboardEntry({ ...item.payload, id: item.id, syncStatus: 'pending' })
    );
    const merged = mergeLeaderboardEntries(cloudEntries, pendingEntries);
    cacheLeaderboardEntries(merged);

    console.log(`[Firebase:Leaderboard] ✅ Ranking globalny: ${cloudEntries.length} online + ${pendingEntries.length} oczekujących.`);
    return getLeaderboardSlice(merged, maxEntries);
  } catch (error) {
    console.error('[Firebase:Leaderboard] ⚠️ Brak dostępu do Firestore — używam ostatniego lokalnego rankingu.');
    handleFirestoreError(error, OperationType.LIST, collectionPath);

    const cached = parseCachedLeaderboard();
    const pendingEntries = parsePendingLeaderboardWrites().map((item) =>
      normalizeLeaderboardEntry({ ...item.payload, id: item.id, syncStatus: 'pending' })
    );
    return getLeaderboardSlice(mergeLeaderboardEntries(cached, pendingEntries), maxEntries);
  }
}
