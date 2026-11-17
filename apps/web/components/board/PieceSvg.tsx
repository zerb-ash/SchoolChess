'use client';

import React from 'react';

export type PieceSymbol =
  | 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP'
  | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';

interface PieceSvgProps {
  piece: PieceSymbol;
  className?: string;
}

export const PieceSvg: React.FC<PieceSvgProps> = ({ piece, className = 'chess-piece' }) => {
  const isWhite = piece.startsWith('w');
  const pieceClass = isWhite ? 'white-piece' : 'black-piece';

  return (
    <img
      src={`/pieces/${piece}.png`}
      alt={piece}
      className={`${className} ${pieceClass}`}
      draggable={false}
    />
  );
};
