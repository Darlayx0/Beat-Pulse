import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  Clock3,
  Edit3,
  Gauge,
  Headphones,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Trophy,
  Upload,
  Youtube,
} from "lucide-react";
import { HighScore, Song } from "../../types";
import { formatDuration, SongArtwork, songSource } from "./SongArtwork";

export type AudioAvailability = "checking" | "ready" | "missing";
interface SongDetailProps {
  song: Song;
  difficulty: string;
  onDifficultyChange: (difficulty: string) => void;
  score?: HighScore;
  playing: boolean;
  previewLoading: boolean;
  launching: boolean;
  audioAvailability: AudioAvailability;
  onBack: () => void;
  onPreview: () => void;
  onPlay: () => void;
  onEdit: () => void;
  onManage: () => void;
  onRelink?: () => void;
}

export function SongDetail({
  song,
  difficulty,
  onDifficultyChange,
  score,
  playing,
  previewLoading,
  launching,
  audioAvailability,
  onBack,
  onPreview,
  onPlay,
  onEdit,
  onManage,
  onRelink,
}: SongDetailProps) {
  const difficulties = Object.keys(song.charts);
  const chart = song.charts[difficulty];
  const hasNotes = !!chart?.notes.length;
  const canPlay = hasNotes && audioAvailability === "ready" && !launching;
  return (
    <div className="bp-detail bp-enter">
      <div className="bp-detail__navigation">
        <button type="button" className="bp-back-button" onClick={onBack}>
          <ArrowLeft size={18} /> Kembali ke pustaka
        </button>
        <button
          type="button"
          id="library-manage-button"
          className="bp-button bp-button--secondary"
          onClick={onManage}
          aria-haspopup="dialog"
        >
          <MoreHorizontal size={20} />
          <span>Kelola lagu</span>
        </button>
      </div>
      <div className="bp-detail__grid">
        <section
          className="bp-detail__song"
          aria-labelledby="song-detail-title"
        >
          <SongArtwork song={song} />
          <div className="bp-detail__identity">
            <span className="bp-eyebrow">
              {songSource(song)} / PUSTAKA MUSIK
            </span>
            <h1 id="song-detail-title" tabIndex={-1}>
              {song.title}
            </h1>
            <p>{song.artist || "Artis tidak diketahui"}</p>
            <div className="bp-detail__metadata">
              <span>
                <Gauge size={16} /> {song.bpm} BPM
              </span>
              <span>
                <Clock3 size={16} /> {formatDuration(song.duration)}
              </span>
              <span>
                <AudioLines size={16} /> {difficulties.length} difficulty
              </span>
            </div>
          </div>
          <div className="bp-audio-preview">
            <span className="bp-audio-preview__icon">
              <Headphones size={21} />
            </span>
            <div>
              <h2>{playing ? "Preview sedang diputar" : "Dengarkan dulu"}</h2>
              <p>Cuplikan audio hingga 30 detik.</p>
            </div>
            <button
              type="button"
              className="bp-icon-button"
              onClick={onPreview}
              disabled={previewLoading || audioAvailability !== "ready"}
              aria-label={playing ? "Hentikan preview" : "Putar preview"}
              aria-pressed={playing}
            >
              {previewLoading ? (
                <Loader2 size={20} className="bp-spin" />
              ) : playing ? (
                <Pause size={20} />
              ) : (
                <Play size={20} />
              )}
            </button>
          </div>
          {song.youtubeVideoId && (
            <a
              className="bp-text-link"
              href={`https://www.youtube.com/watch?v=${song.youtubeVideoId}`}
              target="_blank"
              rel="noreferrer"
            >
              <Youtube size={17} /> Buka video di YouTube{" "}
              <ArrowRight size={15} />
            </a>
          )}
        </section>
        <section className="bp-play-panel" aria-labelledby="difficulty-title">
          <span className="bp-eyebrow">SIAP BERMAIN</span>
          <h2 id="difficulty-title">Pilih tantanganmu.</h2>
          <p className="bp-play-panel__intro">
            Tentukan difficulty, lalu ikuti ketukannya.
          </p>
          <div
            className="bp-difficulties"
            role="group"
            aria-label="Tingkat kesulitan"
          >
            {difficulties.map((name, index) => (
              <button
                type="button"
                key={name}
                className={`bp-difficulty ${difficulty === name ? "bp-difficulty--active" : ""}`}
                onClick={() => onDifficultyChange(name)}
                aria-pressed={difficulty === name}
              >
                <span className="bp-difficulty__index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="bp-difficulty__label">
                  <strong>{name}</strong>
                  <span>
                    {song.charts[name].notes.length.toLocaleString()} note
                  </span>
                </span>
                {difficulty === name && <Check size={18} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {chart && (
            <div className="bp-chart-meta">
              <span>
                Tempo chart <strong>{chart.bpm} BPM</strong>
              </span>
              <span>
                Jumlah note{" "}
                <strong>{chart.notes.length.toLocaleString()}</strong>
              </span>
            </div>
          )}
          {audioAvailability === "checking" && (
            <p className="bp-feedback" role="status">
              <Loader2 size={17} className="bp-spin" /> Memeriksa audio lagu…
            </p>
          )}
          {audioAvailability === "missing" && (
            <div className="bp-feedback bp-feedback--warning">
              <p>
                Audio asli belum tersedia di perangkat ini. Hubungkan file audio
                untuk memainkan chart yang sudah tersimpan.
              </p>
              {onRelink && (
                <button
                  type="button"
                  className="bp-button bp-button--secondary"
                  onClick={onRelink}
                >
                  <Upload size={17} /> Hubungkan audio
                </button>
              )}
            </div>
          )}
          {audioAvailability === "ready" && !hasNotes && (
            <p className="bp-feedback">
              {difficulties.length
                ? "Chart ini belum memiliki note. Buka editor untuk menambahkan ketukan."
                : "Belum ada difficulty. Tambahkan melalui Kelola lagu."}
            </p>
          )}
          <div className="bp-play-panel__actions">
            <button
              type="button"
              className="bp-button bp-button--primary bp-play-button"
              disabled={!canPlay}
              onClick={onPlay}
            >
              {launching ? (
                <Loader2 size={20} className="bp-spin" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
              <span>{launching ? "Menyiapkan lagu…" : "Mulai main"}</span>
              <ArrowRight size={19} />
            </button>
            <button
              type="button"
              className="bp-button bp-button--secondary"
              disabled={!chart || launching}
              onClick={onEdit}
            >
              <Edit3 size={17} /> {song.isPreset ? "Lihat chart" : "Edit chart"}
            </button>
          </div>
          <p className="bp-control-hint">
            Keyboard atau layar sentuh. Mainkan dengan caramu.
          </p>
          <div className="bp-high-score">
            <span className="bp-high-score__icon">
              <Trophy size={22} />
            </span>
            <div>
              <p>Rekor terbaik{difficulty ? ` · ${difficulty}` : ""}</p>
              <strong>
                {score ? score.score.toLocaleString() : "Catat rekor pertamamu"}
              </strong>
              {score && <span>{score.accuracy.toFixed(1)}% akurasi</span>}
            </div>
            {score && <span className="bp-grade">{score.grade}</span>}
          </div>
        </section>
      </div>
    </div>
  );
}
