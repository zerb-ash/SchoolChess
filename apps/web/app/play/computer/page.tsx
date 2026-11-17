'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from '../../../components/board/Chessboard';
import { EvaluationBar } from '../../../components/board/EvaluationBar';
import { useAppSettings } from '../../../lib/useSettings';
import { soundSystem } from '../../../lib/audio';
import { computeBotMove, evaluatePosition, PositionEvaluation } from '@schoolchess/chess-core';
import { Bot, RotateCcw, Flag, ArrowUpDown, Clock, Trophy, ChevronRight, Zap } from 'lucide-react';

const BOT_LEVELS = [
  { level: 1, name: 'Beginner Bot', elo: 200, desc: 'Casual starter bot. Makes blunders and exploratory moves.' },
  { level: 2, name: 'Novice Bot', elo: 600, desc: 'Takes hanging pieces and avoids immediate 1-move traps.' },
  { level: 3, name: 'Club Bot', elo: 1100, desc: 'Solid tactical play, searches 2 moves ahead.' },
  { level: 4, name: 'Expert Bot', elo: 1600, desc: 'Positional awareness using piece-square tables.' },
  { level: 5, name: 'Master Bot', elo: 2000, desc: 'Deep alpha-beta search with aggressive counter-attacks.' },
];

export default function PlayComputerPage() {
  const { currentThemeColors: themeColors, settings } = useAppSettings();

  const [botLevel, setBotLevel] = useState(1);
  const [playerSide, setPlayerSide] = useState<'white' | 'black'>('white');
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chess.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gameOver, setGameOver] = useState<{ result: string; reason: string } | null>(null);

  const [evalResult, setEvalResult] = useState<PositionEvaluation>({
    score: 0,
    centipawns: 0,
    text: '0.0',
    isCheckmate: false,
  });

  const orientation = playerSide;
  const turn = chess.turn();
  const isCheck = chess.inCheck();
  const isPlayerTurn = (playerSide === 'white' && turn === 'w') || (playerSide === 'black' && turn === 'b');

  // Evaluate position whenever FEN updates
  useEffect(() => {
    const ev = evaluatePosition(fen);
    setEvalResult(ev);

    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        const winner = turn === 'w' ? 'Black' : 'White';
        setGameOver({ result: winner === 'White' ? '1-0' : '0-1', reason: `${winner} won by checkmate` });
        soundSystem.playGameOver();
      } else if (chess.isDraw()) {
        setGameOver({ result: '1/2-1/2', reason: 'Drawn game' });
        soundSystem.playGameOver();
      }
    }
  }, [fen, chess, turn]);

  // Bot move trigger
  useEffect(() => {
    if (gameOver || isPlayerTurn) return;

    setIsBotThinking(true);
    const timer = setTimeout(() => {
      try {
        const move = computeBotMove(chess.fen(), botLevel);
        const res = chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || 'q',
        });

        if (res) {
          setFen(chess.fen());
          setLastMove({ from: move.from, to: move.to });
          if (chess.inCheck()) {
            soundSystem.playCheck();
          } else if (res.captured) {
            soundSystem.playCapture();
          } else {
            soundSystem.playMove();
          }
        }
      } catch {
        // No legal moves
      } finally {
        setIsBotThinking(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isPlayerTurn, gameOver, botLevel, chess]);

  const handleMakeMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (gameOver || !isPlayerTurn || isBotThinking) return;

    try {
      const res = chess.move({
        from,
        to,
        promotion: promotion || 'q',
      });

      if (res) {
        setFen(chess.fen());
        setLastMove({ from, to });
        if (chess.inCheck()) {
          soundSystem.playCheck();
        } else if (res.captured) {
          soundSystem.playCapture();
        } else {
          soundSystem.playMove();
        }
      }
    } catch {
      // Illegal move
    }
  };

  const getLegalMovesForSquare = (square: string): string[] => {
    if (gameOver || !isPlayerTurn || isBotThinking) return [];
    return chess.moves({ square: square as any, verbose: true }).map((m) => m.to);
  };

  const handleRestart = () => {
    chess.reset();
    setFen(chess.fen());
    setLastMove(null);
    setGameOver(null);
    setIsBotThinking(false);
  };

  const handleResign = () => {
    if (gameOver) return;
    const winner = playerSide === 'white' ? 'Black' : 'White';
    setGameOver({ result: winner === 'White' ? '1-0' : '0-1', reason: `${playerSide} resigned` });
    soundSystem.playGameOver();
  };

  const moveHistory = useMemo(() => chess.history(), [fen]);
  const currentBot = BOT_LEVELS.find((b) => b.level === botLevel) || BOT_LEVELS[0];

  const topLabel = playerSide === 'white' ? `${currentBot.name} - Black` : `You - White`;
  const bottomLabel = playerSide === 'white' ? `You - White` : `${currentBot.name} - Black`;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 py-6 px-4">
      {/* Board & Eval Bar Column */}
      <div className="flex flex-col items-center w-full max-w-[660px]">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                orientation === 'white' ? 'bg-wood-950 border border-brass-500/40' : 'bg-parchment-100 shadow'
              }`}
            />
            <span className="text-xs font-serif font-bold text-parchment-300">
              {topLabel}
            </span>
            {isBotThinking && (
              <span className="text-[10px] text-brass-400 animate-pulse font-mono flex items-center gap-1">
                <Bot className="w-3 h-3" />
                <span>Thinking...</span>
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-parchment-400">
            {orientation === 'white' ? `Elo: ${currentBot.elo}` : 'Player'}
          </span>
        </div>

        {/* Board with Eval Bar */}
        <div className="w-full flex gap-3 items-stretch">
          <div className="h-[340px] sm:h-[500px] md:h-[560px]">
            <EvaluationBar
              score={evalResult.score}
              text={evalResult.text}
              isCheckmate={evalResult.isCheckmate}
              orientation={orientation}
            />
          </div>

          <div className="flex-1">
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
              disabled={!!gameOver || !isPlayerTurn || isBotThinking}
            />
          </div>
        </div>

        {/* Bottom Header (You) */}
        <div className="w-full flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                orientation === 'white' ? 'bg-parchment-100 shadow' : 'bg-wood-950 border border-brass-500/40'
              }`}
            />
            <span className="text-xs font-serif font-bold text-parchment-100">
              {bottomLabel}
            </span>
            {isPlayerTurn && !gameOver && (
              <span className="w-2 h-2 rounded-full bg-brass-400 animate-ping" />
            )}
          </div>

          <button
            onClick={() => setPlayerSide((prev) => (prev === 'white' ? 'black' : 'white'))}
            className="p-1.5 bg-wood-900 hover:bg-wood-850 text-parchment-300 rounded-lg border border-wood-800 text-xs flex items-center gap-1 cursor-pointer"
            title="Switch Side"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="text-[10px]">Switch Side</span>
          </button>
        </div>

        {/* Game Over Banner */}
        {gameOver && (
          <div className="w-full mt-4 p-4 rounded-xl bg-wood-900 border border-brass-500/40 text-center flex items-center justify-center gap-3 animate-fadeIn shadow-2xl">
            <Trophy className="w-5 h-5 text-brass-400" />
            <span className="font-serif font-bold text-parchment-100 text-sm">
              Game Over: {gameOver.result} ({gameOver.reason})
            </span>
          </div>
        )}
      </div>

      {/* Right Column: Bot Difficulty Picker & Controls */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <div className="bg-wood-900 border border-wood-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
          <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
            <Bot className="w-4 h-4 text-brass-400" />
            <span>Select Bot Opponent</span>
          </h2>

          <div className="flex flex-col gap-2">
            {BOT_LEVELS.map((bot) => (
              <button
                key={bot.level}
                onClick={() => setBotLevel(bot.level)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                  botLevel === bot.level
                    ? 'border-brass-400 bg-wood-850 shadow-md'
                    : 'border-wood-800 bg-wood-950/60 hover:bg-wood-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-parchment-100">{bot.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-wood-950 text-brass-400 font-mono">
                    ~{bot.elo} Elo
                  </span>
                </div>
                <p className="text-[10px] text-parchment-400 leading-tight">{bot.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Move History */}
        <div className="bg-wood-900 border border-wood-800 rounded-xl p-4 shadow-xl flex flex-col h-[240px]">
          <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-400 mb-2">
            Move History ({Math.ceil(moveHistory.length / 2)})
          </h3>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1 font-mono text-xs">
            {moveHistory.length === 0 ? (
              <p className="text-parchment-500 italic text-center py-8">Make your first move...</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-wood-950 text-parchment-300">
                      <span className="text-parchment-500 w-4 text-right">{i + 1}.</span>
                      <span className="text-parchment-100 font-semibold">{moveHistory[i * 2]}</span>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-wood-950 text-parchment-300">
                      {moveHistory[i * 2 + 1] ? (
                        <span className="text-parchment-100 font-semibold">{moveHistory[i * 2 + 1]}</span>
                      ) : (
                        <span className="text-parchment-500">...</span>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleRestart}
            className="py-2.5 px-2 bg-wood-900 hover:bg-wood-850 text-parchment-300 rounded-xl border border-wood-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-brass-400" />
            <span>New Game</span>
          </button>

          <button
            onClick={handleResign}
            disabled={!!gameOver}
            className="py-2.5 px-2 rounded-xl border border-wood-800 bg-wood-900 hover:bg-wood-850 text-parchment-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Flag className="w-4 h-4 text-salon-crimson" />
            <span>Resign</span>
          </button>
        </div>
      </div>
    </div>
  );
}

