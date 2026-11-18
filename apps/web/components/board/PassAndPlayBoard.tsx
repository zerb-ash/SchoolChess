'use client';

import React, { useState, useMemo } from 'react';
import { Chess, Move } from 'chess.js';
import { Chessboard } from './Chessboard';
import { PieceSymbol } from './PieceSvg';
import { CapturedPieces } from './CapturedPieces';
import { MoveNavigator } from './MoveNavigator';
import { FenPgnModal } from './FenPgnModal';
import { useAppSettings } from '../../lib/useSettings';
import { soundSystem } from '../../lib/audio';
import { RotateCcw, ArrowUpDown, FileText, Flag, Handshake, Trophy } from 'lucide-react';

interface PositionSnapshot {
  fen: string;
  san?: string;
  from?: string;
  to?: string;
  color?: 'w' | 'b';
}

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export const PassAndPlayBoard: React.FC = () => {
  const { currentThemeColors: themeColors, settings } = useAppSettings();
  const [chess] = useState(() => new Chess());
  const [history, setHistory] = useState<PositionSnapshot[]>([{ fen: chess.fen() }]);
  const [viewIndex, setViewIndex] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [isFenPgnModalOpen, setIsFenPgnModalOpen] = useState(false);
  const [customTermination, setCustomTermination] = useState<{ result: string; reason: string } | null>(null);

  const activePosition = history[viewIndex] || history[history.length - 1];
  const isViewingHistory = viewIndex !== history.length - 1;

  const currentTurn = chess.turn();
  const isCheck = chess.inCheck();
  const isGameOver = chess.isGameOver() || !!customTermination;

  // Track captured pieces and calculate material advantage
  const { whiteCaptured, blackCaptured, whiteAdvantage, blackAdvantage } = useMemo(() => {
    const startPieces: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts: { w: Record<string, number>; b: Record<string, number> } = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    };

    const board = chess.board();
    for (const row of board) {
      for (const sq of row) {
        if (sq && sq.type !== 'k') {
          currentCounts[sq.color][sq.type] = (currentCounts[sq.color][sq.type] || 0) + 1;
        }
      }
    }

    const whiteCaps: PieceSymbol[] = [];
    const blackCaps: PieceSymbol[] = [];
    let whiteTotalVal = 0;
    let blackTotalVal = 0;

    for (const [type, count] of Object.entries(startPieces)) {
      const missingBlack = count - (currentCounts.b[type] || 0);
      for (let i = 0; i < missingBlack; i++) {
        whiteCaps.push(`b${type.toUpperCase()}` as PieceSymbol);
        whiteTotalVal += PIECE_VALUES[type] || 0;
      }

      const missingWhite = count - (currentCounts.w[type] || 0);
      for (let i = 0; i < missingWhite; i++) {
        blackCaps.push(`w${type.toUpperCase()}` as PieceSymbol);
        blackTotalVal += PIECE_VALUES[type] || 0;
      }
    }

    return {
      whiteCaptured: whiteCaps,
      blackCaptured: blackCaps,
      whiteAdvantage: Math.max(0, whiteTotalVal - blackTotalVal),
      blackAdvantage: Math.max(0, blackTotalVal - whiteTotalVal),
    };
  }, [history.length]);

  const getLegalMovesForSquare = (square: string): string[] => {
    if (isViewingHistory || isGameOver) return [];
    try {
      const moves = chess.moves({ square: square as any, verbose: true }) as Move[];
      return moves.map((m) => m.to);
    } catch {
      return [];
    }
  };

  const handleMakeMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (isViewingHistory || isGameOver) return;

    try {
      const move = chess.move({
        from,
        to,
        promotion: promotion || 'q',
      });

      if (move) {
        const nextFen = chess.fen();
        const newSnapshot: PositionSnapshot = {
          fen: nextFen,
          san: move.san,
          from,
          to,
          color: move.color,
        };

        const updatedHistory = [...history, newSnapshot];
        setHistory(updatedHistory);
        setViewIndex(updatedHistory.length - 1);

        soundSystem.playMoveEvent({
          gameOver: chess.isCheckmate(),
          check: chess.inCheck(),
          promotion: !!move.promotion,
          captured: !!move.captured,
        });
      }
    } catch {
      // Invalid move
    }
  };

  const handleReset = () => {
    chess.reset();
    const initFen = chess.fen();
    setHistory([{ fen: initFen }]);
    setViewIndex(0);
    setCustomTermination(null);
  };

  const handleClaimDraw = (reason: 'threefold' | 'fifty') => {
    setCustomTermination({
      result: '1/2-1/2',
      reason: reason === 'threefold' ? 'Draw claimed by Threefold Repetition' : 'Draw claimed by 50-move rule',
    });
    soundSystem.playGameOver();
  };

  const handleLoadCustomFen = (fen: string): boolean => {
    try {
      chess.load(fen);
      setHistory([{ fen: chess.fen() }]);
      setViewIndex(0);
      setCustomTermination(null);
      return true;
    } catch {
      return false;
    }
  };

  const handleLoadCustomPgn = (pgn: string): boolean => {
    try {
      const temp = new Chess();
      temp.loadPgn(pgn);

      chess.loadPgn(pgn);
      const moveHistory = chess.history({ verbose: true });
      const snapshots: PositionSnapshot[] = [{ fen: new Chess().fen() }];

      const replay = new Chess();
      for (const m of moveHistory) {
        replay.move(m);
        snapshots.push({
          fen: replay.fen(),
          san: m.san,
          from: m.from,
          to: m.to,
          color: m.color,
        });
      }

      setHistory(snapshots);
      setViewIndex(snapshots.length - 1);
      setCustomTermination(null);
      return true;
    } catch {
      return false;
    }
  };

  const getTerminationSummary = () => {
    if (customTermination) return customTermination.reason;
    if (chess.isCheckmate()) {
      return `Checkmate! ${currentTurn === 'w' ? 'Black' : 'White'} wins!`;
    }
    if (chess.isStalemate()) return 'Draw by Stalemate';
    if (chess.isInsufficientMaterial()) return 'Draw by Insufficient Material';
    if (chess.isThreefoldRepetition()) return 'Draw by Threefold Repetition';
    return 'Draw by 50-move rule';
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 py-4 px-4">
      {/* Board Left Column */}
      <div className="flex flex-col items-center w-full max-w-[620px]">
        {/* Top Player Card (Black when normal orientation) */}
        <div className="w-full flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full border border-zinc-600 ${
                orientation === 'white' ? 'bg-zinc-800' : 'bg-white'
              }`}
            />
            <span className="text-xs font-bold text-zinc-300">
              {orientation === 'white' ? 'Black' : 'White'}
            </span>
            <CapturedPieces
              captured={orientation === 'white' ? blackCaptured : whiteCaptured}
              advantage={orientation === 'white' ? blackAdvantage : whiteAdvantage}
            />
          </div>
        </div>

        {/* Board Container */}
        <Chessboard
          fen={activePosition.fen}
          orientation={orientation}
          themeColors={themeColors}
          showCoordinates={settings.showCoordinates}
          highlightLastMove={settings.highlightLastMove}
          highlightLegalMoves={settings.highlightLegalMoves && !isViewingHistory}
          lastMove={activePosition.from && activePosition.to ? { from: activePosition.from, to: activePosition.to } : null}
          isCheck={isCheck && !isViewingHistory}
          turn={currentTurn}
          onMakeMove={handleMakeMove}
          getLegalMovesForSquare={getLegalMovesForSquare}
          disabled={isGameOver || isViewingHistory}
        />

        {/* Bottom Player Card (White when normal orientation) */}
        <div className="w-full flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full border border-zinc-600 ${
                orientation === 'white' ? 'bg-white' : 'bg-zinc-800'
              }`}
            />
            <span className="text-xs font-bold text-zinc-300">
              {orientation === 'white' ? 'White' : 'Black'}
            </span>
            <CapturedPieces
              captured={orientation === 'white' ? whiteCaptured : blackCaptured}
              advantage={orientation === 'white' ? whiteAdvantage : blackAdvantage}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))}
              className="p-1.5 bg-wood-900 hover:bg-wood-850 text-parchment-300 rounded-lg border border-wood-800 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Flip Board"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-brass-400" />
              <span>Flip</span>
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 bg-wood-900 hover:bg-wood-850 text-parchment-300 rounded-lg border border-wood-800 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset Game"
            >
              <RotateCcw className="w-3.5 h-3.5 text-brass-400" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Game Over Banner */}
        {isGameOver && (
          <div className="w-full mt-4 p-4 rounded-xl bg-wood-900 border border-brass-500/40 text-center flex items-center justify-center gap-3 animate-fadeIn shadow-2xl">
            <Trophy className="w-5 h-5 text-brass-400" />
            <span className="font-serif font-bold text-parchment-100 text-sm">{getTerminationSummary()}</span>
          </div>
        )}
      </div>

      {/* Right Column: Move Navigator & Action Drawer */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Position Navigator Controls */}
        <MoveNavigator
          currentIndex={viewIndex}
          totalPositions={history.length}
          onFirst={() => setViewIndex(0)}
          onPrev={() => setViewIndex((prev) => Math.max(0, prev - 1))}
          onNext={() => setViewIndex((prev) => Math.min(history.length - 1, prev + 1))}
          onLast={() => setViewIndex(history.length - 1)}
        />

        {/* Claimable Draw Alerts */}
        {!isGameOver && chess.isThreefoldRepetition() && (
          <button
            onClick={() => handleClaimDraw('threefold')}
            className="w-full py-2.5 px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all flex items-center justify-center gap-2 shadow"
          >
            <Handshake className="w-4 h-4" />
            <span>Claim Draw (Threefold Repetition)</span>
          </button>
        )}

        {/* Move History Table */}
        <div className="bg-wood-900 border border-wood-800 rounded-xl p-4 shadow-xl flex flex-col h-[300px]">
          <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-400 mb-2">
            Move History
          </h3>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1 font-mono text-xs">
            {history.length <= 1 ? (
              <p className="text-parchment-500 italic text-center py-10">Moves will appear here...</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {Array.from({ length: Math.ceil((history.length - 1) / 2) }).map((_, i) => {
                  const whiteIdx = i * 2 + 1;
                  const blackIdx = i * 2 + 2;
                  const whiteSnap = history[whiteIdx];
                  const blackSnap = history[blackIdx];

                  return (
                    <React.Fragment key={i}>
                      <button
                        onClick={() => setViewIndex(whiteIdx)}
                        className={`flex items-center gap-2 p-1.5 rounded text-left transition-colors ${
                          viewIndex === whiteIdx
                            ? 'bg-brass-500/20 text-brass-300 font-bold border border-brass-500/40'
                            : 'bg-wood-950 text-parchment-300 hover:bg-wood-850'
                        }`}
                      >
                        <span className="text-parchment-500 w-4 text-right">{i + 1}.</span>
                        <span>{whiteSnap?.san}</span>
                      </button>
                      {blackSnap ? (
                        <button
                          onClick={() => setViewIndex(blackIdx)}
                          className={`flex items-center gap-2 p-1.5 rounded text-left transition-colors ${
                            viewIndex === blackIdx
                              ? 'bg-brass-500/20 text-brass-300 font-bold border border-brass-500/40'
                              : 'bg-wood-950 text-parchment-300 hover:bg-wood-850'
                          }`}
                        >
                          <span>{blackSnap.san}</span>
                        </button>
                      ) : (
                        <div className="p-1.5 text-parchment-500">...</div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action Button: FEN / PGN */}
        <button
          onClick={() => setIsFenPgnModalOpen(true)}
          className="w-full py-2.5 px-4 bg-wood-900 hover:bg-wood-850 text-parchment-200 rounded-xl border border-wood-800 hover:border-brass-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <FileText className="w-4 h-4 text-brass-400" />
          <span>FEN / PGN</span>
        </button>
      </div>

      {/* FEN / PGN Modal */}
      <FenPgnModal
        isOpen={isFenPgnModalOpen}
        onClose={() => setIsFenPgnModalOpen(false)}
        currentFen={chess.fen()}
        currentPgn={chess.pgn()}
        onLoadFen={handleLoadCustomFen}
        onLoadPgn={handleLoadCustomPgn}
      />
    </div>
  );
};
