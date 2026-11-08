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
  where,
  limit,
  getDoc,
  getDocFromServer,
  runTransaction,
  DocumentData,
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  type User,
  type UserCredential,
  type Unsubscribe,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { withTimeout } from './asyncTimeout.ts';
import {
  createInitialAccountProgressionProfile,
  mergeAccountProgressionProfiles,
  sanitizeAccountProgressionProfile,
  type AccountProgressionProfile,
} from './accountProgression.ts';
import {
  getLeaderboardSlice,
  getSurvivalLeaderboardSlice,
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

const AUTH_INIT_TIMEOUT_MS = 10_000;
const FIRESTORE_PROBE_TIMEOUT_MS = 7_000;
const FIRESTORE_QUERY_TIMEOUT_MS = 12_000;
const FIRESTORE_WRITE_TIMEOUT_MS = 12_000;
const LEADERBOARD_SYNC_TIMEOUT_MS = 6_000;

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
    let authTimeout: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    let signInAttempted = false;

    const finish = (user: User | null, retryOnFailure = false) => {
      if (settled) return;
      settled = true;
      if (authTimeout !== null) {
        clearTimeout(authTimeout);
        authTimeout = null;
      }
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
    if (settled) {
      unsubscribe();
    } else {
      authTimeout = setTimeout(() => {
        console.warn('[Firebase:Auth] ⏱️ Przekroczono limit czasu inicjalizacji sesji. Wynik pozostanie lokalny; kolejna próba ponowi logowanie.');
        finish(null, true);
      }, AUTH_INIT_TIMEOUT_MS);
    }
  });

  return authPromise;
}


/** Link the current anonymous profile to Google, or sign into an existing
 * Google-linked account on another device. The caller must invoke this from a
 * direct user gesture because Firebase popup auth is browser-mediated. */
export async function connectAccountWithGoogle(): Promise<{ uid: string; isAnonymous: boolean }> {
  const user = await withTimeout(initAuth(), AUTH_INIT_TIMEOUT_MS + 1_000, 'Google account authentication');
  if (!user) throw new Error('Nie ma aktywnej sesji Firebase do połączenia z Google.');

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  let credential: UserCredential;
  if (user.isAnonymous) {
    try {
      credential = await linkWithPopup(user, provider);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') {
        throw error;
      }
      // The Google identity already belongs to an account from another device.
      // Sign into it; the caller merges the local profile with the cloud profile.
      credential = await signInWithPopup(auth, provider);
    }
  } else {
    credential = await signInWithPopup(auth, provider);
  }

  currentUser = credential.user;
  isAuthInitialized = true;
  authPromise = Promise.resolve(credential.user);
  return { uid: credential.user.uid, isAnonymous: credential.user.isAnonymous };
}

export async function ensureLeaderboardServices(): Promise<boolean> {
  // The leaderboard is publicly readable. Do not make a slow anonymous-auth
  // attempt block the public read; authentication continues in the background
  // for future score submissions and offline queue synchronization.
  void initAuth().catch((error) => {
    console.warn('[Firebase:Auth] ⚠️ Inicjalizacja sesji trwa dalej w tle lub wymaga ponowienia:', error);
  });

  try {
    const connected = await testFirestoreConnection();
    if (connected && currentUser?.uid) {
      try {
        await withTimeout(
          syncPendingLeaderboardScores(),
          LEADERBOARD_SYNC_TIMEOUT_MS,
          'Leaderboard queue sync',
        );
      } catch (error) {
        // A slow offline queue must not keep the ranking screen in a spinner.
        console.warn('[Firebase:Leaderboard] ⏱️ Synchronizacja kolejki trwa zbyt długo; pobieranie rankingu będzie kontynuowane.', error);
      }
    }
    return connected;
  } catch (error) {
    console.warn('[Firebase:Init] ⚠️ Podgrzewanie połączenia pominięte:', error);
    return false;
  }
}

// Test connection on boot per guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  const targetDoc = 'leaderboard (public read probe)';
  const startTime = performance.now();

  try {
    // Probe the same public collection used by the ranking instead of a
    // separate authenticated test document. An empty collection is still a
    // successful connection and does not require anonymous sign-in.
    const probeQuery = query(collection(db, 'leaderboard'), limit(1));
    await withTimeout(
      getDocs(probeQuery),
      FIRESTORE_PROBE_TIMEOUT_MS,
      'Public Firestore leaderboard probe',
    );
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


const ACCOUNT_PROGRESSION_DOCUMENT_ID = 'accountProgression';

function getAccountProgressionDocument(userId: string) {
  return doc(db, 'users', userId, 'gameData', ACCOUNT_PROGRESSION_DOCUMENT_ID);
}

/** Load the signed-in player's account progress. Anonymous auth keeps this
 * device stable; a linked Firebase provider can make the same UID portable. */
export async function loadAccountProgressionProfileFromCloud(): Promise<AccountProgressionProfile | null> {
  const user = await withTimeout(initAuth(), AUTH_INIT_TIMEOUT_MS + 1_000, 'Account progression authentication');
  if (!user?.uid) throw new Error('Nie udało się uwierzytelnić zapisu postępów konta.');
  const snapshot = await withTimeout(
    getDoc(getAccountProgressionDocument(user.uid)),
    FIRESTORE_QUERY_TIMEOUT_MS,
    'Account progression cloud load',
  );
  if (!snapshot.exists()) return null;
  const payload = snapshot.data() as DocumentData;
  if (!payload.profile || typeof payload.profile !== 'object') return null;
  return sanitizeAccountProgressionProfile(payload.profile);
}

/** Transactionally keep the strongest locally/cloud-saved profile. Writes are
 * restricted by Firestore rules to the current user's own account document. */
export async function saveAccountProgressionProfileToCloud(
  profileValue: unknown,
): Promise<AccountProgressionProfile> {
  const user = await withTimeout(initAuth(), AUTH_INIT_TIMEOUT_MS + 1_000, 'Account progression authentication');
  if (!user?.uid) throw new Error('Nie udało się uwierzytelnić zapisu postępów konta.');
  const localProfile = sanitizeAccountProgressionProfile(profileValue);
  const reference = getAccountProgressionDocument(user.uid);
  return withTimeout(
    runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const cloudProfile = snapshot.exists()
        ? sanitizeAccountProgressionProfile((snapshot.data() as DocumentData).profile)
        : createInitialAccountProgressionProfile();
      const merged = mergeAccountProgressionProfiles(localProfile, cloudProfile);
      transaction.set(reference, {
        schemaVersion: 1,
        profile: merged,
        updatedAt: Date.now(),
      });
      return merged;
    }),
    FIRESTORE_WRITE_TIMEOUT_MS,
    'Account progression cloud save',
  );
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
    await withTimeout(
      setDoc(doc(db, collectionPath, cleanId), payload),
      FIRESTORE_WRITE_TIMEOUT_MS,
      'Leaderboard score write',
    );
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
      await withTimeout(
        setDoc(ref, item.payload),
        FIRESTORE_WRITE_TIMEOUT_MS,
        'Queued leaderboard score write',
      );
      acknowledged.push(normalizeLeaderboardEntry({
        ...item.payload, id: item.id, syncStatus: 'online',
      }));
      continue;
    } catch (error) {
      try {
        const existing = await withTimeout(
          getDocFromServer(ref),
          FIRESTORE_PROBE_TIMEOUT_MS,
          'Queued leaderboard acknowledgement check',
        );
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
    if (currentUser?.uid) {
      try {
        await withTimeout(
          syncPendingLeaderboardScores(),
          LEADERBOARD_SYNC_TIMEOUT_MS,
          'Global leaderboard queue sync',
        );
      } catch (error) {
        console.warn('[Firebase:Leaderboard] ⏱️ Pomijam wolną synchronizację kolejki i pobieram ranking.', error);
      }
    }
    // Fetch a wider global window, then merge offline entries and apply one shared
    // cross-mode comparator. Mode labels do not split the default global ranking.
    const q = query(collection(db, collectionPath), orderBy('score', 'desc'), limit(Math.max(100, maxEntries)));
    const snapshot = await withTimeout(
      getDocs(q),
      FIRESTORE_QUERY_TIMEOUT_MS,
      'Global leaderboard query',
    );
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

/**
 * Fetch only Survival records from Firestore. Filtering on the server before
 * applying a limit prevents older high Campaign scores from crowding the
 * Survival board out of the first page. No compound index is required.
 */
export async function getTopSurvivalLeaderboard(maxEntries = 15): Promise<LeaderboardEntry[]> {
  const collectionPath = 'leaderboard';
  const safeMaxEntries = Number.isFinite(maxEntries) ? Math.max(0, Math.floor(maxEntries)) : 15;

  try {
    // Public leaderboard reads do not require an authenticated session. Avoid
    // starting a second anonymous-auth timeout after the boot probe has failed;
    // the cached/pending queue is merged below while the public read proceeds.
    if (currentUser?.uid) {
      try {
        await withTimeout(
          syncPendingLeaderboardScores(),
          LEADERBOARD_SYNC_TIMEOUT_MS,
          'Survival leaderboard queue sync',
        );
      } catch (error) {
        console.warn('[Firebase:Leaderboard] ⏱️ Pomijam wolną synchronizację kolejki; pobieram ranking Survival.', error);
      }
    }
    // This equality-only query uses Firestore's automatic single-field index.
    // Fetch all Survival rows before sorting locally; a fixed page could hide a
    // high score when the collection grows, while orderBy would need a composite
    // index to be deployed separately.
    const survivalQuery = query(
      collection(db, collectionPath),
      where('mode', '==', 'survival'),
    );
    const snapshot = await withTimeout(
      getDocs(survivalQuery),
      FIRESTORE_QUERY_TIMEOUT_MS,
      'Survival leaderboard query',
    );
    const cloudEntries = snapshot.docs.map((document) => {
      const data = document.data() as DocumentData;
      return normalizeLeaderboardEntry({
        id: document.id,
        playerName: data.playerName,
        hero: data.hero,
        mode: data.mode,
        score: data.score,
        coins: data.coins,
        timeSeconds: data.timeSeconds,
        bossDefeated: data.bossDefeated,
        createdAt: data.createdAt,
        syncStatus: 'online',
      }, document.id);
    }).filter((entry) => entry.mode === 'survival');

    const pendingEntries = parsePendingLeaderboardWrites()
      .map((item) => normalizeLeaderboardEntry({ ...item.payload, id: item.id, syncStatus: 'pending' }))
      .filter((entry) => entry.mode === 'survival');
    const merged = mergeLeaderboardEntries(cloudEntries, pendingEntries);
    const survivalEntries = getSurvivalLeaderboardSlice(merged, Math.max(30, safeMaxEntries));

    // This key is the offline fallback for the single public Survival mode.
    // Store its own slice instead of allowing legacy Campaign rows to crowd it.
    safeStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(getLeaderboardSlice(survivalEntries, 30)));
    console.log(`[Firebase:Leaderboard] ✅ Survival: ${cloudEntries.length} online + ${pendingEntries.length} oczekujących.`);
    return getSurvivalLeaderboardSlice(survivalEntries, safeMaxEntries);
  } catch (error) {
    console.error('[Firebase:Leaderboard] ⚠️ Nie udało się pobrać Survival — używam lokalnego cache.');
    handleFirestoreError(error, OperationType.LIST, collectionPath);

    const cachedEntries = parseCachedLeaderboard().filter((entry) => entry.mode === 'survival');
    const pendingEntries = parsePendingLeaderboardWrites()
      .map((item) => normalizeLeaderboardEntry({ ...item.payload, id: item.id, syncStatus: 'pending' }))
      .filter((entry) => entry.mode === 'survival');
    return getSurvivalLeaderboardSlice(mergeLeaderboardEntries(cachedEntries, pendingEntries), safeMaxEntries);
  }
}

