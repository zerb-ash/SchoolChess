'use client';

import React from 'react';

interface MiniBoardProps {
  fen?: string;
  size?: number;
  className?: string;
}

function parseFenTo8x8(fen?: string): (string | null)[][] {
  const [boardPart] = (fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR').split(' ');
  const rows = boardPart.split('/');
  const board: (string | null)[][] = [];

  for (let r = 0; r < 8; r++) {
    const row = rows[r] || '8';
    const rowPieces: (string | null)[] = [];
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        const count = parseInt(char, 10);
        for (let i = 0; i < count; i++) rowPieces.push(null);
      } else {
        const color = char === char.toUpperCase() ? 'w' : 'b';
        rowPieces.push(`${color}${char.toUpperCase()}`);
      }
    }
    board.push(rowPieces);
  }
  return board;
}

export const MiniBoard: React.FC<MiniBoardProps> = ({ fen, size = 64, className = '' }) => {
  const board = parseFenTo8x8(fen);
  const hasCustomSizeClass = className.includes('w-') || className.includes('h-');

  return (
    <div
      style={!hasCustomSizeClass && size ? { width: size, height: size } : undefined}
      className={`grid grid-cols-8 grid-rows-8 rounded-lg overflow-hidden border border-wood-700/80 shrink-0 shadow-md bg-wood-950 ${className}`}
    >
      {board.map((row, rIdx) =>
        row.map((piece, fIdx) => {
          const isLight = (rIdx + fIdx) % 2 === 0;
          return (
            <div
              key={`${rIdx}-${fIdx}`}
              style={{
                backgroundColor: isLight ? 'var(--board-light, #f0d9b5)' : 'var(--board-dark, #b58863)',
              }}
              className="flex items-center justify-center relative select-none"
            >
              {piece && (
                <img
                  src={`/pieces/${piece}.png`}
                  alt=""
                  className="w-full h-full object-contain pointer-events-none drop-shadow-sm"
                  loading="lazy"
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
