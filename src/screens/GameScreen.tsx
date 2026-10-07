import React, { useState } from 'react';
import { Song, Chart, GameSettings, GameStats } from '../types';
import { RhythmGame } from '../components/RhythmGame';
import { ConfirmModal } from '../components/common/ConfirmModal';

interface GameScreenProps {
  song: Song;
  chart: Chart;
  settings: GameSettings;
  audioBuffer: AudioBuffer | null;
  isTestPlay?: boolean;
  startFromTime?: number;
  onFinishGame: (stats: GameStats) => void;
  onExitGame: () => void;
  isSettingsOpen?: boolean;
  onOpenSettings?: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  song,
  chart,
  settings,
  audioBuffer,
  isTestPlay = false,
  startFromTime = 0,
  onFinishGame,
  onExitGame,
  isSettingsOpen = false,
  onOpenSettings,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  return (
    <>
      <RhythmGame
        song={song}
        chart={chart}
        settings={settings}
        audioBuffer={audioBuffer}
        isTestPlay={isTestPlay}
        startFromTime={startFromTime}
        onFinishGame={onFinishGame}
        onExitGame={() => setShowExitConfirm(true)}
        isExternalPaused={showExitConfirm || isSettingsOpen}
        onOpenSettings={onOpenSettings}
      />

      <ConfirmModal
        isOpen={showExitConfirm}
        title={isTestPlay ? 'Kembali ke Editor?' : 'Keluar dari Permainan?'}
        message={
          isTestPlay
            ? 'Sesi uji coba permainan akan dihentikan dan Anda akan kembali ke editor chart.'
            : 'Sesi permainan Anda yang sedang berjalan akan dihentikan dan progres skor tidak akan disimpan.'
        }
        confirmLabel={isTestPlay ? 'Kembali ke Editor' : 'Keluar'}
        cancelLabel="Lanjutkan Bermain"
        isDanger={true}
        onConfirm={() => {
          setShowExitConfirm(false);
          onExitGame();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </>
  );
};
