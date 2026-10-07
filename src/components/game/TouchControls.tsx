import React from 'react';
import { GameSettings } from '../../types';

interface TouchControlsProps {
  settings: GameSettings;
  activeLanes: boolean[];
  onLanePress: (lane: number) => void;
  onLaneRelease: (lane: number) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  settings,
  activeLanes,
  onLanePress,
  onLaneRelease,
}) => {
  const laneColors = ['#38bdf8', '#818cf8', '#a855f7', '#ec4899'];
  const keyBindings = settings?.keyBindings || { lane0: 'KeyD', lane1: 'KeyF', lane2: 'KeyJ', lane3: 'KeyK' };
  const laneLabels = [
    (keyBindings.lane0 || 'KeyD').replace('Key', ''),
    (keyBindings.lane1 || 'KeyF').replace('Key', ''),
    (keyBindings.lane2 || 'KeyJ').replace('Key', ''),
    (keyBindings.lane3 || 'KeyK').replace('Key', ''),
  ];

  if (settings?.touchControlMode === 'direct') {
    return null; // Direct screen tapping handles touches over canvas
  }

  return (
    <div className="w-full grid grid-cols-4 gap-2 pt-2 pb-1 px-1">
      {[0, 1, 2, 3].map((lane) => (
        <button
          key={lane}
          onTouchStart={(e) => {
            e.preventDefault();
            onLanePress(lane);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onLaneRelease(lane);
          }}
          onMouseDown={() => onLanePress(lane)}
          onMouseUp={() => onLaneRelease(lane)}
          onMouseLeave={() => onLaneRelease(lane)}
          className={`h-16 sm:h-20 rounded-2xl font-mono font-black text-lg sm:text-xl flex flex-col items-center justify-center transition-all select-none touch-none active:scale-95 ${
            activeLanes[lane]
              ? 'bg-gradient-to-t from-cyan-500/40 to-indigo-600/40 border-2 border-cyan-400 text-white shadow-lg shadow-cyan-500/30'
              : 'bg-slate-900/90 border border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
          style={{
            borderColor: activeLanes[lane] ? laneColors[lane] : undefined,
          }}
        >
          <span>L{lane + 1}</span>
          <span className="text-[10px] text-slate-400 font-normal">{laneLabels[lane]}</span>
        </button>
      ))}
    </div>
  );
};
