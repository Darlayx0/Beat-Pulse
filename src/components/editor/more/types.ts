import { Song, DifficultyLevel, Note } from '../../../types';

export type MoreSubPageId =
  | 'audio_track'
  | 'difficulty_json'
  | 'bpm_offset_bounds'
  | 'bulk_shift_align'
  | 'sound_effects'
  | 'save_method'
  | 'auto_generator'
  | 'clear_notes';

export interface EditorMoreHubProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  selectedSongId: string;
  selectedDifficulty: DifficultyLevel;
  bpm: number;
  offset: number;
  duration: number;
  currentTime: number;
  notes: Note[];
  isLocked: boolean;
  isPreset: boolean;
  audioBuffer: AudioBuffer | null;
  enableHitsounds: boolean;
  enableMetronome: boolean;
  saveMode: 'auto' | 'manual';
  onSelectSong: (songId: string) => void;
  onSelectDifficulty: (diff: DifficultyLevel) => void;
  onUpdateBpm: (bpm: number) => void;
  onUpdateOffset: (offset: number) => void;
  onUpdateDuration: (duration: number) => void;
  onUpdateNotes: (notes: Note[]) => void;
  onToggleHitsounds: () => void;
  onToggleMetronome: () => void;
  onChangeSaveMode: (mode: 'auto' | 'manual') => void;
  onExportJSON: () => void;
  onTriggerImportJSON: () => void;
  onImportChartJson?: (songId: string, jsonString: string) => Promise<void>;
  onRelinkSongAudio?: (songId: string, audioFile: File) => Promise<void>;
  onAddDifficulty?: (songId: string, diffName: string) => void;
  onRenameDifficulty?: (songId: string, oldDiff: string, newDiff: string) => void;
  onDeleteDifficulty?: (songId: string, diffName: string) => void;
  onReorderDifficulties?: (songId: string, newOrder: string[]) => void;
  onDuplicateDifficulty?: (songId: string, sourceDiffName: string, newDiffName: string) => void;
}
