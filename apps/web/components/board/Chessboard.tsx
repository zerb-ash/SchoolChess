'use client';

import React, { useState, useMemo, useRef } from 'react';
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

  // Drag and drop state
  const [dragState, setDragState] = useState<{
    piece: PieceSymbol;
    fromSquare: string;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
    hasMoved: boolean;
  } | null>(null);

  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const boardMatrix = useMemo(() => parseFenBoard(fen), [fen]);

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const displayFiles = orientation === 'white' ? files : [...files].reverse();
  const displayRanks = orientation === 'white' ? ranks : [...ranks].reverse();

  const legalDestinations = useMemo(() => {
    const activeSquare = dragState?.fromSquare || selectedSquare;
    if (!activeSquare || !getLegalMovesForSquare) return [];
    return getLegalMovesForSquare(activeSquare);
  }, [dragState?.fromSquare, selectedSquare, getLegalMovesForSquare]);

  function getIndicesFromSquare(sq: string): [number, number] {
    const fileChar = sq[0];
    const rankChar = sq[1];
    const fileIdx = files.indexOf(fileChar);
    const rankIdx = 8 - parseInt(rankChar, 10);
    return [fileIdx, rankIdx];
  }

  const getSquareFromCoords = (clientX: number, clientY: number): string | null => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    if (relX >= 0 && relX <= rect.width && relY >= 0 && relY <= rect.height) {
      const col = Math.floor((relX / rect.width) * 8);
      const row = Math.floor((relY / rect.height) * 8);
      if (col >= 0 && col < 8 && row >= 0 && row < 8) {
        return `${displayFiles[col]}${displayRanks[row]}`;
      }
    }
    return null;
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
      setHoveredSquare(null);
    }
  };

  const tryMove = (from: string, to: string): boolean => {
    if (!legalDestinations.includes(to)) return false;

    const isWhitePawn = from[1] === '7' && to[1] === '8';
    const isBlackPawn = from[1] === '2' && to[1] === '1';
    const [fileIdx, rankIdx] = getIndicesFromSquare(from);
    const movingPiece = boardMatrix[rankIdx][fileIdx];

    if (movingPiece && movingPiece.endsWith('P') && (isWhitePawn || isBlackPawn)) {
      setPendingPromotion({ from, to });
      return true;
    }

    executeMove(from, to);
    setSelectedSquare(null);
    setHoveredSquare(null);
    return true;
  };

  // Click to move handler
  const handleSquareClick = (square: string, piece: PieceSymbol | null) => {
    if (disabled || pendingPromotion || dragState?.hasMoved) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }
      if (tryMove(selectedSquare, square)) {
        return;
      }
    }

    if (piece && piece.startsWith(turn)) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  // Pointer Down (Drag Start - Mouse, Touchscreen Laptop, Mobile)
  const handlePointerDown = (e: React.PointerEvent, square: string, piece: PieceSymbol | null) => {
    if (disabled || pendingPromotion || !piece || !piece.startsWith(turn)) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    setDragState({
      piece,
      fromSquare: square,
      startX: e.clientX,
      startY: e.clientY,
      currX: e.clientX,
      currY: e.clientY,
      hasMoved: false,
    });
    setSelectedSquare(square);
    setHoveredSquare(square);
  };

  // Pointer Move (Drag Move)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;

    const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
    const hasMoved = dragState.hasMoved || dist > 6;

    setDragState((prev) =>
      prev ? { ...prev, currX: e.clientX, currY: e.clientY, hasMoved } : null
    );

    const hovered = getSquareFromCoords(e.clientX, e.clientY);
    setHoveredSquare(hovered);
  };

  // Pointer Up (Drop Piece)
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState) return;

    const fromSquare = dragState.fromSquare;
    const hasMoved = dragState.hasMoved;
    const targetSquare = getSquareFromCoords(e.clientX, e.clientY);

    setDragState(null);
    setHoveredSquare(null);

    if (hasMoved && targetSquare && targetSquare !== fromSquare) {
      if (!tryMove(fromSquare, targetSquare)) {
        setSelectedSquare(null);
      }
    } else if (!hasMoved) {
      // Tap without drag: square click handles selection
    }
  };

  const handlePointerCancel = () => {
    setDragState(null);
    setHoveredSquare(null);
  };

  return (
    <div
      ref={boardRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="relative w-full max-w-[620px] aspect-square select-none board-border rounded-xl overflow-hidden bg-wood-950 touch-none"
    >
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
            const isBeingDragged = dragState?.fromSquare === square && dragState.hasMoved;
            const isHoveredDestination = isDestination && hoveredSquare === square;

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(square, piece)}
                onPointerDown={(e) => handlePointerDown(e, square, piece)}
                style={{ backgroundColor: bg }}
                className="chess-square group relative transition-colors duration-75 select-none"
              >
                {/* Last move highlight */}
                {isLastMoveSquare && (
                  <div className="absolute inset-0 bg-yellow-400/35 pointer-events-none" />
                )}

                {/* Selected square highlight */}
                {isSelected && (
                  <div className="absolute inset-0 bg-brass-500/35 border-2 border-brass-400 pointer-events-none" />
                )}

                {/* Hovered legal target square */}
                {isHoveredDestination && (
                  <div className="absolute inset-0 bg-brass-400/40 border-2 border-brass-300 pointer-events-none" />
                )}

                {/* Check alert on King */}
                {isKingInCheck && (
                  <div className="absolute inset-0 bg-radial from-red-600/70 to-red-500/20 border-2 border-red-500 animate-pulse pointer-events-none" />
                )}

                {/* Coordinates */}
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

                {/* Chess Piece on board */}
                {piece && (
                  <div
                    className={`w-full h-full flex items-center justify-center transition-opacity ${
                      isBeingDragged ? 'opacity-20' : 'opacity-100'
                    }`}
                  >
                    <PieceSvg piece={piece} />
                  </div>
                )}

                {/* Destination dot / capture ring */}
                {isDestination && !isHoveredDestination && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {piece ? (
                      <div className="w-4/5 h-4/5 rounded-full border-4 border-brass-400/90 animate-scale" />
                    ) : (
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-brass-500/85 shadow-md" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Dragged Piece Ghost under Finger / Cursor */}
      {dragState && dragState.hasMoved && (
        <div
          style={{
            position: 'fixed',
            left: dragState.currX - 36,
            top: dragState.currY - 36,
            width: 72,
            height: 72,
            pointerEvents: 'none',
            zIndex: 9999,
            transform: 'scale(1.15)',
            filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.65))',
          }}
          className="flex items-center justify-center"
        >
          <PieceSvg piece={dragState.piece} className="w-full h-full object-contain" />
        </div>
      )}

      {/* Pawn Promotion Dialog */}
      {pendingPromotion && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-50 animate-fadeIn backdrop-blur-sm">
          <div className="bg-wood-900 border border-brass-500/40 p-5 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
            <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-200">
              Promote Pawn
            </h3>
            <div className="flex gap-3">
              {(['q', 'r', 'b', 'n'] as const).map((promo) => {
                const promoPiece = `${turn}${promo.toUpperCase()}` as PieceSymbol;
                return (
                  <button
                    key={promo}
                    onClick={() => handlePromotionSelect(promo)}
                    className="w-16 h-16 sm:w-20 sm:h-20 bg-wood-950 hover:bg-wood-850 border border-wood-700 hover:border-brass-400 rounded-xl p-2 transition-all hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer shadow-md"
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
