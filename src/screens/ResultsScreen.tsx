import React from 'react';
import { Song, Chart, GameStats } from '../types';
import { GameResults } from '../components/GameResults';

interface ResultsScreenProps {
  song: Song;
  chart: Chart;
  stats: GameStats;
  onRetry: () => void;
  onBackToLibrary: () => void;
  onEditChart: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  song,
  chart,
  stats,
  onRetry,
  onBackToLibrary,
  onEditChart,
}) => {
  return (
    <GameResults
      song={song}
      chart={chart}
      stats={stats}
      onRetry={onRetry}
      onBackToLibrary={onBackToLibrary}
      onEditChart={onEditChart}
    />
  );
};
