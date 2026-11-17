'use client';

import React from 'react';
import { ChevronFirst, ChevronLeft, ChevronRight, ChevronLast } from 'lucide-react';

interface MoveNavigatorProps {
  currentIndex: number;
  totalPositions: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
}

export const MoveNavigator: React.FC<MoveNavigatorProps> = ({
  currentIndex,
  totalPositions,
  onFirst,
  onPrev,
  onNext,
  onLast,
}) => {
  const isAtFirst = currentIndex === 0;
  const isAtLast = currentIndex === totalPositions - 1;

  return (
    <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs">
      <div className="flex items-center gap-1">
        <button
          onClick={onFirst}
          disabled={isAtFirst}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="First Move"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>
        <button
          onClick={onPrev}
          disabled={isAtFirst}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Previous Move"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          disabled={isAtLast}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Next Move"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onLast}
          disabled={isAtLast}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Current Position"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>

      <span className="text-[11px] font-mono text-zinc-400 px-2 font-medium">
        {currentIndex === 0 ? 'Start' : `Move ${currentIndex} / ${totalPositions - 1}`}
      </span>
    </div>
  );
};

