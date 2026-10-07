import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sliders,
  Volume2,
  VolumeX,
  Key,
  Zap,
  Check,
  Smartphone,
  Vibrate,
  Database,
  Download,
  Upload,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Play,
  CheckCircle2,
  HelpCircle,
  Layers,
  Gauge,
  Music,
  Eye,
  Info,
  User,
  LogOut,
  Users,
  PlusCircle,
  Camera,
  Clock,
  Trash2,
  UserCheck,
  Power,
  RefreshCw,
} from 'lucide-react';
import { GameSettings, UserProfile, SavedAccount } from '../types';
import { saveSettingsToDB, StorageStatus, DEFAULT_SETTINGS } from '../lib/indexedDb';
import { audioEngine } from '../lib/audioEngine';
import { authService } from '../services/authService';
import { useNativeDialog } from '../hooks/useNativeDialog';

// Official Google 'G' Vector Icon
const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

export type SettingsTab = 'profile' | 'controls' | 'audio' | 'gameplay' | 'storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  storageStatus?: StorageStatus | null;
  initialTab?: SettingsTab;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onRequestPersistence?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: (file: File) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  storageStatus,
  initialTab = 'profile',
  onUpdateSettings,
  onRequestPersistence,
  onExportBackup,
  onImportBackup,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [localSettings, setLocalSettings] = useState<GameSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...(settings && typeof settings === 'object' && 'scrollSpeed' in settings ? settings : {}),
  }));
  const [editingLane, setEditingLane] = useState<number | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Profile States (Google Account)
  const [profile, setProfile] = useState<UserProfile>(authService.getCurrentProfile());
  const [username, setUsername] = useState<string>(profile.username);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);
  const [showCustomGooglePrompt, setShowCustomGooglePrompt] = useState<boolean>(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState<string>('agungdarlayx@gmail.com');
  const [customGoogleName, setCustomGoogleName] = useState<string>('Agung Darlay');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Saved accounts history & Auto-login settings
  const [autoLoginEnabled, setAutoLoginEnabled] = useState<boolean>(authService.isAutoLoginEnabled());
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(authService.getSavedAccounts());

  const handleToggleAutoLogin = (enabled: boolean) => {
    authService.setAutoLoginEnabled(enabled);
    setAutoLoginEnabled(enabled);
    showToast(enabled ? 'Login otomatis diaktifkan.' : 'Login otomatis dinonaktifkan.');
  };

  const handleRemoveSavedAccount = (uid: string) => {
    const updated = authService.removeAccountFromHistory(uid);
    setSavedAccounts(updated);
    showToast('Akun dihapus dari riwayat login.');
  };

  const handleClearAllHistory = () => {
    authService.clearLoginHistory();
    setSavedAccounts([]);
    showToast('Seluruh riwayat login berhasil dibersihkan.');
  };

  const handleSwitchAccount = async (account: SavedAccount) => {
    await authService.switchAccountFromHistory(account);
    setSavedAccounts(authService.getSavedAccounts());
    showToast(`Beralih ke akun ${account.username} (${account.email})`);
  };

  const formatLastActive = (timestamp: number): string => {
    if (!timestamp) return 'Baru saja';
    const diffMinutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
    if (diffMinutes < 1) return 'Baru saja';
    if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} hari lalu`;
    return new Date(timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  // Sync settings when opened or prop changes
  useEffect(() => {
    if (settings && typeof settings === 'object' && 'scrollSpeed' in settings) {
      setLocalSettings({ ...DEFAULT_SETTINGS, ...settings });
    }
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Subscribe to auth service updates
  useEffect(() => {
    const unsubscribe = authService.subscribe((newProfile) => {
      setProfile(newProfile);
      setUsername(newProfile.username);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Temporary toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  // Keyboard remap listener
  const handleKeyRemap = (e: React.KeyboardEvent) => {
    if (editingLane === null) return;
    e.preventDefault();

    const laneKey = `lane${editingLane}` as keyof typeof localSettings.keyBindings;
    const newBindings = { ...localSettings.keyBindings, [laneKey]: e.code };

    const updated = { ...localSettings, keyBindings: newBindings };
    setLocalSettings(updated);
    setEditingLane(null);
    audioEngine.playHitsound('perfect');
    showToast(`Tombol Lane ${editingLane + 1} diatur ke "${getKeyLabel(e.code)}"`);
  };

  // Interactive Metronome Calibration State & Loop
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibBeatCount, setCalibBeatCount] = useState<number>(0);
  const [tapOffsets, setTapOffsets] = useState<number[]>([]);
  const [lastTapResult, setLastTapResult] = useState<{ offset: number; text: string; color: string } | null>(null);

  useEffect(() => {
    let timer: any = null;
    if (isCalibrating && isOpen && activeTab === 'audio') {
      const beatIntervalMs = 500; // 120 BPM metronome
      timer = setInterval(() => {
        setCalibBeatCount((c) => c + 1);
        audioEngine.playMetronomeTick(calibBeatCount % 4 === 0);
      }, beatIntervalMs);
    } else {
      setCalibBeatCount(0);
      if (isCalibrating && activeTab !== 'audio') {
        setIsCalibrating(false);
      }
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCalibrating, calibBeatCount, isOpen, activeTab]);

  const dialogRef = useNativeDialog(isOpen);
  if (!isOpen) return null;

  // Enhanced calibration tap handler
  const handleCalibrationTap = () => {
    if (!isCalibrating) {
      setIsCalibrating(true);
      setTapOffsets([]);
      setLastTapResult(null);
      audioEngine.playMetronomeTick(true);
      return;
    }

    const now = performance.now();
    const beatPhase = now % 500;
    let offsetMs = beatPhase > 250 ? beatPhase - 500 : beatPhase;
    offsetMs = Math.round(offsetMs);

    let resultText = 'PRESISI!';
    let resultColor = 'text-emerald-700 bg-emerald-50 border-emerald-300';

    if (offsetMs > 12) {
      resultText = `TERLAMBAT +${offsetMs}ms`;
      resultColor = 'text-amber-700 bg-amber-50 border-amber-300';
    } else if (offsetMs < -12) {
      resultText = `MENDAHULUI ${offsetMs}ms`;
      resultColor = 'text-cyan-700 bg-cyan-50 border-cyan-300';
    }

    setLastTapResult({ offset: offsetMs, text: resultText, color: resultColor });
    audioEngine.playHitsound('perfect');

    const updatedOffsets = [...tapOffsets, offsetMs];
    setTapOffsets(updatedOffsets);

    if (updatedOffsets.length >= 8) {
      const avgOffset = Math.round(updatedOffsets.reduce((a, b) => a + b, 0) / updatedOffsets.length);
      const clampedOffset = Math.max(-150, Math.min(150, avgOffset));

      setLocalSettings((prev) => ({
        ...prev,
        audioOffsetMs: clampedOffset,
      }));
      setIsCalibrating(false);
      showToast(`Kalibrasi selesai! Offset disetel ke ${clampedOffset}ms`);
    }
  };

  // Save Profile Handler
  const handleSaveProfile = async () => {
    if (!username.trim()) {
      showToast('Nama pengguna tidak boleh kosong.');
      return;
    }
    try {
      setIsSavingProfile(true);
      await authService.updateProfile({
        username: username.trim(),
      });
      showToast('Profil pemain berhasil disimpan.');
    } catch (err: any) {
      showToast('Gagal menyimpan profil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Google Sign In
  const handleGoogleSignIn = async (emailOverride?: string, nameOverride?: string) => {
    try {
      setIsGoogleSigningIn(true);
      const targetEmail = emailOverride || customGoogleEmail;
      const targetName = nameOverride || customGoogleName;
      const newProf = await authService.signInWithGoogle(targetEmail, targetName);
      setSavedAccounts(authService.getSavedAccounts());
      showToast(`Berhasil masuk dengan Google (${newProf.email})!`);
      setShowCustomGooglePrompt(false);
    } catch (err: any) {
      showToast('Gagal menghubungkan akun Google.');
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  // Google Logout
  const handleLogout = async () => {
    try {
      await authService.logout();
      setSavedAccounts(authService.getSavedAccounts());
      showToast('Berhasil keluar dari akun Google.');
    } catch (err: any) {
      showToast('Gagal keluar dari akun.');
    }
  };

  const handleSave = async () => {
    if (activeTab === 'profile' && profile.isGoogleLinked) {
      await handleSaveProfile();
    }
    audioEngine.setVolumes(localSettings.bgmVolume, localSettings.sfxVolume);
    await saveSettingsToDB(localSettings);
    onUpdateSettings(localSettings);
    onClose();
  };

  const handleResetToDefaults = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    setResetConfirmOpen(false);
    audioEngine.setVolumes(DEFAULT_SETTINGS.bgmVolume, DEFAULT_SETTINGS.sfxVolume);
    showToast('Pengaturan telah dikembalikan ke standar awal.');
  };

  const getKeyLabel = (code: string) => {
    return code.replace('Key', '').replace('Digit', '');
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && onImportBackup) {
      onImportBackup(selected);
      e.target.value = '';
      onClose();
    }
  };

  const testHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
      showToast('Getaran haptic berhasil diuji!');
    } else {
      showToast('Haptic feedback tidak didukung pada browser/perangkat ini.');
    }
  };

  const tabs = [
    {
      id: 'profile' as const,
      label: 'Akun Google',
      icon: User,
      count: profile.isGoogleLinked ? 'Terhubung' : 'Tamu',
    },
    { id: 'controls' as const, label: 'Kontrol & Input', icon: Smartphone, count: null },
    { id: 'audio' as const, label: 'Audio & Latensi', icon: Music, count: `${localSettings?.audioOffsetMs ?? 0}ms` },
    { id: 'gameplay' as const, label: 'Gameplay & Visual', icon: Gauge, count: `${(localSettings?.scrollSpeed ?? 2.2).toFixed(1)}x` },
    {
      id: 'storage' as const,
      label: 'Penyimpanan & Data',
      icon: Database,
      count: storageStatus?.isPersisted ? 'Aman' : null,
    },
  ];

  return (
    <dialog
      ref={dialogRef}
      aria-label="Pengaturan dan akun"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      tabIndex={0}
      onKeyDown={editingLane !== null ? handleKeyRemap : undefined}
      className="bp-legacy-dialog fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 outline-none overflow-y-auto"
    >
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] my-auto text-slate-900">
        {/* Header with Title and Close button */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Pengaturan Sistem & Preferensi
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Sesuaikan kontrol, kalibrasi suara, tampilan visual, dan cadangkan data
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-2xl hover:bg-slate-200/60 transition-colors"
            title="Tutup Pengaturan (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Temporary In-Modal Notification Banner */}
        {toastMessage && (
          <div className="bg-indigo-600 text-white text-xs font-semibold px-6 py-2 flex items-center justify-between animate-in slide-in-from-top-2 duration-150 shadow-inner">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-200" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-indigo-200 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Body with Sidebar Navigation and Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 bg-white">
          {/* Navigation Bar (Desktop Left Sidebar / Mobile Top Segmented Tabs) */}
          <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50 p-2 sm:p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto shrink-0 scrollbar-none">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id);
                    if (isCalibrating && t.id !== 'audio') setIsCalibrating(false);
                  }}
                  className={`flex items-center justify-between gap-2.5 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all whitespace-nowrap md:whitespace-normal text-left min-h-[44px] ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{t.label}</span>
                  </div>

                  {t.count && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold hidden sm:inline-block ${
                        isActive ? 'bg-indigo-500/80 text-white' : 'bg-slate-200/70 text-slate-700'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Quick Reset Defaults in Sidebar (Desktop) */}
            <div className="hidden md:block mt-auto pt-4 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(true)}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors text-left"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Reset ke Bawaan</span>
              </button>
            </div>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
            {/* =========================================================================
                0. PROFIL & AKUN (SEPENUHNYA MENGANDALKAN AKUN GOOGLE)
            ========================================================================= */}
            {activeTab === 'profile' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {profile.isGoogleLinked ? (
                  /* Logged In with Google */
                  <div className="space-y-4">
                    {/* Google Profile Hero Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200 space-y-4">
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        {/* Profile Picture */}
                        <div className="relative shrink-0">
                          <img
                            src={profile.avatarUrl}
                            alt={profile.username}
                            className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover bg-slate-900 border-2 border-indigo-500/40 shadow-sm"
                          />
                          <div
                            className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-white shadow-md border border-slate-200"
                            title="Akun Google Terhubung"
                          >
                            <GoogleIcon className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Identity & Stats */}
                        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <h3 className="text-base font-black text-slate-900 truncate">
                              {profile.googleDisplayName || profile.username}
                            </h3>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              <Check className="w-3 h-3 text-emerald-600" /> Terverifikasi Google
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 font-mono">
                            {profile.googleEmail || profile.email}
                          </p>

                          <div className="flex items-center justify-center sm:justify-start gap-3 pt-1 text-[11px] text-slate-600">
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold">
                              Level {profile.level}
                            </span>
                            <span className="font-medium text-slate-500">
                              {profile.songsCompleted} Lagu Selesai
                            </span>
                            <span className="font-medium text-slate-500">
                              {profile.totalScore.toLocaleString()} Poin
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Display Name Edit Input */}
                      <div className="pt-3 border-t border-slate-200/80 space-y-2">
                        <label className="text-xs font-bold text-slate-700">Nama Tampilan Pemain</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={24}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Nama pemain..."
                            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={handleSaveProfile}
                            disabled={isSavingProfile}
                            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shrink-0"
                          >
                            {isSavingProfile ? 'Menyimpan...' : 'Simpan'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Google Cloud Synchronization Status & Actions */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-center sm:text-left">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Sinkronisasi Google Cloud Aktif</p>
                          <p className="text-[11px] text-slate-500">
                            Lagu impor, pengaturan game, skor, level, dan rekor tersinkronisasi otomatis dengan akun Google Anda.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Keluar (Logout)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Not Logged In - Prompt to Sign in with Google */
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 text-center space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/10">
                      <GoogleIcon className="w-7 h-7" />
                    </div>

                    <div className="max-w-md mx-auto space-y-1">
                      <h3 className="text-base font-black text-slate-900">Masuk dengan Akun Google</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Hubungkan akun Google Anda untuk menyimpan skor tertinggi, riwayat permainan, dan foto profil Google secara otomatis.
                      </p>
                    </div>

                    <div className="pt-2 max-w-sm mx-auto space-y-2.5">
                      <button
                        type="button"
                        onClick={() => handleGoogleSignIn('agungdarlayx@gmail.com', 'Agung Darlay')}
                        disabled={isGoogleSigningIn}
                        className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-md"
                      >
                        <GoogleIcon className="w-5 h-5" />
                        <span>{isGoogleSigningIn ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowCustomGooglePrompt(!showCustomGooglePrompt)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline transition-colors"
                      >
                        {showCustomGooglePrompt ? 'Tutup Pilihan Manual' : 'Gunakan Akun Google / Email Lain'}
                      </button>

                      {showCustomGooglePrompt && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-left animate-in fade-in duration-150">
                          <label className="text-[11px] font-bold text-slate-700">Email Google</label>
                          <input
                            type="email"
                            value={customGoogleEmail}
                            onChange={(e) => setCustomGoogleEmail(e.target.value)}
                            placeholder="nama@gmail.com"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                          />
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleGoogleSignIn(customGoogleEmail, customGoogleName)}
                              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                            >
                              Hubungkan
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCustomGooglePrompt(false)}
                              className="px-3 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* =========================================================================
                    AUTOLOGIN & SAVED ACCOUNT HISTORY SECTION
                ========================================================================= */}
                <div className="pt-2 space-y-4 border-t border-slate-200/80">
                  {/* Auto Login Switch Card */}
                  <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-md">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                          <Power className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">
                            Login Otomatis saat Aplikasi Dibuka
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                autoLoginEnabled
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {autoLoginEnabled ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Aplikasi secara otomatis memuat akun Google terakhir tanpa perlu klik tombol masuk secara manual.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleAutoLogin(!autoLoginEnabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          autoLoginEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            autoLoginEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Saved Accounts / Last Login History */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-bold text-slate-900">Riwayat Login Terakhir</h4>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {savedAccounts.length} Akun
                        </span>
                      </div>

                      {savedAccounts.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllHistory}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Bersihkan Riwayat
                        </button>
                      )}
                    </div>

                    {savedAccounts.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-1">
                        <p className="text-xs font-bold text-slate-700">Belum ada riwayat akun tersimpan</p>
                        <p className="text-[11px] text-slate-500">
                          Saat Anda masuk dengan Akun Google, riwayat login terakhir akan tersimpan di sini untuk mendukung fitur login otomatis.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {savedAccounts.map((acc) => {
                          const isCurrentActive = profile.isGoogleLinked && profile.uid === acc.uid;
                          return (
                            <div
                              key={acc.uid}
                              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                                isCurrentActive
                                  ? 'bg-indigo-50/40 border-indigo-200/80 shadow-xs'
                                  : 'bg-white border-slate-200/90 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={acc.avatarUrl || authService.generateGoogleAvatarSvg(acc.username, acc.email)}
                                  alt={acc.username}
                                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-slate-900 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-xs font-bold text-slate-900 truncate">{acc.username}</p>
                                    {isCurrentActive ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold flex items-center gap-1">
                                        <UserCheck className="w-2.5 h-2.5" /> Sedang Aktif
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        Terakhir aktif: {formatLastActive(acc.lastActive)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate font-mono">{acc.email}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                {!isCurrentActive && (
                                  <button
                                    type="button"
                                    onClick={() => handleSwitchAccount(acc)}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1"
                                  >
                                    <RefreshCw className="w-3 h-3" /> Gunakan Akun Ini
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSavedAccount(acc.uid)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Hapus dari riwayat"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 1. KONTROL & INPUT */}
            {activeTab === 'controls' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Mobile Touch Mode */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-indigo-600" />
                        Mode Kontrol Layar Sentuh (Mobile / Tablet)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Pilih tata letak tombol saat bermain di perangkat layar sentuh
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLocalSettings({ ...localSettings, touchControlMode: 'thumb' })}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        (localSettings.touchControlMode || 'thumb') === 'thumb'
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          Tombol Jempol Bawah (Thumb Bar)
                        </span>
                        {(localSettings.touchControlMode || 'thumb') === 'thumb' && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        4 pad besar di bagian bawah layar. Sangat ergonomis saat memegang perangkat dengan dua tangan.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLocalSettings({ ...localSettings, touchControlMode: 'direct' })}
                      className={`p-4 rounded-2xl border text-left transition-all relative ${
                        localSettings.touchControlMode === 'direct'
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          Ketuk Jalur Note Langsung (Direct Lane)
                        </span>
                        {localSettings.touchControlMode === 'direct' && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Ketuk langsung area jalur falling note di area timing judgment bar seperti arcade tap.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Keyboard Keybinding Mapping */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Key className="w-4 h-4 text-indigo-600" />
                        Pemetaan Tombol Keyboard (4 Jalur)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Klik pada kotak jalur untuk merekam tombol keyboard baru
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setLocalSettings({
                          ...localSettings,
                          keyBindings: { lane0: 'KeyD', lane1: 'KeyF', lane2: 'KeyJ', lane3: 'KeyK' },
                        });
                        showToast('Tombol direset ke D, F, J, K');
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Set Standar (D F J K)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map((lane) => {
                      const laneKey = `lane${lane}` as keyof typeof localSettings.keyBindings;
                      const currentCode = localSettings.keyBindings[laneKey];
                      const isEditing = editingLane === lane;

                      return (
                        <div key={lane} className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => setEditingLane(lane)}
                            className={`w-full p-3.5 min-h-[68px] rounded-2xl border text-center transition-all flex flex-col items-center justify-center relative group ${
                              isEditing
                                ? 'bg-indigo-600 text-white border-indigo-700 ring-4 ring-indigo-200 animate-pulse'
                                : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-indigo-300 text-slate-900 hover:shadow-sm'
                            }`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600">
                              Jalur {lane + 1}
                            </span>
                            <span className="text-lg font-black font-mono mt-0.5">
                              {isEditing ? 'Tekan Tombol...' : getKeyLabel(currentCode)}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {editingLane !== null && (
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center text-xs font-semibold text-indigo-900 animate-in fade-in">
                      Sedang merekam untuk <span className="font-bold">Jalur {editingLane + 1}</span>. Tekan tombol apa saja pada keyboard Anda untuk menggantinya.
                    </div>
                  )}
                </div>

                {/* Haptic Vibration Feedback */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Vibrate className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold text-slate-900">Umpan Balik Getaran (Haptic Feedback)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Memberikan getaran mikro responsif saat ketukan mengenai note di ponsel
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={testHaptic}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-colors"
                    >
                      Tes Getar
                    </button>
                    <input
                      type="checkbox"
                      checked={localSettings.hapticFeedback ?? true}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, hapticFeedback: e.target.checked })
                      }
                      className="w-5 h-5 accent-indigo-600 cursor-pointer rounded"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. AUDIO & LATENSI */}
            {activeTab === 'audio' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Volume Sliders & Test Hitsound */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-indigo-600" />
                        Pengaturan Tingkat Suara (Audio Volumes)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Seimbangkan volume lagu latar dan efek ketukan instan
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          audioEngine.playHitsound('perfect');
                          showToast('Hitsound: Perfect');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3 h-3 text-indigo-600" />
                        <span>Tes Suara Hitsound</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* BGM Volume */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Music className="w-3.5 h-3.5 text-indigo-600" />
                          Volume Musik BGM
                        </span>
                        <span className="font-mono text-indigo-600">
                          {Math.round(localSettings.bgmVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={localSettings.bgmVolume}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setLocalSettings({ ...localSettings, bgmVolume: val });
                          audioEngine.setVolumes(val, localSettings.sfxVolume);
                        }}
                        className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                    </div>

                    {/* SFX Volume */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          Volume Efek Suara (SFX)
                        </span>
                        <span className="font-mono text-purple-600">
                          {Math.round(localSettings.sfxVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={localSettings.sfxVolume}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setLocalSettings({ ...localSettings, sfxVolume: val });
                          audioEngine.setVolumes(localSettings.bgmVolume, val);
                        }}
                        className="w-full accent-purple-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Audio Offset & Metronome Calibration */}
                <div className="p-5 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-600" />
                        Kalibrasi Latensi Audio (Audio Offset)
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Kompensasi delay Bluetooth atau speaker browser agar visual note presisi dengan ritme musik
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black px-3 py-1 bg-white border border-indigo-200 rounded-xl text-indigo-700 shadow-2xs">
                        {localSettings.audioOffsetMs > 0 ? `+${localSettings.audioOffsetMs}` : localSettings.audioOffsetMs} ms
                      </span>
                      <button
                        type="button"
                        onClick={() => setLocalSettings({ ...localSettings, audioOffsetMs: 0 })}
                        className="px-2 py-1 bg-white border border-indigo-200 rounded-xl text-[11px] font-bold text-slate-600 hover:text-indigo-600 transition-colors"
                      >
                        Reset 0ms
                      </button>
                    </div>
                  </div>

                  {/* Manual Slider & Quick Steppers */}
                  <div className="space-y-3">
                    <input
                      type="range"
                      min={-150}
                      max={150}
                      step={5}
                      value={localSettings.audioOffsetMs}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, audioOffsetMs: parseInt(e.target.value) })
                      }
                      className="w-full accent-indigo-600 cursor-pointer h-2.5 bg-slate-200 rounded-lg"
                    />

                    {/* Quick Stepper Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-slate-600">
                      <span className="text-[10px] text-slate-500 font-semibold">-150ms (Mendahului)</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              audioOffsetMs: Math.max(-150, prev.audioOffsetMs - 10),
                            }))
                          }
                          className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold hover:bg-indigo-50"
                        >
                          -10ms
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              audioOffsetMs: Math.max(-150, prev.audioOffsetMs - 1),
                            }))
                          }
                          className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold hover:bg-indigo-50"
                        >
                          -1ms
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              audioOffsetMs: Math.min(150, prev.audioOffsetMs + 1),
                            }))
                          }
                          className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold hover:bg-indigo-50"
                        >
                          +1ms
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalSettings((prev) => ({
                              ...prev,
                              audioOffsetMs: Math.min(150, prev.audioOffsetMs + 10),
                            }))
                          }
                          className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold hover:bg-indigo-50"
                        >
                          +10ms
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold">+150ms (Terlambat)</span>
                    </div>
                  </div>

                  {/* Interactive Metronome Calibration Tool */}
                  <div className="p-4 bg-white border border-indigo-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-bold text-slate-900">Alat Kalibrasi Otomatis (Metronome Tap)</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCalibrationTap}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 min-h-[44px] ${
                          isCalibrating
                            ? 'bg-indigo-600 text-white animate-bounce ring-4 ring-indigo-200'
                            : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{isCalibrating ? `Ketuk Sesuai Ketukan (${tapOffsets.length}/8)` : 'Mulai Uji Ketukan'}</span>
                      </button>
                    </div>

                    {isCalibrating && (
                      <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-2 text-center animate-in fade-in">
                        <div className="flex items-center justify-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-full transition-all duration-100 ${
                              calibBeatCount % 2 === 0 ? 'bg-indigo-600 scale-125 shadow-md shadow-indigo-300' : 'bg-slate-300 scale-90'
                            }`}
                          />
                          <span className="text-xs font-bold font-mono text-slate-800">
                            Metronome 120 BPM — Ketukan #{calibBeatCount}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Dengarkan detak metronome dan ketuk tombol <span className="font-bold">"Ketuk Sesuai Ketukan"</span> tepat saat suara 'tik' berbunyi!
                        </p>
                        {lastTapResult && (
                          <div className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold inline-block ${lastTapResult.color}`}>
                            {lastTapResult.text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. GAMEPLAY & VISUAL */}
            {activeTab === 'gameplay' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Note Scroll Speed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-indigo-600" />
                        Kecepatan Jatuh Note (Scroll Speed)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Atur kecepatan note mengalir ke judgment line (1.0x hingga 4.0x)
                      </p>
                    </div>
                    <span className="text-base font-black font-mono text-indigo-600 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-xl">
                      {(localSettings?.scrollSpeed ?? 2.2).toFixed(1)}x
                    </span>
                  </div>

                  <input
                    type="range"
                    min={1.0}
                    max={4.0}
                    step={0.1}
                    value={localSettings?.scrollSpeed ?? 2.2}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, scrollSpeed: parseFloat(e.target.value) || 2.2 })
                    }
                    className="w-full accent-indigo-600 cursor-pointer h-2.5 bg-slate-200 rounded-lg"
                  />

                  {/* Preset Speed Pills */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Preset Cepat:</span>
                    {[1.5, 2.0, 2.2, 2.5, 3.0, 3.5].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setLocalSettings({ ...localSettings, scrollSpeed: speed })}
                        className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                          Math.abs((localSettings?.scrollSpeed ?? 2.2) - speed) < 0.05
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {speed.toFixed(1)}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note Skin Themes */}
                <div className="space-y-3 pt-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Tema Tampilan Note Skin
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih gaya estetika visual falling note dan glow efek
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'cyber', name: 'Cyber Blue', color: 'from-cyan-500 to-blue-600', border: 'border-cyan-400' },
                      { id: 'neon', name: 'Neon Violet', color: 'from-fuchsia-500 to-purple-600', border: 'border-purple-400' },
                      { id: 'pastel', name: 'Pastel Emerald', color: 'from-emerald-400 to-teal-500', border: 'border-emerald-400' },
                      { id: 'classic', name: 'Classic Gold', color: 'from-amber-400 to-orange-500', border: 'border-amber-400' },
                    ].map((skin) => (
                      <button
                        key={skin.id}
                        type="button"
                        onClick={() => setLocalSettings({ ...localSettings, noteSkin: skin.id as any })}
                        className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
                          (localSettings.noteSkin || 'cyber') === skin.id
                            ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20'
                            : 'bg-slate-50 hover:bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div
                          className={`w-full h-5 rounded-lg bg-gradient-to-r ${skin.color} shadow-xs border ${skin.border}`}
                        />
                        <span className="text-xs font-bold text-slate-800">{skin.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Timing Bar Indicator Toggle */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900">Bilah Panduan Akurasi Timing (Timing Bar)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Menampilkan grafik garis mini di bawah untuk melihat apakah ketukan Anda mendahului atau terlambat
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.showTimingBar ?? true}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, showTimingBar: e.target.checked })
                    }
                    className="w-5 h-5 accent-indigo-600 cursor-pointer rounded"
                  />
                </div>

                {/* Auto-Play Toggle */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">Mode Auto-Play (Bot Demonstrasi)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Secara otomatis memukul semua note secara sempurna untuk melihat dan menguji chart lagu
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoPlay ?? false}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, autoPlay: e.target.checked })
                    }
                    className="w-5 h-5 accent-indigo-600 cursor-pointer rounded"
                  />
                </div>
              </div>
            )}

            {/* 4. PENYIMPANAN & KEAMANAN DATA */}
            {activeTab === 'storage' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Persistent Storage Shield Status */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Perlindungan Penyimpanan Permanen
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Mencegah browser menghapus lagu dan chart secara otomatis saat ruang penuh
                        </p>
                      </div>
                    </div>

                    {storageStatus?.isPersisted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Permanen Aktif
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={onRequestPersistence}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Kunci Permanen
                      </button>
                    )}
                  </div>
                </div>

                {/* Cloud SQL Database Sync Banner */}
                <div className="p-5 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Sinkronisasi Chart Antar Perangkat
                        </h4>
                        <p className="text-[11px] text-slate-600">
                          Chart mengikuti akun Google. Audio MP3 lokal perlu dihubungkan ulang pada perangkat lain.
                        </p>
                      </div>
                    </div>
                    {profile.isGoogleLinked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        Akun Google
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Mode Tamu (Lokal)
                      </span>
                    )}
                  </div>
                </div>

                {/* Storage Diagnostics Cards */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Statistik Basis Data Browser
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Kapasitas Terpakai</p>
                      <p className="text-sm sm:text-base font-black font-mono text-slate-900 mt-1">
                        {formatBytes(storageStatus?.usageBytes || 0)}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Total Lagu</p>
                      <p className="text-sm sm:text-base font-black font-mono text-indigo-600 mt-1">
                        {storageStatus?.songsCount || 0} Lagu
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Rekor Skor</p>
                      <p className="text-sm sm:text-base font-black font-mono text-emerald-600 mt-1">
                        {storageStatus?.scoresCount || 0} Skor
                      </p>
                    </div>
                  </div>
                </div>

                {/* Full Library Backup & Restore */}
                <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-indigo-600" />
                      Cadangkan & Pulihkan Seluruh Data (.json)
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Ekspor semua lagu kustom, chart buatan sendiri, dan rekor skor ke file cadangan yang aman untuk dipindahkan ke perangkat lain.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    {onExportBackup && (
                      <button
                        type="button"
                        onClick={onExportBackup}
                        className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-200 min-h-[44px]"
                      >
                        <Download className="w-4 h-4" />
                        <span>Unduh File Cadangan (.json)</span>
                      </button>
                    )}

                    {onImportBackup && (
                      <>
                        <input
                          ref={backupFileInputRef}
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={handleBackupFileSelect}
                        />
                        <button
                          type="button"
                          onClick={() => backupFileInputRef.current?.click()}
                          className="flex-1 py-3 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all min-h-[44px]"
                        >
                          <Upload className="w-4 h-4 text-emerald-600" />
                          <span>Pulihkan dari File (.json)</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Reset to Factory Defaults */}
                <div className="p-4 border border-rose-100 bg-rose-50/50 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-rose-950">Atur Ulang Semua Pengaturan</h4>
                    <p className="text-[11px] text-slate-500">Kembalikan tombol, volume, dan kecepatan ke standar awal</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setResetConfirmOpen(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-white hover:bg-rose-100 border border-rose-200 transition-colors"
                  >
                    Reset Sekarang
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Modal for Reset Defaults */}
        {resetConfirmOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">Reset Semua Pengaturan?</h3>
                <p className="text-xs text-slate-500">
                  Semua preferensi tombol, audio offset, dan kecepatan scroll akan dikembalikan ke setelan default pabrik. (Lagu dan skor Anda tetap aman).
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200"
                >
                  Ya, Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Actions Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Perubahan tersimpan otomatis saat Anda menekan tombol simpan</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 min-h-[44px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-indigo-200 transition-all"
            >
              <Check className="w-4 h-4 text-indigo-200" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};

