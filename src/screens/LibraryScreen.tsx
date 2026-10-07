import React from "react";
import { Song, DifficultyLevel, HighScore, UIStatus } from "../types";
import { SongLibrary } from "../components/SongLibrary";
import { LibraryHero } from "../components/library/LibraryHero";
import { AudioLines, RefreshCw, TriangleAlert } from "lucide-react";

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
  onRenameDifficulty?: (
    songId: string,
    oldDiff: string,
    newDiff: string,
  ) => void;
  onDeleteDifficulty?: (songId: string, diffName: string) => void;
  onReorderDifficulties?: (songId: string, newOrder: string[]) => void;
  onDuplicateDifficulty?: (
    songId: string,
    sourceDiffName: string,
    newDiffName: string,
  ) => void;
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
  if (status === "loading") {
    return (
      <div className="bp-menu bp-container bp-loading" aria-busy="true">
        <div className="bp-loading__heading" role="status">
          <AudioLines size={23} />
          <span>Menyiapkan pustaka musikmu…</span>
        </div>
        <div className="bp-loading__hero" aria-hidden="true" />
        <div className="bp-song-grid" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <div className="bp-loading__card" key={item}>
              <div />
              <span />
              <span />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bp-menu bp-container">
        <div className="bp-no-results" role="alert">
          <TriangleAlert size={32} />
          <h1>Pustaka belum dapat dimuat</h1>
          <p>
            {errorMessage ||
              "Terjadi kendala saat membaca lagu. Coba muat kembali."}
          </p>
          {onRetryInit && (
            <button
              type="button"
              className="bp-button bp-button--primary"
              onClick={onRetryInit}
            >
              <RefreshCw size={17} /> Coba lagi
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "empty" || songs.length === 0) {
    return (
      <div className="bp-menu bp-container">
        <LibraryHero
          songCount={0}
          chartCount={0}
          onImport={onOpenImportModal}
        />
        <div className="bp-no-results">
          <AudioLines size={32} />
          <h2>Awali dengan musik favoritmu</h2>
          <p>
            Impor file audio atau tautan YouTube melalui tombol Impor musik
            untuk membuat chart dan mulai bermain.
          </p>
        </div>
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
