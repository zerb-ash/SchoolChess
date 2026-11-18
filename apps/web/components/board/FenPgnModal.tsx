'use client';

import React, { useState } from 'react';
import { X, Check, Copy, FileText, CheckCircle2 } from 'lucide-react';

interface FenPgnModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFen: string;
  currentPgn: string;
  onLoadFen: (fen: string) => boolean;
  onLoadPgn: (pgn: string) => boolean;
}

export const FenPgnModal: React.FC<FenPgnModalProps> = ({
  isOpen,
  onClose,
  currentFen,
  currentPgn,
  onLoadFen,
  onLoadPgn,
}) => {
  const [fenInput, setFenInput] = useState(currentFen);
  const [pgnInput, setPgnInput] = useState(currentPgn);
  const [activeTab, setActiveTab] = useState<'fen' | 'pgn'>('fen');
  const [statusMsg, setStatusMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    const textToCopy = activeTab === 'fen' ? currentFen : currentPgn;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoad = () => {
    setStatusMsg(null);
    if (activeTab === 'fen') {
      const ok = onLoadFen(fenInput.trim());
      if (ok) {
        setStatusMsg({ text: 'FEN loaded successfully!', error: false });
        setTimeout(() => onClose(), 800);
      } else {
        setStatusMsg({ text: 'Invalid FEN notation string.', error: true });
      }
    } else {
      const ok = onLoadPgn(pgnInput.trim());
      if (ok) {
        setStatusMsg({ text: 'PGN loaded successfully!', error: false });
        setTimeout(() => onClose(), 800);
      } else {
        setStatusMsg({ text: 'Invalid PGN format.', error: true });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-wood-900 border border-brass-500/30 rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-5 text-parchment-100">
        <div className="flex items-center justify-between border-b border-wood-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('fen');
                setStatusMsg(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'fen'
                  ? 'bg-brass-600 text-wood-950 font-bold border border-brass-500 shadow-sm'
                  : 'text-parchment-400 hover:text-parchment-200 hover:bg-wood-850'
              }`}
            >
              FEN Position
            </button>
            <button
              onClick={() => {
                setActiveTab('pgn');
                setStatusMsg(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'pgn'
                  ? 'bg-brass-600 text-wood-950 font-bold border border-brass-500 shadow-sm'
                  : 'text-parchment-400 hover:text-parchment-200 hover:bg-wood-850'
              }`}
            >
              PGN Notation
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-parchment-400 hover:text-parchment-100 hover:bg-wood-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeTab === 'fen' ? (
          <div className="flex flex-col gap-2">
            <label className="text-xs text-parchment-300 font-medium tracking-wide">Position FEN String:</label>
            <textarea
              rows={3}
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              className="w-full bg-wood-950 border border-wood-700 rounded-xl p-3 text-xs font-mono text-parchment-100 placeholder:text-parchment-600 focus:outline-none focus:border-brass-500 focus:ring-1 focus:ring-brass-500/40"
              placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs text-parchment-300 font-medium tracking-wide">Full Game PGN:</label>
            <textarea
              rows={6}
              value={pgnInput}
              onChange={(e) => setPgnInput(e.target.value)}
              className="w-full bg-wood-950 border border-wood-700 rounded-xl p-3 text-xs font-mono text-parchment-100 placeholder:text-parchment-600 focus:outline-none focus:border-brass-500 focus:ring-1 focus:ring-brass-500/40"
              placeholder="1. e4 e5 2. Nf3 Nc6..."
            />
          </div>
        )}

        {statusMsg && (
          <div
            className={`text-xs p-3 rounded-xl font-medium ${
              statusMsg.error
                ? 'bg-red-950/40 text-red-300 border border-red-900/50'
                : 'bg-brass-500/10 text-brass-300 border border-brass-500/30'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleCopy}
            className="px-4 py-2.5 rounded-xl bg-wood-950 hover:bg-wood-850 text-parchment-200 text-xs font-semibold flex items-center gap-2 border border-wood-700 hover:border-brass-500/40 transition-colors cursor-pointer shadow-sm"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-brass-400" /> : <Copy className="w-3.5 h-3.5 text-brass-400" />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-wood-950 hover:bg-wood-850 text-parchment-300 border border-wood-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleLoad}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 text-wood-950 text-xs font-bold uppercase tracking-wider shadow-lg shadow-brass-700/20 transition-all hover:scale-102 active:scale-98 cursor-pointer"
            >
              Load on Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
