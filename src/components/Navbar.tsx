import React, { useState, useEffect } from 'react';
import { Settings, Sparkles, Plus } from 'lucide-react';
import { authService } from '../services/authService';
import { UserProfile } from '../types';
import { ChartSyncStatus } from './common/ChartSyncStatus';

interface NavbarProps {
  currentTab: 'library' | 'editor' | 'game' | 'results';
  setCurrentTab: (tab: 'library' | 'editor' | 'settings') => void;
  openSettings: () => void;
  openImportModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  openSettings,
  openImportModal,
}) => {
  const [profile, setProfile] = useState<UserProfile>(authService.getCurrentProfile());

  useEffect(() => {
    const unsub = authService.subscribe((p) => {
      setProfile(p);
    });
    return unsub;
  }, []);

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 text-slate-900 px-3 sm:px-6 py-2 sm:py-2.5 transition-all shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div
            onClick={() => setCurrentTab('library')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 p-0.5 shadow-md shadow-slate-900/10 group-hover:scale-105 transition-transform flex-shrink-0 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 leading-tight">
                BeatPulse
              </h1>
              <p className="text-[9px] sm:text-[10px] text-indigo-600 font-semibold tracking-widest font-mono uppercase">
                Rhythm Studio
              </p>
            </div>
          </div>

          {/* Action Buttons & Unified Settings/Account Trigger */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {currentTab !== 'game' && (
              <button
                onClick={openImportModal}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs sm:text-sm font-bold transition-all shadow-sm"
              >
                <Plus className="w-4 h-4 text-indigo-300" />
                <span className="hidden sm:inline">Impor Musik</span>
                <span className="sm:hidden">Impor</span>
              </button>
            )}

            {/* Unified Settings Button (Morphs to Google Profile Picture if logged in) */}
            {profile.isGoogleLinked ? (
              <button
                onClick={openSettings}
                className="relative p-1 min-h-[40px] rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 active:scale-95 transition-all shadow-2xs group flex items-center gap-2"
                title={`Pengaturan & Akun Google (${profile.username})`}
              >
                <div className="relative">
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username}
                    className="w-8 h-8 rounded-lg object-cover bg-slate-900 border border-slate-200"
                  />
                  <div className="absolute -bottom-1 -right-1 p-0.5 bg-slate-900 text-white rounded-full shadow-xs">
                    <Settings className="w-2.5 h-2.5 group-hover:rotate-45 transition-transform" />
                  </div>
                </div>
                <div className="text-left hidden md:block pr-1.5">
                  <p className="text-xs font-black text-slate-800 group-hover:text-indigo-600 leading-tight truncate max-w-[100px]">
                    {profile.username}
                  </p>
                  <p className="text-[9px] text-emerald-600 font-semibold leading-none">
                    Pengaturan
                  </p>
                </div>
              </button>
            ) : (
              <button
                onClick={openSettings}
                className="p-2 sm:p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs group"
                title="Pengaturan & Akun Google"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-45 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </header>
      <ChartSyncStatus />
    </>
  );
};
