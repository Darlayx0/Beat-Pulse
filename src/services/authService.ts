import { UserProfile, SavedAccount } from '../types.ts';
import { auth, isFirebaseAvailable, GoogleAuthProvider, signInWithPopup, signOut } from './firebaseConfig.ts';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

const ACTIVE_ACCOUNT_KEY = 'BEATPULSE_GOOGLE_USER_V1';
const SAVED_ACCOUNTS_KEY = 'BEATPULSE_SAVED_ACCOUNTS_V1';
const AUTO_LOGIN_KEY = 'BEATPULSE_AUTO_LOGIN_ENABLED';

export const ALL_GAMER_TITLES = [
  { levelReq: 1, title: 'Novice Beatmaster', category: 'Pemula', desc: 'Memulai perjalanan ritme musik.' },
  { levelReq: 3, title: 'Rhythm Apprentice', category: 'Pemula', desc: 'Menguasai sinkronisasi ketukan dasar.' },
  { levelReq: 5, title: 'Tempo Tracker', category: 'Menengah', desc: 'Konsistensi tempo yang stabil.' },
  { levelReq: 8, title: 'Groove Seeker', category: 'Menengah', desc: 'Merasakan alunan melodi dan ritme.' },
  { levelReq: 10, title: 'Beat Synchronizer', category: 'Lanjutan', desc: 'Akurasi hit timing kelas atas.' },
  { levelReq: 15, title: 'Pulse Commander', category: 'Lanjutan', desc: 'Menguasai chart tingkat kesulitan tinggi.' },
  { levelReq: 20, title: 'Sonic Virtuoso', category: 'Master', desc: 'Ketepatan milidetik tanpa meleset.' },
  { levelReq: 25, title: 'Cyber Maestro', category: 'Master', desc: 'Kecepatan dan refleks level turnamen.' },
  { levelReq: 30, title: 'Valkyrie Legend', category: 'Legenda', desc: 'Pemain legendaris dengan rekor prestisius.' },
  { levelReq: 40, title: 'Grand Rhythm God', category: 'Mitologi', desc: 'Irama dan jiwa menyatu tanpa batas.' },
];

export async function getAuthToken(): Promise<string | null> {
  if (!isFirebaseAvailable || !auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch (err) {
    console.warn('Failed to retrieve Firebase ID token:', err);
    return null;
  }
}

export function generateGoogleAvatarSvg(name: string, email: string): string {
  const initial = (name || email || 'G').trim().charAt(0).toUpperCase();
  const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#673AB7', '#009688'];
  const charCode = (name || email || 'G').charCodeAt(0);
  const bgColor = colors[charCode % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="20" fill="${bgColor}"/>
    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
    <text x="50" y="65" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createLoggedOutProfile(): UserProfile {
  const now = Date.now();
  return {
    uid: 'guest_unauthenticated',
    username: 'Tamu BeatPulse',
    email: '',
    avatarUrl: generateGoogleAvatarSvg('G', 'guest'),
    avatarType: 'google',
    bio: 'Belum masuk dengan Akun Google.',
    title: 'Novice Beatmaster',
    level: 1,
    exp: 0,
    totalScore: 0,
    songsCompleted: 0,
    createdAt: now,
    updatedAt: now,
    authProvider: 'guest',
    isGoogleLinked: false,
    unlockedTitles: ['Novice Beatmaster'],
  };
}

class AuthServiceEngine {
  private currentProfile: UserProfile;
  private listeners = new Set<(profile: UserProfile) => void>();

  constructor() {
    this.currentProfile = this.loadActiveProfile();
    this.initFirebaseAuthListener();
  }

  private initFirebaseAuthListener() {
    if (isFirebaseAvailable && auth) {
      try {
        onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
          if (fbUser) {
            await this.syncWithCloudSQL(fbUser);
          }
        });
      } catch (err) {
        console.warn('[AuthService] onAuthStateChanged error:', err);
      }
    }
  }

  private async syncWithCloudSQL(fbUser: FirebaseUser): Promise<UserProfile | null> {
    try {
      const token = await fbUser.getIdToken();
      const response = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const dbUser = data.user;
        const now = Date.now();
        const fallbackAvatar = generateGoogleAvatarSvg(dbUser.username || fbUser.displayName || 'Player', dbUser.email || fbUser.email || '');

        const syncedProfile: UserProfile = {
          uid: dbUser.uid,
          username: dbUser.username || fbUser.displayName || 'BeatPulse Player',
          email: dbUser.email || fbUser.email || '',
          avatarUrl: dbUser.avatarUrl || fbUser.photoURL || fallbackAvatar,
          avatarType: 'google',
          presetAvatarId: dbUser.presetAvatarId || undefined,
          bio: dbUser.bio || '',
          title: dbUser.title || 'Novice Beatmaster',
          level: dbUser.level || 1,
          exp: dbUser.exp || 0,
          totalScore: Number(dbUser.totalScore) || 0,
          songsCompleted: dbUser.songsCompleted || 0,
          maxComboAllTime: dbUser.maxComboAllTime || 0,
          bestAccuracy: dbUser.bestAccuracy || 0,
          unlockedTitles: Array.isArray(dbUser.unlockedTitles) ? dbUser.unlockedTitles : ['Novice Beatmaster'],
          createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : now,
          updatedAt: dbUser.updatedAt ? new Date(dbUser.updatedAt).getTime() : now,
          isGoogleLinked: true,
          authProvider: 'google',
          googleId: dbUser.uid,
          googleDisplayName: fbUser.displayName || undefined,
          googleEmail: fbUser.email || undefined,
          googlePhotoUrl: fbUser.photoURL || undefined,
        };

        this.currentProfile = syncedProfile;
        this.persistActiveProfile(syncedProfile);
        this.notify();
        return syncedProfile;
      }
    } catch (err) {
      console.warn('[AuthService] Failed to sync user with Cloud SQL backend:', err);
    }
    return null;
  }

  /**
   * Check if Auto-Login feature is enabled
   */
  public isAutoLoginEnabled(): boolean {
    try {
      const val = localStorage.getItem(AUTO_LOGIN_KEY);
      return val !== 'false'; // Enabled by default
    } catch {
      return true;
    }
  }

  /**
   * Toggle Auto-Login preference
   */
  public setAutoLoginEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(AUTO_LOGIN_KEY, String(enabled));
    } catch (e) {
      console.warn('Failed to save auto-login preference:', e);
    }
  }

  /**
   * Get all saved account login histories
   */
  public getSavedAccounts(): SavedAccount[] {
    try {
      const stored = localStorage.getItem(SAVED_ACCOUNTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved accounts history:', e);
    }
    return [];
  }

  /**
   * Save an account into the login history
   */
  public saveAccountToHistory(profile: UserProfile): void {
    if (!profile || !profile.isGoogleLinked || profile.uid === 'guest_unauthenticated') {
      return;
    }
    try {
      const existingHistory = this.getSavedAccounts();
      const filtered = existingHistory.filter((acc) => acc.uid !== profile.uid);

      const newAccountEntry: SavedAccount = {
        uid: profile.uid,
        username: profile.username || profile.googleDisplayName || 'Pemain BeatPulse',
        email: profile.email || profile.googleEmail || '',
        avatarUrl: profile.avatarUrl || profile.googlePhotoUrl || generateGoogleAvatarSvg(profile.username, profile.email),
        avatarType: profile.avatarType || 'google',
        presetAvatarId: profile.presetAvatarId,
        lastActive: Date.now(),
        isGuest: false,
        authProvider: profile.authProvider || 'google',
        isGoogleLinked: true,
        level: profile.level || 1,
      };

      const updatedHistory = [newAccountEntry, ...filtered].slice(0, 10);
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updatedHistory));
    } catch (e) {
      console.warn('Failed to save account to history:', e);
    }
  }

  /**
   * Remove a specific account from login history
   */
  public removeAccountFromHistory(uid: string): SavedAccount[] {
    try {
      const existingHistory = this.getSavedAccounts();
      const updated = existingHistory.filter((acc) => acc.uid !== uid);
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn('Failed to remove account from history:', e);
      return this.getSavedAccounts();
    }
  }

  /**
   * Clear all login histories
   */
  public clearLoginHistory(): void {
    try {
      localStorage.removeItem(SAVED_ACCOUNTS_KEY);
    } catch (e) {
      console.warn('Failed to clear login history:', e);
    }
  }

  /**
   * Switch to a saved account from history
   */
  public async switchAccountFromHistory(account: SavedAccount): Promise<UserProfile> {
    const defaultProf = createLoggedOutProfile();
    const restoredProfile: UserProfile = {
      ...defaultProf,
      uid: account.uid,
      username: account.username,
      email: account.email,
      avatarUrl: account.avatarUrl,
      avatarType: account.avatarType || 'google',
      presetAvatarId: account.presetAvatarId,
      level: account.level || 1,
      authProvider: 'google',
      isGoogleLinked: true,
      googleId: account.uid,
      googleDisplayName: account.username,
      googleEmail: account.email,
    };

    this.currentProfile = restoredProfile;
    this.persistActiveProfile(restoredProfile);
    this.notify();

    // If Firebase Auth has active user matching this uid, trigger sync
    if (isFirebaseAvailable && auth?.currentUser && auth.currentUser.uid === account.uid) {
      await this.syncWithCloudSQL(auth.currentUser);
    }

    return restoredProfile;
  }

  private loadActiveProfile(): UserProfile {
    const defaultProf = createLoggedOutProfile();
    try {
      const autoLogin = this.isAutoLoginEnabled();

      // 1. First check if there's an active profile stored in localStorage
      const stored = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && parsed.isGoogleLinked && parsed.uid && parsed.uid !== 'guest_unauthenticated') {
          // If auto login is disabled, return guest unless auto-login is on
          if (autoLogin) {
            const sanitized: UserProfile = {
              ...defaultProf,
              ...parsed,
              unlockedTitles: Array.isArray(parsed.unlockedTitles) && parsed.unlockedTitles.length > 0
                ? parsed.unlockedTitles
                : ['Novice Beatmaster'],
            };
            this.saveAccountToHistory(sanitized);
            return sanitized;
          }
        }
      }

      // 2. Fallback: If auto login is enabled, check most recent saved account from history
      if (autoLogin) {
        const savedHistory = this.getSavedAccounts();
        if (savedHistory.length > 0) {
          const mostRecent = savedHistory[0];
          const autoRestoredProfile: UserProfile = {
            ...defaultProf,
            uid: mostRecent.uid,
            username: mostRecent.username,
            email: mostRecent.email,
            avatarUrl: mostRecent.avatarUrl,
            avatarType: mostRecent.avatarType || 'google',
            presetAvatarId: mostRecent.presetAvatarId,
            level: mostRecent.level || 1,
            authProvider: 'google',
            isGoogleLinked: true,
            googleId: mostRecent.uid,
            googleDisplayName: mostRecent.username,
            googleEmail: mostRecent.email,
          };
          this.persistActiveProfile(autoRestoredProfile);
          return autoRestoredProfile;
        }
      }
    } catch (e) {
      console.warn('Failed to load active profile from localStorage:', e);
    }
    this.persistActiveProfile(defaultProf);
    return defaultProf;
  }

  private persistActiveProfile(profile: UserProfile) {
    try {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(profile));
      if (profile.isGoogleLinked && profile.uid !== 'guest_unauthenticated') {
        this.saveAccountToHistory(profile);
      }
    } catch (e) {
      console.warn('Failed to save active profile:', e);
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentProfile));
  }

  public subscribe(callback: (profile: UserProfile) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentProfile);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getCurrentProfile(): UserProfile {
    return { ...this.currentProfile };
  }

  /**
   * Update Profile details with Cloud SQL synchronization
   */
  public async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const updated: UserProfile = {
      ...this.currentProfile,
      ...updates,
      updatedAt: Date.now(),
    };

    // Calculate unlocked titles according to level
    const availableTitles = ALL_GAMER_TITLES.filter((t) => t.levelReq <= updated.level).map(
      (t) => t.title
    );
    updated.unlockedTitles = Array.from(new Set([...(updated.unlockedTitles || []), ...availableTitles]));

    this.currentProfile = updated;
    this.persistActiveProfile(updated);
    this.notify();

    // Persist to Cloud SQL if user is authenticated
    const token = await getAuthToken();
    if (token && updated.isGoogleLinked) {
      try {
        await fetch('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            username: updated.username,
            bio: updated.bio,
            title: updated.title,
            avatarUrl: updated.avatarUrl,
            avatarType: updated.avatarType,
            presetAvatarId: updated.presetAvatarId,
            unlockedTitles: updated.unlockedTitles,
          }),
        });
      } catch (err) {
        console.warn('Failed to sync updated profile to Cloud SQL:', err);
      }
    }

    return updated;
  }

  /**
   * Sign in with Google Account using Firebase Auth popup
   */
  public async signInWithGoogle(customEmail?: string, customName?: string): Promise<UserProfile> {
    if (!isFirebaseAvailable || !auth) {
      throw new Error('Firebase Authentication is not available in this environment.');
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const synced = await this.syncWithCloudSQL(user);
    if (synced) {
      this.saveAccountToHistory(synced);
      return synced;
    }

    // Fallback profile if network sync was temporarily delayed
    const now = Date.now();
    const fallbackAvatar = generateGoogleAvatarSvg(user.displayName || 'Player', user.email || '');
    const newProfile: UserProfile = {
      uid: user.uid,
      username: user.displayName || user.email?.split('@')[0] || 'Player',
      email: user.email || '',
      avatarUrl: user.photoURL || fallbackAvatar,
      avatarType: 'google',
      bio: 'Pemain ritme terverifikasi Google Account.',
      title: 'Novice Beatmaster',
      level: 1,
      exp: 0,
      totalScore: 0,
      songsCompleted: 0,
      createdAt: now,
      updatedAt: now,
      authProvider: 'google',
      isGoogleLinked: true,
      googleId: user.uid,
      googleDisplayName: user.displayName || undefined,
      googleEmail: user.email || undefined,
      googlePhotoUrl: user.photoURL || undefined,
      unlockedTitles: ['Novice Beatmaster'],
    };

    this.currentProfile = newProfile;
    this.persistActiveProfile(newProfile);
    this.notify();
    return newProfile;
  }

  /**
   * Logout from Google Account
   */
  public async logout(): Promise<UserProfile> {
    if (isFirebaseAvailable && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Firebase signout:', e);
      }
    }

    const guestProfile = createLoggedOutProfile();
    this.currentProfile = guestProfile;
    this.persistActiveProfile(guestProfile);
    this.notify();
    return guestProfile;
  }

  /**
   * Add Exp and Score after completing a game, syncing with Cloud SQL
   */
  public async addGameResults(score: number, maxCombo: number, accuracy: number) {
    const expGained = Math.max(10, Math.round((score / 1000) * (accuracy / 100)));
    const newExp = this.currentProfile.exp + expGained;
    const expPerLevel = 1000;
    const newLevel = Math.max(1, Math.floor(newExp / expPerLevel) + 1);

    const availableTitles = ALL_GAMER_TITLES.filter((t) => t.levelReq <= newLevel).map((t) => t.title);
    const currentTitle = this.currentProfile.title || availableTitles[availableTitles.length - 1] || 'Novice Beatmaster';

    const currentBestAcc = Math.max(this.currentProfile.bestAccuracy || 0, accuracy);
    const currentMaxCombo = Math.max(this.currentProfile.maxComboAllTime || 0, maxCombo);

    await this.updateProfile({
      exp: newExp,
      level: newLevel,
      title: currentTitle,
      totalScore: this.currentProfile.totalScore + score,
      songsCompleted: this.currentProfile.songsCompleted + 1,
      bestAccuracy: Number(currentBestAcc.toFixed(1)),
      maxComboAllTime: currentMaxCombo,
    });
  }

  public generateGoogleAvatarSvg(name: string, email: string): string {
    return generateGoogleAvatarSvg(name, email);
  }
}

export const authService = new AuthServiceEngine();
