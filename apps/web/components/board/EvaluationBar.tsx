'use client';

import React from 'react';

interface EvaluationBarProps {
  score: number;
  text: string;
  isCheckmate?: boolean;
  orientation?: 'white' | 'black';
}

export const EvaluationBar: React.FC<EvaluationBarProps> = ({
  score,
  text,
  isCheckmate = false,
  orientation = 'white',
}) => {
  // Convert centipawns (-1500 to +1500) into a percentage (0% to 100%) for White
  let whitePercent = 50;
  if (isCheckmate) {
    whitePercent = score > 0 ? 100 : 0;
  } else {
    // Sigmoid compression for smooth visual bar height
    const cpClamped = Math.max(-1500, Math.min(1500, score));
    whitePercent = 50 + (cpClamped / 1500) * 45;
    whitePercent = Math.max(8, Math.min(92, whitePercent));
  }

  // Adjust display percentage if board is flipped
  const fillPercent = orientation === 'white' ? whitePercent : 100 - whitePercent;

  return (
    <div className="relative w-8 sm:w-10 h-full rounded-xl overflow-hidden border border-wood-700/80 bg-wood-950 flex flex-col justify-end shadow-inner select-none">
      {/* Black's share (top) is the dark wood background */}
      {/* White's share (bottom) is the ivory parchment fill */}
      <div
        className="w-full bg-parchment-200 transition-all duration-300 ease-out"
        style={{ height: `${fillPercent}%` }}
      />

      {/* Score Text displayed directly inside the majority section */}
      <div
        className={`absolute inset-x-0 flex items-center justify-center pointer-events-none px-0.5 ${
          fillPercent >= 50 ? 'bottom-2' : 'top-2'
        }`}
      >
        <span
          className={`w-full text-center text-[10px] sm:text-[11px] font-mono font-bold tracking-tighter whitespace-nowrap overflow-hidden ${
            fillPercent >= 50
              ? 'text-wood-950'
              : 'text-parchment-100'
          }`}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
