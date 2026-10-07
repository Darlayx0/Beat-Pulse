import React from 'react';
import { Song, DifficultyLevel, HighScore, UIStatus } from '../types';
import { SongLibrary } from '../components/SongLibrary';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { EmptyState } from '../components/common/EmptyState';

interface LibraryScreenProps {
  status: UIStatus;
  errorMessage?: string | null;
  songs: Song[];
  audioBuffers?: Record<string, AudioBuffer>;
  highScores: Record<string, Record<string, HighScore>>;
  onSelectSongToPlay: (song: Song, difficulty: DifficultyLevel) => void;
  onSelectSongToEdit: (song: Song, difficulty: DifficultyLevel) => void;
  onDeleteSong: (songId: string) => void;
  onOpenImportModal: () => void;
  onRetryInit?: () => void;
  onAddDifficulty?: (songId: string, diffName: string) => void;
  onRenameDifficulty?: (songId: string, oldDiff: string, newDiff: string) => void;
  onDeleteDifficulty?: (songId: string, diffName: string) => void;
  onReorderDifficulties?: (songId: string, newOrder: string[]) => void;
  onDuplicateDifficulty?: (songId: string, sourceDiffName: string, newDiffName: string) => void;
  onDuplicateSong?: (songId: string) => void;
  onRelinkAudio?: (songId: string, file: File) => void;
  onImportChartJson?: (songId: string, jsonString: string) => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  status,
  errorMessage,
  songs,
  audioBuffers,
  highScores,
  onSelectSongToPlay,
  onSelectSongToEdit,
  onDeleteSong,
  onOpenImportModal,
  onRetryInit,
  onAddDifficulty,
  onRenameDifficulty,
  onDeleteDifficulty,
  onReorderDifficulties,
  onDuplicateDifficulty,
  onDuplicateSong,
  onRelinkAudio,
  onImportChartJson,
}) => {
  if (status === 'loading') {
    return <LoadingSpinner message="Memuat pustaka lagu & audio engine..." size="lg" />;
  }

  if (status === 'error') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ErrorBanner
          title="Gagal Memuat Pustaka Lagu"
          message={errorMessage || 'Terjadi kesalahan sistem saat membaca data lagu.'}
          onRetry={onRetryInit}
        />
      </div>
    );
  }

  if (status === 'empty' || songs.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EmptyState
          title="Belum Ada Lagu Tersedia"
          description="Pustaka lagu Anda kosong. Impor file audio MP3/WAV favorit Anda untuk mulai membuat chart dan bermain!"
          actionLabel="Impor Lagu Sekarang"
          onAction={onOpenImportModal}
        />
      </div>
    );
  }

  return (
    <SongLibrary
      songs={songs}
      audioBuffers={audioBuffers}
      highScores={highScores}
      onSelectSongToPlay={onSelectSongToPlay}
      onSelectSongToEdit={onSelectSongToEdit}
      onDeleteSong={onDeleteSong}
      onOpenImportModal={onOpenImportModal}
      onAddDifficulty={onAddDifficulty}
      onRenameDifficulty={onRenameDifficulty}
      onDeleteDifficulty={onDeleteDifficulty}
      onReorderDifficulties={onReorderDifficulties}
      onDuplicateDifficulty={onDuplicateDifficulty}
      onDuplicateSong={onDuplicateSong}
      onRelinkAudio={onRelinkAudio}
      onImportChartJson={onImportChartJson}
    />
  );
};
