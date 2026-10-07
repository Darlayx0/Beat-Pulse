import React from 'react';
import { Song, Chart, DifficultyLevel } from '../types';
import { ChartEditor } from '../components/ChartEditor';

interface EditorScreenProps {
  songs: Song[];
  activeSongId?: string;
  activeDifficulty?: DifficultyLevel;
  audioBuffers: Record<string, AudioBuffer>;
  onTestPlay: (song: Song, chart: Chart, startFromTime?: number) => void;
  onSaveChart: (songId: string, difficulty: DifficultyLevel, updatedChart: Chart) => void;
  onBackToLibrary?: () => void;
  onAddDifficulty?: (songId: string, diffName: string) => void;
  onRenameDifficulty?: (songId: string, oldDiff: string, newDiff: string) => void;
  onDeleteDifficulty?: (songId: string, diffName: string) => void;
  onReorderDifficulties?: (songId: string, newOrder: string[]) => void;
  onDuplicateDifficulty?: (songId: string, sourceDiffName: string, newDiffName: string) => void;
  onDuplicateSong?: (songId: string) => void;
  onRelinkSongAudio?: (songId: string, audioFile: File) => Promise<void>;
  onImportChartJson?: (songId: string, jsonString: string) => Promise<void>;
}

export const EditorScreen: React.FC<EditorScreenProps> = ({
  songs,
  activeSongId,
  activeDifficulty,
  audioBuffers,
  onTestPlay,
  onSaveChart,
  onBackToLibrary,
  onAddDifficulty,
  onRenameDifficulty,
  onDeleteDifficulty,
  onReorderDifficulties,
  onDuplicateDifficulty,
  onDuplicateSong,
  onRelinkSongAudio,
  onImportChartJson,
}) => {
  return (
    <ChartEditor
      songs={songs}
      activeSongId={activeSongId}
      activeDifficulty={activeDifficulty}
      audioBuffers={audioBuffers}
      onTestPlay={onTestPlay}
      onSaveChart={onSaveChart}
      onBackToLibrary={onBackToLibrary}
      onAddDifficulty={onAddDifficulty}
      onRenameDifficulty={onRenameDifficulty}
      onDeleteDifficulty={onDeleteDifficulty}
      onReorderDifficulties={onReorderDifficulties}
      onDuplicateDifficulty={onDuplicateDifficulty}
      onDuplicateSong={onDuplicateSong}
      onRelinkSongAudio={onRelinkSongAudio}
      onImportChartJson={onImportChartJson}
    />
  );
};
