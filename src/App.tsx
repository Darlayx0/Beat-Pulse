import React, { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { Navbar } from './components/Navbar';
import { SettingsModal, SettingsTab } from './components/SettingsModal';
import { ImportSongModal } from './components/ImportSongModal';
import { Toast } from './components/common/Toast';
import { NetworkStatusBanner } from './components/common/NetworkStatusBanner';

import { LibraryScreen } from './screens/LibraryScreen';
import { GameScreen } from './screens/GameScreen';
import { EditorScreen } from './screens/EditorScreen';
import { ResultsScreen } from './screens/ResultsScreen';

export default function App() {
  const {
    tab,
    setTab,
    status,
    errorMessage,
    initializeApp,
    songs,
    audioBuffers,
    highScores,
    settings,
    storageStatus,
    activeSong,
    activeChart,
    lastGameStats,
    toasts,
    addToast,
    dismissToast,
    selectSongToPlay,
    selectSongToEdit,
    handleRelinkSongAudio,
    handleImportChartJson,
    handleImportSong,
    handleDeleteSong,
    handleFinishGame,
    handleSaveChart,
    handleAddDifficulty,
    handleRenameDifficulty,
    handleDeleteDifficulty,
    handleReorderDifficulties,
    handleDuplicateDifficulty,
    handleDuplicateSong,
    handleUpdateSettings,
    handleExportBackup,
    handleImportBackup,
    handleRequestPersistence,
    isTestPlay,
    testPlayStartTime,
    isOffline,
    setIsOffline,
  } = useGameState();

  // Modal Dialog States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('profile');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [libraryNavigationKey, setLibraryNavigationKey] = useState(0);

  const openSettingsWithTab = (targetTab: SettingsTab = 'profile') => {
    setSettingsTab(targetTab);
    setIsSettingsOpen(true);
  };

  // Suppress browser callouts only while playing; library text remains selectable.
  React.useEffect(() => {
    if (tab !== 'game') return;
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isEditable = target.closest('input, textarea, [contenteditable="true"]');
      if (!isEditable) {
        e.preventDefault();
      }
    };

    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isEditable = target.closest('input, textarea, [contenteditable="true"]');
      if (!isEditable) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [tab]);

  return (
    <div className={`min-h-screen text-slate-900 font-sans selection:bg-indigo-100 flex flex-col relative ${tab === 'game' ? 'bg-slate-50 bp-game-surface' : 'bp-app'}`}>
      {/* Global Persistent YouTube Player Host (Never Reparented, Never Reloaded on Renders) */}
      <div
        id="beatpulse-yt-wrapper"
        aria-hidden="true"
        className={`fixed inset-0 pointer-events-none transition-opacity duration-500 overflow-hidden flex items-center justify-center ${
          tab === 'game' && activeSong?.youtubeVideoId
            ? 'opacity-35 z-0'
            : 'opacity-0 -z-50'
        }`}
      >
        <div id="beatpulse-yt-player-host" className="w-full h-full min-w-[320px] min-h-[240px]" />
      </div>

      {/* Top Main Navbar (Hidden during gameplay and editor to avoid overlapping headers) */}
      {tab !== 'game' && tab !== 'editor' && (
        <Navbar
          currentTab={tab}
          setCurrentTab={(t) => {
            if (t !== 'settings') {
              setTab(t);
              if (t === 'library') {
                setLibraryNavigationKey((key) => key + 1);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }
            }
          }}
          openSettings={() => openSettingsWithTab('profile')}
          openImportModal={() => setIsImportOpen(true)}
        />
      )}

      {/* Main Screen View Router */}
      <main id="main-content" tabIndex={-1} className={`flex-1 w-full max-w-full ${tab !== 'library' ? 'overflow-x-hidden' : ''} ${tab === 'game' ? 'p-0 overflow-hidden' : tab === 'library' ? 'pb-0' : 'pb-12'}`}>
        {tab === 'library' && (
          <LibraryScreen
            key={libraryNavigationKey}
            status={status}
            errorMessage={errorMessage}
            songs={songs}
            audioBuffers={audioBuffers}
            highScores={highScores}
            onSelectSongToPlay={selectSongToPlay}
            onSelectSongToEdit={selectSongToEdit}
            onDeleteSong={handleDeleteSong}
            onOpenImportModal={() => setIsImportOpen(true)}
            onRetryInit={initializeApp}
            onAddDifficulty={handleAddDifficulty}
            onRenameDifficulty={handleRenameDifficulty}
            onDeleteDifficulty={handleDeleteDifficulty}
            onReorderDifficulties={handleReorderDifficulties}
            onDuplicateDifficulty={handleDuplicateDifficulty}
            onDuplicateSong={handleDuplicateSong}
            onRelinkAudio={handleRelinkSongAudio}
            onImportChartJson={handleImportChartJson}
          />
        )}

        {tab === 'game' && activeSong && activeChart && (
          <GameScreen
            song={activeSong}
            chart={activeChart}
            settings={settings}
            audioBuffer={audioBuffers[activeSong.id] || null}
            isTestPlay={isTestPlay}
            startFromTime={testPlayStartTime}
            onFinishGame={handleFinishGame}
            onExitGame={() => setTab(isTestPlay ? 'editor' : 'library')}
            isSettingsOpen={isSettingsOpen}
            onOpenSettings={() => openSettingsWithTab('controls')}
          />
        )}

        {tab === 'editor' && (
          <EditorScreen
            key={activeSong?.id ? `editor_${activeSong.id}_${activeChart?.difficulty || 'Medium'}` : 'editor_default'}
            songs={songs}
            activeSongId={activeSong?.id}
            activeDifficulty={activeChart?.difficulty || 'Medium'}
            audioBuffers={audioBuffers}
            onTestPlay={(song, chart, startFromTime) => selectSongToPlay(song, chart.difficulty, chart, true, startFromTime)}
            onSaveChart={handleSaveChart}
            onBackToLibrary={() => setTab('library')}
            onAddDifficulty={handleAddDifficulty}
            onRenameDifficulty={handleRenameDifficulty}
            onDeleteDifficulty={handleDeleteDifficulty}
            onReorderDifficulties={handleReorderDifficulties}
            onDuplicateDifficulty={handleDuplicateDifficulty}
            onDuplicateSong={handleDuplicateSong}
            onRelinkSongAudio={handleRelinkSongAudio}
            onImportChartJson={handleImportChartJson}
          />
        )}

        {tab === 'results' && activeSong && activeChart && lastGameStats && (
          <ResultsScreen
            song={activeSong}
            chart={activeChart}
            stats={lastGameStats}
            onRetry={() => setTab('game')}
            onBackToLibrary={() => setTab('library')}
            onEditChart={() => setTab('editor')}
          />
        )}
      </main>

      {/* Network Status Floating Overlay Banner */}
      <NetworkStatusBanner
        isOffline={isOffline}
        inline={tab === 'library' || tab === 'results'}
        onRetryConnection={() => {
          if (navigator.onLine) {
            setIsOffline(false);
            addToast('success', 'Koneksi terhubung kembali!');
          } else {
            addToast('error', 'Koneksi internet belum tersedia. Melanjutkan dalam mode offline.');
          }
        }}
      />

      {/* Global Toast Notification Engine */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        storageStatus={storageStatus}
        initialTab={settingsTab}
        onUpdateSettings={handleUpdateSettings}
        onRequestPersistence={handleRequestPersistence}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />

      <ImportSongModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSongImported={(newSong, audioData) => handleImportSong(newSong, audioData)}
      />
    </div>
  );
}

