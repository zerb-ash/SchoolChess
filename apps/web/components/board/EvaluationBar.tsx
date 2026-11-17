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
    whitePercent = Math.max(5, Math.min(95, whitePercent));
  }

  // Adjust display percentage if board is flipped
  const fillPercent = orientation === 'white' ? whitePercent : 100 - whitePercent;

  return (
    <div className="relative w-6 sm:w-8 h-full rounded-lg overflow-hidden border border-wood-700 bg-wood-950 flex flex-col justify-end shadow-inner">
      {/* Black's share (top) is the dark wood background */}
      {/* White's share (bottom) is the ivory parchment fill */}
      <div
        className="w-full bg-parchment-200 transition-all duration-300 ease-out flex items-center justify-center"
        style={{ height: `${fillPercent}%` }}
      />

      {/* Floating Score Badge */}
      <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
        <span
          className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded shadow ${
            score >= 0
              ? 'bg-wood-900/90 text-parchment-100 border border-wood-700'
              : 'bg-parchment-100/90 text-wood-950 border border-parchment-300'
          }`}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

