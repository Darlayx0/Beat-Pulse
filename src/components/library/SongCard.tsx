import {
  ArrowUpRight,
  Clock3,
  Gauge,
  Loader2,
  Pause,
  Play,
  Trophy,
} from "lucide-react";
import { HighScore, Song } from "../../types";
import { formatDuration, SongArtwork, songSource } from "./SongArtwork";

interface SongCardProps {
  song: Song;
  scores?: Record<string, HighScore>;
  playing: boolean;
  loading: boolean;
  onOpen: () => void;
  onPreview: () => void;
}

export function SongCard({
  song,
  scores,
  playing,
  loading,
  onOpen,
  onPreview,
}: SongCardProps) {
  const difficulties = Object.keys(song.charts);
  const best = Object.values(scores || {}).reduce<HighScore | undefined>(
    (current, score) =>
      !current || score.score > current.score ? score : current,
    undefined,
  );
  return (
    <article
      className={`bp-song-card ${playing ? "bp-song-card--playing" : ""}`}
    >
      <div className="bp-song-card__cover">
        <button
          type="button"
          className="bp-song-card__art-button"
          onClick={onOpen}
          aria-label={`Pilih lagu ${song.title}`}
        >
          <SongArtwork song={song} />
        </button>
        <span className="bp-source">{songSource(song)}</span>
        <button
          type="button"
          className="bp-preview-button"
          aria-label={`${playing ? "Hentikan" : "Putar"} preview ${song.title}`}
          aria-pressed={playing}
          onClick={onPreview}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={19} className="bp-spin" />
          ) : playing ? (
            <Pause size={19} fill="currentColor" />
          ) : (
            <Play size={19} fill="currentColor" />
          )}
        </button>
      </div>
      <div className="bp-song-card__body">
        <div className="bp-song-card__identity">
          <h3>
            <button type="button" onClick={onOpen} title={song.title}>
              {song.title}
            </button>
          </h3>
          <p title={song.artist}>{song.artist || "Artis tidak diketahui"}</p>
        </div>
        <div className="bp-song-card__metadata">
          <span>
            <Gauge size={14} /> {song.bpm} BPM
          </span>
          <span>
            <Clock3 size={14} /> {formatDuration(song.duration)}
          </span>
          <span>{difficulties.length} difficulty</span>
        </div>
        <div className="bp-song-card__footer">
          <span className={best ? "bp-record-label" : "bp-muted"}>
            {best ? (
              <>
                <Trophy size={14} /> Rekor {best.grade}
              </>
            ) : (
              "Siap menemukan ritmemu"
            )}
          </span>
          <button
            type="button"
            className="bp-card-action"
            onClick={onOpen}
            aria-label={`Buka detail ${song.title}`}
          >
            Pilih lagu <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
