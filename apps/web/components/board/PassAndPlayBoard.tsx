'use client';

import React, { useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from './Chessboard';
import { useAppSettings } from '../../lib/useSettings';
import { soundSystem } from '../../lib/audio';
import { RotateCcw, ArrowUpDown, Copy, Check, Trophy } from 'lucide-react';

export const PassAndPlayBoard: React.FC = () => {
  const { themeColors, settings } = useAppSettings();
  const [chessInstance, setChessInstance] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chessInstance.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [copiedFen, setCopiedFen] = useState(false);
  const [copiedPgn, setCopiedPgn] = useState(false);

  const turn = chessInstance.turn();
  const isCheck = chessInstance.inCheck();
  const isGameOver = chessInstance.isGameOver();

  // Legal moves generator
  const getLegalMovesForSquare = (square: string): string[] => {
    try {
      const moves = chessInstance.moves({ square: square as any, verbose: true });
      return moves.map((m) => m.to);
    } catch {
      return [];
    }
  };

  const handleMakeMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    try {
      const move = chessInstance.move({
        from,
        to,
        promotion: promotion || 'q',
      });

      if (move) {
        setFen(chessInstance.fen());
        setLastMove({ from, to });

        if (chessInstance.isCheckmate()) {
          soundSystem.playGameOver();
        } else if (chessInstance.inCheck()) {
          soundSystem.playCheck();
        } else if (move.captured) {
          soundSystem.playCapture();
        } else {
          soundSystem.playMove();
        }
      }
    } catch {
      // Invalid move
    }
  };

  const handleReset = () => {
    const newChess = new Chess();
    setChessInstance(newChess);
    setFen(newChess.fen());
    setLastMove(null);
  };

  const handleFlip = () => {
    setOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
  };

  const handleCopyFen = () => {
    navigator.clipboard.writeText(fen);
    setCopiedFen(true);
    setTimeout(() => setCopiedFen(false), 2000);
  };

  const handleCopyPgn = () => {
    navigator.clipboard.writeText(chessInstance.pgn());
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  const moveHistory = useMemo(() => {
    return chessInstance.history();
  }, [fen]);

  // Game over status summary
  const getGameOverReason = () => {
    if (!isGameOver) return null;
    if (chessInstance.isCheckmate()) {
      return `Checkmate! ${turn === 'w' ? 'Black' : 'White'} wins!`;
    }
    if (chessInstance.isStalemate()) return 'Draw by Stalemate';
    if (chessInstance.isThreefoldRepetition()) return 'Draw by Threefold Repetition';
    if (chessInstance.isInsufficientMaterial()) return 'Draw by Insufficient Material';
    return 'Draw by 50-move rule';
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 py-6 px-4">
      {/* Board Left Column */}
      <div className="flex flex-col items-center w-full max-w-[620px]">
        {/* Game Status Banner */}
        <div className="w-full flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-3.5 h-3.5 rounded-full border border-zinc-500 ${
                turn === 'w' ? 'bg-white' : 'bg-zinc-800'
              }`}
            />
            <span className="text-sm font-semibold text-zinc-300">
              {turn === 'w' ? "White's turn" : "Black's turn"}
            </span>
            {isCheck && !isGameOver && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                CHECK
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFlip}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 text-xs flex items-center gap-1.5 transition-colors"
              title="Flip Board"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Flip</span>
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 text-xs flex items-center gap-1.5 transition-colors"
              title="New Game"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Board */}
        <Chessboard
          fen={fen}
          orientation={orientation}
          themeColors={themeColors}
          showCoordinates={settings.showCoordinates}
          highlightLastMove={settings.highlightLastMove}
          highlightLegalMoves={settings.highlightLegalMoves}
          lastMove={lastMove}
          isCheck={isCheck}
          turn={turn}
          onMakeMove={handleMakeMove}
          getLegalMovesForSquare={getLegalMovesForSquare}
          disabled={isGameOver}
        />

        {/* Game Over Banner */}
        {isGameOver && (
          <div className="w-full mt-4 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-center flex items-center justify-center gap-3 animate-fade-in">
            <Trophy className="w-6 h-6 text-emerald-400" />
            <span className="font-bold text-emerald-200 text-base">{getGameOverReason()}</span>
          </div>
        )}
      </div>

      {/* Move History & Actions Right Column */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Move History Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl flex flex-col h-[340px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Move History ({Math.ceil(moveHistory.length / 2)})
          </h3>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1 font-mono text-xs">
            {moveHistory.length === 0 ? (
              <p className="text-zinc-500 italic text-center py-10">Moves will appear here...</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => {
                  const whiteMove = moveHistory[i * 2];
                  const blackMove = moveHistory[i * 2 + 1];
                  return (
                    <React.Fragment key={i}>
                      <div className="flex items-center gap-2 p-1 rounded bg-zinc-800/40">
                        <span className="text-zinc-500 w-5 text-right">{i + 1}.</span>
                        <span className="text-zinc-200 font-semibold">{whiteMove}</span>
                      </div>
                      <div className="flex items-center gap-2 p-1 rounded bg-zinc-800/40">
                        {blackMove ? (
                          <span className="text-zinc-200 font-semibold">{blackMove}</span>
                        ) : (
                          <span className="text-zinc-600">...</span>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FEN & PGN Export Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl flex flex-col gap-3 text-xs">
          <h3 className="font-bold uppercase tracking-wider text-zinc-400">Export Notation</h3>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyFen}
              className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 flex items-center justify-center gap-2 transition-colors font-medium"
            >
              {copiedFen ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedFen ? 'FEN Copied!' : 'Copy FEN'}</span>
            </button>
            <button
              onClick={handleCopyPgn}
              className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 flex items-center justify-center gap-2 transition-colors font-medium"
            >
              {copiedPgn ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPgn ? 'PGN Copied!' : 'Copy PGN'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

