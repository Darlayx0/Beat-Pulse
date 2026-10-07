import assert from "node:assert/strict";
import test from "node:test";
import {
  getVisibleSongs,
  getSongSourceKey,
  isOriginalAudioBuffer,
} from "../src/lib/libraryPresentation";
import type { Song } from "../src/types";

const song = (id: string, fields: Partial<Song> = {}): Song => ({
  id,
  title: id,
  artist: "Artis",
  bpm: 120,
  duration: 30,
  charts: {},
  ...fields,
});

test("search and source filters combine without modifying library order", () => {
  const songs = [
    song("preset", { isPreset: true, title: "Neon", youtubeVideoId: "abc" }),
    song("local", { title: "Neon Remix", artist: "BEAT artist" }),
    song("youtube", { title: "Neon Live", youtubeVideoId: "def" }),
  ];
  assert.equal(getSongSourceKey(songs[0]), "preset");
  assert.deepEqual(
    getVisibleSongs(songs, " neon ", "local", "default").map((item) => item.id),
    ["local"],
  );
  assert.deepEqual(
    getVisibleSongs(songs, "beat ARTIST", "all", "default").map(
      (item) => item.id,
    ),
    ["local"],
  );
  assert.deepEqual(
    getVisibleSongs(songs, "", "all", "default").map((item) => item.id),
    ["local", "youtube", "preset"],
  );
  assert.deepEqual(
    songs.map((item) => item.id),
    ["preset", "local", "youtube"],
  );
  assert.equal(getVisibleSongs(songs, "absent", "all", "default").length, 0);
});

test("sorts tolerate legacy tracks without timestamps and use stable title fallback", () => {
  const songs = [
    song("Zebra", { bpm: 160 }),
    song("Bravo", { createdAt: 50, bpm: 90 }),
    song("Alpha", { createdAt: 50, bpm: 90 }),
  ];
  assert.deepEqual(
    getVisibleSongs(songs, "", "all", "newest").map((item) => item.id),
    ["Alpha", "Bravo", "Zebra"],
  );
  assert.deepEqual(
    getVisibleSongs(songs, "", "all", "bpm").map((item) => item.id),
    ["Alpha", "Bravo", "Zebra"],
  );
  assert.deepEqual(
    getVisibleSongs(songs, "", "all", "title").map((item) => item.id),
    ["Alpha", "Bravo", "Zebra"],
  );
});

test("emergency and fallback synth buffers do not claim original audio is available", () => {
  assert.equal(isOriginalAudioBuffer(undefined), false);
  assert.equal(
    isOriginalAudioBuffer({ _isFallbackSynth: true } as unknown as AudioBuffer),
    false,
  );
  assert.equal(
    isOriginalAudioBuffer({
      _isEmergencySynth: true,
    } as unknown as AudioBuffer),
    false,
  );
  assert.equal(isOriginalAudioBuffer({ duration: 30 } as AudioBuffer), true);
});
