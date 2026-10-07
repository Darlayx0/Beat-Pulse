import type { Song } from '../types';
import { normalizeTrackSnapshot } from './trackSnapshot';

export type CloudSong = Song & { deleted?: boolean };

export function cloudSongData(song: Song): Song {
  const { audioBlob, audioUrl, ...metadata } = (song as CloudSong).deleted ? song : normalizeTrackSnapshot(song);
  return JSON.parse(JSON.stringify({
    ...metadata,
    ...(audioUrl && !/^(blob:|data:)/i.test(audioUrl) ? { audioUrl } : {}),
  }));
}

export function visibleToAccount(song: Song, uid?: string): boolean {
  return !song.userId || song.userId === uid;
}

export function remoteWins(local: Song | undefined, remote: CloudSong): boolean {
  return !local || (remote.updatedAt || 0) > (local.updatedAt || 0)
    || (!!remote.deleted && (remote.updatedAt || 0) === (local.updatedAt || 0));
}

export function shouldRestoreDraft(draftTimestamp: number, song: Song, chartCreatedAt: number): boolean {
  return draftTimestamp > (song.updatedAt || chartCreatedAt || 0);
}

export function planCloudReconciliation(local: Song[], remote: CloudSong[], uid: string) {
  const map = new Map(local.filter(song => visibleToAccount(song, uid)).map(song => [song.id, song]));
  const remoteIds = new Set(remote.filter(song => song.userId === uid).map(song => song.id));
  const save: Song[] = [];
  const remove: string[] = [];
  const upload: Song[] = [];
  for (const cloud of remote) {
    if (cloud.userId !== uid || !cloud.id) continue;
    const existing = map.get(cloud.id);
    if (remoteWins(existing, cloud)) {
      if (cloud.deleted) {
        map.delete(cloud.id);
        if (existing) remove.push(cloud.id);
      } else {
        const merged = { ...cloud, audioUrl: cloud.audioUrl || existing?.audioUrl };
        map.set(cloud.id, merged);
        save.push(merged);
      }
    } else if (existing && (existing.updatedAt || 0) > (cloud.updatedAt || 0)) {
      upload.push({ ...existing, userId: uid });
    }
  }
  for (const song of map.values()) {
    if (!song.userId || !remoteIds.has(song.id)) {
      const owned = { ...song, userId: uid };
      map.set(song.id, owned);
      save.push(owned);
      if (!remoteIds.has(song.id)) upload.push(owned);
    }
  }
  return { songs: [...map.values()], save, remove, upload };
}
