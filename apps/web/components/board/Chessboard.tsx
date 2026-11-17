'use client';

import React, { useState, useMemo } from 'react';
import { PieceSvg, PieceSymbol } from './PieceSvg';
import { BoardThemeColors } from '../../lib/useSettings';
import { soundSystem } from '../../lib/audio';

export interface ChessboardProps {
  fen: string;
  orientation?: 'white' | 'black';
  themeColors: BoardThemeColors;
  showCoordinates?: boolean;
  highlightLastMove?: boolean;
  highlightLegalMoves?: boolean;
  lastMove?: { from: string; to: string } | null;
  isCheck?: boolean;
  turn?: 'w' | 'b';
  onMakeMove?: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => void;
  getLegalMovesForSquare?: (square: string) => string[];
  disabled?: boolean;
}

// Convert FEN board representation into 8x8 matrix
function parseFenBoard(fen: string): (PieceSymbol | null)[][] {
  const [boardPart] = fen.split(' ');
  const rows = boardPart.split('/');
  const board: (PieceSymbol | null)[][] = [];

  for (const row of rows) {
    const rowPieces: (PieceSymbol | null)[] = [];
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        const emptyCount = parseInt(char, 10);
        for (let i = 0; i < emptyCount; i++) rowPieces.push(null);
      } else {
        const isWhite = char === char.toUpperCase();
        const color = isWhite ? 'w' : 'b';
        rowPieces.push(`${color}${char.toUpperCase()}` as PieceSymbol);
      }
    }
    board.push(rowPieces);
  }
  return board;
}

export const Chessboard: React.FC<ChessboardProps> = ({
  fen,
  orientation = 'white',
  themeColors,
  showCoordinates = true,
  highlightLastMove = true,
  highlightLegalMoves = true,
  lastMove = null,
  isCheck = false,
  turn = 'w',
  onMakeMove,
  getLegalMovesForSquare,
  disabled = false,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  const boardMatrix = useMemo(() => parseFenBoard(fen), [fen]);

  // Coordinates mapping
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const displayFiles = orientation === 'white' ? files : [...files].reverse();
  const displayRanks = orientation === 'white' ? ranks : [...ranks].reverse();

  // Find legal destinations for selected piece
  const legalDestinations = useMemo(() => {
    if (!selectedSquare || !getLegalMovesForSquare) return [];
    return getLegalMovesForSquare(selectedSquare);
  }, [selectedSquare, getLegalMovesForSquare]);

  const handleSquareClick = (square: string, piece: PieceSymbol | null) => {
    if (disabled || pendingPromotion) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        // Deselect
        setSelectedSquare(null);
        return;
      }

      // Check if clicked square is a destination
      if (legalDestinations.includes(square)) {
        // Check for pawn promotion (reaching rank 8 for white or rank 1 for black)
        const isWhitePawn = selectedSquare[1] === '7' && square[1] === '8';
        const isBlackPawn = selectedSquare[1] === '2' && square[1] === '1';

        // Check if selected piece was a pawn
        const [fileIdx, rankIdx] = getIndicesFromSquare(selectedSquare);
        const movingPiece = boardMatrix[rankIdx][fileIdx];

        if (movingPiece && movingPiece.endsWith('P') && (isWhitePawn || isBlackPawn)) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }

        executeMove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }
    }

    // Select piece if it matches the active turn
    if (piece && piece.startsWith(turn)) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  const executeMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (onMakeMove) {
      onMakeMove(from, to, promotion);
      soundSystem.playMove();
    }
  };

  const handlePromotionSelect = (promo: 'q' | 'r' | 'b' | 'n') => {
    if (pendingPromotion) {
      executeMove(pendingPromotion.from, pendingPromotion.to, promo);
      setPendingPromotion(null);
      setSelectedSquare(null);
    }
  };

  function getIndicesFromSquare(sq: string): [number, number] {
    const fileChar = sq[0];
    const rankChar = sq[1];
    const fileIdx = files.indexOf(fileChar);
    const rankIdx = 8 - parseInt(rankChar, 10);
    return [fileIdx, rankIdx];
  }

  return (
    <div className="relative w-full max-w-[620px] aspect-square select-none shadow-2xl rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-900">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {displayRanks.map((rank, rIdx) =>
          displayFiles.map((file, fIdx) => {
            const square = `${file}${rank}`;
            const isLight = (files.indexOf(file) + parseInt(rank, 10)) % 2 !== 0;
            const bg = isLight ? themeColors.light : themeColors.dark;

            const [sourceFileIdx, sourceRankIdx] = getIndicesFromSquare(square);
            const piece = boardMatrix[sourceRankIdx]?.[sourceFileIdx] ?? null;

            const isSelected = selectedSquare === square;
            const isDestination = highlightLegalMoves && legalDestinations.includes(square);
            const isLastMoveSquare =
              highlightLastMove && lastMove && (lastMove.from === square || lastMove.to === square);
            const isKingInCheck =
              isCheck && piece && piece.endsWith('K') && piece.startsWith(turn);

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(square, piece)}
                style={{ backgroundColor: bg }}
                className="chess-square group relative transition-colors duration-75"
              >
                {/* Last move highlight */}
                {isLastMoveSquare && (
                  <div className="absolute inset-0 bg-yellow-400/35 pointer-events-none" />
                )}

                {/* Selected square highlight */}
                {isSelected && (
                  <div className="absolute inset-0 bg-emerald-400/40 border-2 border-emerald-400 pointer-events-none" />
                )}

                {/* Check alert on King */}
                {isKingInCheck && (
                  <div className="absolute inset-0 bg-radial from-red-600/70 to-red-500/20 border-2 border-red-500 animate-pulse pointer-events-none" />
                )}

                {/* Coordinates (Numbers on left, letters on bottom) */}
                {showCoordinates && (
                  <>
                    {fIdx === 0 && (
                      <span
                        className="absolute top-0.5 left-1 text-[10px] sm:text-xs font-bold opacity-70 pointer-events-none"
                        style={{ color: isLight ? themeColors.dark : themeColors.light }}
                      >
                        {rank}
                      </span>
                    )}
                    {rIdx === 7 && (
                      <span
                        className="absolute bottom-0.5 right-1 text-[10px] sm:text-xs font-bold opacity-70 pointer-events-none"
                        style={{ color: isLight ? themeColors.dark : themeColors.light }}
                      >
                        {file}
                      </span>
                    )}
                  </>
                )}

                {/* Chess Piece */}
                {piece && <PieceSvg piece={piece} />}

                {/* Destination dot / capture ring */}
                {isDestination && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {piece ? (
                      <div className="w-4/5 h-4/5 rounded-full border-4 border-emerald-400/80 animate-scale" />
                    ) : (
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500/80 shadow-md" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pawn Promotion Dialog */}
      {pendingPromotion && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm">
          <div className="bg-zinc-800 border border-zinc-600 p-5 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Promote Pawn
            </h3>
            <div className="flex gap-3">
              {(['q', 'r', 'b', 'n'] as const).map((promo) => {
                const promoPiece = `${turn}${promo.toUpperCase()}` as PieceSymbol;
                return (
                  <button
                    key={promo}
                    onClick={() => handlePromotionSelect(promo)}
                    className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-700/80 hover:bg-emerald-600/40 border border-zinc-600 hover:border-emerald-400 rounded-xl p-2 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    <PieceSvg piece={promoPiece} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

