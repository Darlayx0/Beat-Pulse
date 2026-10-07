import React, { useEffect, useRef, useState } from "react";
import { AudioLines, SearchX, X } from "lucide-react";
import { Song, DifficultyLevel, HighScore } from "../types";
import { audioEngine } from "../lib/audioEngine";
import { StorageService } from "../services/storageService";
import { AudioService } from "../services/audioService";
import { exportChartAsJson } from "../lib/chartSanitizer";
import {
  getSongSourceKey,
  getVisibleSongs,
  isOriginalAudioBuffer,
} from "../lib/libraryPresentation";
import { LibraryHero } from "./library/LibraryHero";
import {
  LibraryToolbar,
  SongSort,
  SourceFilter,
} from "./library/LibraryToolbar";
import { SongCard } from "./library/SongCard";
import { AudioAvailability, SongDetail } from "./library/SongDetail";
import {
  LibraryDialog,
  LibraryDialogs,
  ManagementActions,
} from "./library/LibraryDialogs";

interface SongLibraryProps {
  songs: Song[];
  audioBuffers?: Record<string, AudioBuffer>;
  highScores: Record<string, Record<string, HighScore>>;
  onSelectSongToPlay: (song: Song, difficulty: DifficultyLevel) => void;
  onSelectSongToEdit: (song: Song, difficulty: DifficultyLevel) => void;
  onDeleteSong: (songId: string) => void;
  onOpenImportModal: () => void;
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

export const SongLibrary: React.FC<SongLibraryProps> = (props) => {
  const { songs, audioBuffers, highScores, onOpenImportModal } = props;
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [sort, setSort] = useState<SongSort>("default");
  const [dialog, setDialog] = useState<LibraryDialog | null>(null);
  const [dialogDifficulty, setDialogDifficulty] = useState("");
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [launching, setLaunching] = useState(false);
  const [audioAvailability, setAudioAvailability] =
    useState<AudioAvailability>("checking");
  const requestId = useRef(0);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listPosition = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const chartInput = useRef<HTMLInputElement>(null);
  const fileTarget = useRef<string | null>(null);
  const currentSong = songs.find((song) => song.id === selectedSongId);
  const difficulties = Object.keys(currentSong?.charts || {});
  const difficulty = difficulties.includes(selectedDifficulty)
    ? selectedDifficulty
    : difficulties[0] || "";
  // Keep confirmation targets stable if synchronization removes the selected chart.
  const managedDifficulty = dialog ? dialogDifficulty : difficulty;
  const visibleSongs = getVisibleSongs(songs, searchQuery, filter, sort);
  const counts = songs.reduce<Record<SourceFilter, number>>(
    (result, song) => {
      result.all++;
      result[getSongSourceKey(song)]++;
      return result;
    },
    { all: 0, preset: 0, local: 0, youtube: 0 },
  );

  const stopPreview = () => {
    requestId.current++;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
    audioEngine.stopBGM();
    setPreviewSongId(null);
    setPreviewLoadingId(null);
  };

  useEffect(
    () => () => {
      requestId.current++;
      if (previewTimer.current) clearTimeout(previewTimer.current);
      audioEngine.stopBGM();
    },
    [],
  );

  useEffect(() => {
    if (!previewSongId) return;
    const interval = setInterval(() => {
      if (!audioEngine.getIsPlaying()) stopPreview();
    }, 400);
    return () => clearInterval(interval);
  }, [previewSongId]);

  // A missing in-memory buffer is not proof that audio is missing from IndexedDB.
  useEffect(() => {
    let cancelled = false;
    if (!currentSong) return;
    if (
      currentSong.isPreset ||
      currentSong.youtubeVideoId ||
      isOriginalAudioBuffer(audioBuffers?.[currentSong.id]) ||
      currentSong.audioBlob?.size
    ) {
      setAudioAvailability("ready");
    } else {
      setAudioAvailability("checking");
      StorageService.getAudioBlob(currentSong.id)
        .then((blob) => {
          if (!cancelled)
            setAudioAvailability(blob?.size ? "ready" : "missing");
        })
        .catch(() => {
          if (!cancelled) setAudioAvailability("missing");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [currentSong, audioBuffers]);

  const backToList = () => {
    stopPreview();
    setDialog(null);
    setSelectedSongId(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: listPosition.current, behavior: "instant" });
      if (returnFocus.current?.isConnected)
        returnFocus.current.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (selectedSongId && !currentSong) backToList();
  }, [selectedSongId, currentSong]);

  const openSong = (song: Song) => {
    listPosition.current = window.scrollY;
    returnFocus.current = document.activeElement as HTMLElement;
    stopPreview();
    setMessage("");
    setAudioAvailability(
      song.isPreset || song.youtubeVideoId ? "ready" : "checking",
    );
    setSelectedSongId(song.id);
    setSelectedDifficulty(Object.keys(song.charts)[0] || "");
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      document
        .getElementById("song-detail-title")
        ?.focus({ preventScroll: true });
    });
  };

  const togglePreview = async (song: Song) => {
    if (previewSongId === song.id || previewLoadingId === song.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const sequence = requestId.current;
    setPreviewLoadingId(song.id);
    setMessage("");
    try {
      AudioService.getContext(); // Resume in the originating user gesture.
      let buffer = audioBuffers?.[song.id];
      if (song.isPreset && !buffer) {
        const style = song.id.includes("serene")
          ? "calm"
          : song.id.includes("cyber")
            ? "cyber"
            : "synthwave";
        buffer = AudioService.createSynthAudio(
          song.bpm || 120,
          Math.min(song.duration || 30, 30),
          style,
        );
      } else if (!song.youtubeVideoId && !isOriginalAudioBuffer(buffer)) {
        const blob =
          song.audioBlob || (await StorageService.getAudioBlob(song.id));
        if (sequence !== requestId.current) return;
        if (!blob?.size)
          throw new Error(
            "Audio lagu belum tersedia. Buka detail lagu untuk menghubungkan file audio.",
          );
        buffer = await AudioService.decodeAudioBlob(blob);
      }
      if (sequence !== requestId.current) return;
      if (song.youtubeVideoId) {
        if (buffer) audioEngine.setFallbackBuffer(buffer);
        await audioEngine.loadYouTubeTrack(song.youtubeVideoId);
      } else if (buffer) audioEngine.loadBuffer(buffer);
      if (sequence !== requestId.current) return;
      audioEngine.playBGM(0);
      setPreviewSongId(song.id);
      previewTimer.current = setTimeout(stopPreview, 30000);
    } catch (error) {
      if (sequence === requestId.current) {
        stopPreview();
        setMessage(
          error instanceof Error
            ? error.message
            : "Preview tidak dapat diputar. Coba lagi.",
        );
      }
    } finally {
      if (sequence === requestId.current) setPreviewLoadingId(null);
    }
  };

  const launch = async (editor: boolean) => {
    if (!currentSong || !currentSong.charts[difficulty] || launching) return;
    stopPreview();
    setLaunching(true);
    try {
      await (editor ? props.onSelectSongToEdit : props.onSelectSongToPlay)(
        currentSong,
        difficulty,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Lagu belum dapat dibuka. Coba lagi.",
      );
    } finally {
      setLaunching(false);
    }
  };
  const chooseAudio = () => {
    fileTarget.current = currentSong?.id || null;
    audioInput.current?.click();
  };
  const chooseChart = () => {
    fileTarget.current = currentSong?.id || null;
    chartInput.current?.click();
  };
  const actions: ManagementActions | null = currentSong
    ? {
        add:
          !currentSong.isPreset && props.onAddDifficulty
            ? (name) => {
                props.onAddDifficulty!(currentSong.id, name);
                setSelectedDifficulty(name);
              }
            : undefined,
        rename:
          !currentSong.isPreset && props.onRenameDifficulty
            ? (name) => {
                props.onRenameDifficulty!(
                  currentSong.id,
                  managedDifficulty,
                  name,
                );
                setSelectedDifficulty(name);
              }
            : undefined,
        duplicateDifficulty:
          !currentSong.isPreset && props.onDuplicateDifficulty
            ? (name) => {
                props.onDuplicateDifficulty!(
                  currentSong.id,
                  managedDifficulty,
                  name,
                );
                setSelectedDifficulty(name);
              }
            : undefined,
        reorder:
          !currentSong.isPreset && props.onReorderDifficulties
            ? (order) => props.onReorderDifficulties!(currentSong.id, order)
            : undefined,
        deleteDifficulty:
          !currentSong.isPreset && props.onDeleteDifficulty
            ? () => {
                if (currentSong.charts[managedDifficulty])
                  props.onDeleteDifficulty!(currentSong.id, managedDifficulty);
              }
            : undefined,
        duplicateSong: props.onDuplicateSong
          ? () => props.onDuplicateSong!(currentSong.id)
          : undefined,
        deleteSong: () => {
          props.onDeleteSong(currentSong.id);
          backToList();
        },
        relink:
          props.onRelinkAudio &&
          !currentSong.isPreset &&
          !currentSong.youtubeVideoId
            ? chooseAudio
            : undefined,
        importChart:
          !currentSong.isPreset && props.onImportChartJson
            ? chooseChart
            : undefined,
        exportChart: () => {
          if (currentSong.charts[managedDifficulty])
            exportChartAsJson(
              currentSong.charts[managedDifficulty],
              currentSong.title,
            );
        },
      }
    : null;

  return (
    <div className="bp-menu bp-container">
      {message && (
        <div className="bp-menu-message" role="alert">
          <span>{message}</span>
          <button
            type="button"
            className="bp-icon-button"
            aria-label="Tutup pesan"
            onClick={() => setMessage("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {currentSong ? (
        <SongDetail
          song={currentSong}
          difficulty={difficulty}
          onDifficultyChange={setSelectedDifficulty}
          score={highScores[currentSong.id]?.[difficulty]}
          playing={previewSongId === currentSong.id}
          previewLoading={previewLoadingId === currentSong.id}
          launching={launching}
          audioAvailability={audioAvailability}
          onBack={backToList}
          onPreview={() => void togglePreview(currentSong)}
          onPlay={() => void launch(false)}
          onEdit={() => void launch(true)}
          onManage={() => {
            setDialogDifficulty(difficulty);
            setDialog("manage");
          }}
          onRelink={actions?.relink}
        />
      ) : (
        <div className="bp-enter">
          <LibraryHero
            songCount={songs.length}
            chartCount={songs.reduce(
              (sum, song) => sum + Object.keys(song.charts).length,
              0,
            )}
            onImport={onOpenImportModal}
          />
          <section className="bp-collection" aria-labelledby="collection-title">
            <div className="bp-section-heading">
              <div>
                <h2 id="collection-title">
                  Koleksi lagu <span>{songs.length}</span>
                </h2>
                <p>Satu lagu. Banyak cara untuk menantang diri.</p>
              </div>
              <span
                className="bp-result-count"
                role="status"
                aria-live="polite"
              >
                {visibleSongs.length} lagu
                {searchQuery || filter !== "all" ? " ditemukan" : " tersedia"}
              </span>
            </div>
            <LibraryToolbar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              filter={filter}
              onFilterChange={setFilter}
              sort={sort}
              onSortChange={setSort}
              counts={counts}
            />
            {visibleSongs.length ? (
              <div className="bp-song-grid">
                {visibleSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    scores={highScores[song.id]}
                    playing={previewSongId === song.id}
                    loading={previewLoadingId === song.id}
                    onOpen={() => openSong(song)}
                    onPreview={() => void togglePreview(song)}
                  />
                ))}
              </div>
            ) : (
              <div className="bp-no-results">
                <SearchX size={32} aria-hidden="true" />
                <h3>Belum menemukan lagunya?</h3>
                <p>Coba kata kunci lain atau tampilkan semua sumber musik.</p>
                <button
                  type="button"
                  className="bp-button bp-button--secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setFilter("all");
                  }}
                >
                  Reset pencarian & filter
                </button>
              </div>
            )}
          </section>
          <footer className="bp-menu-footer">
            <span>
              <AudioLines size={16} /> BeatPulse Rhythm Studio
            </span>
            <span>Mainkan. Ciptakan. Ulangi.</span>
          </footer>
        </div>
      )}
      {dialog && currentSong && actions && (
        <LibraryDialogs
          key={dialog}
          mode={dialog}
          song={currentSong}
          difficulty={managedDifficulty}
          actions={actions}
          onModeChange={setDialog}
          onClose={() => setDialog(null)}
        />
      )}
      <input
        type="file"
        ref={audioInput}
        accept="audio/*"
        className="hidden"
        aria-label="File audio pengganti"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          const songId = fileTarget.current;
          event.target.value = "";
          if (!file || !songId || !props.onRelinkAudio) return;
          try {
            await props.onRelinkAudio(songId, file);
            if (selectedSongId === songId) {
              const blob = await StorageService.getAudioBlob(songId);
              setAudioAvailability(blob?.size ? "ready" : "missing");
            }
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Audio belum dapat dihubungkan.",
            );
          }
        }}
      />
      <input
        type="file"
        ref={chartInput}
        accept=".json,application/json"
        className="hidden"
        aria-label="File chart JSON"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          const songId = fileTarget.current;
          event.target.value = "";
          if (!file || !songId || !props.onImportChartJson) return;
          try {
            const contents = await file.text();
            await props.onImportChartJson(songId, contents);
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Chart belum dapat diimpor.",
            );
          }
        }}
      />
    </div>
  );
};
