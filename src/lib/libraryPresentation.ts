import { Song } from "../types";

export type LibraryFilter = "all" | "preset" | "local" | "youtube";
export type LibrarySort = "default" | "title" | "newest" | "bpm";

export function getSongSourceKey(song: Song): Exclude<LibraryFilter, "all"> {
  return song.isPreset ? "preset" : song.youtubeVideoId ? "youtube" : "local";
}

export function getVisibleSongs(
  songs: Song[],
  query: string,
  filter: LibraryFilter,
  sort: LibrarySort,
): Song[] {
  const term = query.trim().toLocaleLowerCase();
  return songs
    .filter(
      (song) =>
        (filter === "all" || getSongSourceKey(song) === filter) &&
        (!term ||
          `${song.title}\n${song.artist}`.toLocaleLowerCase().includes(term)),
    )
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "newest")
        return (
          (b.createdAt || 0) - (a.createdAt || 0) ||
          a.title.localeCompare(b.title)
        );
      if (sort === "bpm")
        return a.bpm - b.bpm || a.title.localeCompare(b.title);
      return Number(!!a.isPreset) - Number(!!b.isPreset);
    });
}

export function isOriginalAudioBuffer(buffer?: AudioBuffer): boolean {
  const flags = buffer as
    | (AudioBuffer & {
        _isFallbackSynth?: boolean;
        _isEmergencySynth?: boolean;
      })
    | undefined;
  return !!flags && !flags._isFallbackSynth && !flags._isEmergencySynth;
}
