import { useState } from "react";
import { Disc3 } from "lucide-react";
import { Song } from "../../types";

const palettes = ["violet", "mint", "rose", "blue"] as const;

export function SongArtwork({
  song,
  compact = false,
}: {
  song: Song;
  compact?: boolean;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const hash = Array.from(song.id).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const palette = song.id.includes("serene")
    ? "mint"
    : song.id.includes("cyber")
      ? "rose"
      : song.id.includes("neon")
        ? "violet"
        : palettes[hash % palettes.length];
  return (
    <div
      className={`bp-artwork bp-artwork--${palette} ${compact ? "bp-artwork--compact" : ""}`}
      aria-hidden="true"
    >
      <div className="bp-artwork__orbit" />
      <div className="bp-artwork__record">
        <Disc3 strokeWidth={1} />
      </div>
      {song.youtubeVideoId && failedImage !== song.youtubeVideoId && (
        <img
          src={`https://img.youtube.com/vi/${song.youtubeVideoId}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedImage(song.youtubeVideoId!)}
        />
      )}
      <div className="bp-artwork__wave">
        {[12, 20, 32, 18, 42, 56, 32, 46, 24, 38, 18, 28, 44, 22, 12].map(
          (height, index) => (
            <span key={index} style={{ height: `${height}%` }} />
          ),
        )}
      </div>
      <span className="bp-artwork__caption">BEAT / PULSE</span>
    </div>
  );
}

export function formatDuration(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
export function songSource(song: Song) {
  return song.isPreset ? "Preset" : song.youtubeVideoId ? "YouTube" : "Lokal";
}
