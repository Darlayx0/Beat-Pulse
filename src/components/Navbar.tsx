import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Activity,
  ArrowLeft,
  Cloud,
  CloudOff,
  Loader2,
  Settings,
} from "lucide-react";
import { authService } from "../services/authService";
import {
  getSyncStatus,
  subscribeSyncStatus,
} from "../services/chartCloudService";
import { ChartSyncStatus } from "./common/ChartSyncStatus";
import { MenuDialog } from "./library/MenuDialog";

interface NavbarProps {
  currentTab: "library" | "editor" | "game" | "results";
  setCurrentTab: (tab: "library" | "editor" | "settings") => void;
  openSettings: () => void;
  openImportModal: () => void;
}

const syncLabels = {
  local: "Tersimpan lokal",
  syncing: "Menyinkronkan",
  synced: "Tersinkron",
  offline: "Offline",
  error: "Sinkronisasi tertunda",
};

export function Navbar({
  currentTab,
  setCurrentTab,
  openSettings,
}: NavbarProps) {
  const [profile, setProfile] = useState(() => authService.getCurrentProfile());
  const [syncOpen, setSyncOpen] = useState(false);
  const syncStatus = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  useEffect(() => authService.subscribe(setProfile), []);
  const SyncIcon =
    syncStatus === "syncing"
      ? Loader2
      : syncStatus === "offline" || syncStatus === "error"
        ? CloudOff
        : Cloud;
  return (
    <>
      <a href="#main-content" className="bp-skip-link">
        Lewati ke konten utama
      </a>
      <header className="bp-header">
        <div className="bp-header__inner">
          <button
            type="button"
            className="bp-brand"
            aria-label="BeatPulse — kembali ke pustaka"
            onClick={() => setCurrentTab("library")}
          >
            <span className="bp-brand__symbol">
              <Activity size={25} strokeWidth={2.1} />
            </span>
            <span>
              <span className="bp-brand__name">
                Beat<span>Pulse</span>
              </span>
              <span className="bp-brand__tagline">RHYTHM STUDIO</span>
            </span>
          </button>
          <nav className="bp-header__nav" aria-label="Navigasi utama">
            <button
              type="button"
              className="bp-nav-link"
              aria-current={currentTab === "library" ? "page" : undefined}
              onClick={() => setCurrentTab("library")}
            >
              {currentTab === "results" && <ArrowLeft size={16} />} Pustaka
            </button>
          </nav>
          <div className="bp-header__actions">
            <button
              type="button"
              className={`bp-sync-trigger bp-sync-trigger--${syncStatus}`}
              onClick={() => setSyncOpen(true)}
              aria-label={`Sinkronisasi: ${syncLabels[syncStatus]}`}
              aria-haspopup="dialog"
            >
              <SyncIcon
                size={17}
                className={syncStatus === "syncing" ? "bp-spin" : ""}
              />
              <span>{syncLabels[syncStatus]}</span>
            </button>
            <span className="bp-header__divider" />
            <button
              type="button"
              className="bp-profile-trigger"
              onClick={openSettings}
              aria-label="Pengaturan dan akun"
              aria-haspopup="dialog"
              title={
                profile.username
                  ? `Pengaturan — ${profile.username}`
                  : "Pengaturan dan akun"
              }
            >
              {profile.isGoogleLinked && profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Settings size={20} />
              )}
              <span>Pengaturan</span>
            </button>
          </div>
        </div>
      </header>
      {syncOpen && (
        <MenuDialog
          title="Sinkronisasi pustaka"
          description="Kelola koneksi dan lihat status penyimpanan antar perangkat."
          onClose={() => setSyncOpen(false)}
          wide
        >
          <div className="bp-sync-panel">
            <ChartSyncStatus />
          </div>
          <button
            type="button"
            className="bp-button bp-button--secondary bp-sync-done"
            onClick={() => setSyncOpen(false)}
          >
            Selesai
          </button>
        </MenuDialog>
      )}
    </>
  );
}
