'use client';

import React from 'react';
import { PieceSvg, PieceSymbol } from './PieceSvg';

interface CapturedPiecesProps {
  captured: PieceSymbol[];
  advantage: number;
}

const PIECE_ORDER = ['P', 'N', 'B', 'R', 'Q'];

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({ captured, advantage }) => {
  const sorted = [...captured].sort((a, b) => {
    return PIECE_ORDER.indexOf(a[1]) - PIECE_ORDER.indexOf(b[1]);
  });

  return (
    <div className="flex items-center gap-1.5 h-6 text-xs text-zinc-400">
      <div className="flex items-center -space-x-1 overflow-x-auto">
        {sorted.map((p, idx) => {
          const isBlack = p.startsWith('b');
          return (
            <div
              key={idx}
              className={`w-5 h-5 flex-shrink-0 ${
                isBlack
                  ? 'filter drop-shadow-[0_0_1px_rgba(255,255,255,0.75)] drop-shadow-[0_0_0.5px_rgba(255,255,255,0.9)]'
                  : ''
              }`}
            >
              <PieceSvg piece={p} className="w-full h-full" />
            </div>
          );
        })}
      </div>
      {advantage > 0 && (
        <span className="font-bold text-zinc-300 text-[11px] ml-1">+{advantage}</span>
      )}
    </div>
  );
};

