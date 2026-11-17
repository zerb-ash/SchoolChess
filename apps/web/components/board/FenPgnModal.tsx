'use client';

import React, { useState } from 'react';
import { X, Check, Copy } from 'lucide-react';

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
        setStatusMsg({ text: 'Invalid FEN notation.', error: true });
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab('fen');
                setStatusMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'fen'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              FEN Position
            </button>
            <button
              onClick={() => {
                setActiveTab('pgn');
                setStatusMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'pgn'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              PGN Notation
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeTab === 'fen' ? (
          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-400 font-medium">Position FEN String:</label>
            <textarea
              rows={3}
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
              placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-400 font-medium">Full Game PGN:</label>
            <textarea
              rows={6}
              value={pgnInput}
              onChange={(e) => setPgnInput(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
              placeholder="1. e4 e5 2. Nf3 Nc6..."
            />
          </div>
        )}

        {statusMsg && (
          <div
            className={`text-xs p-2.5 rounded-lg font-medium ${
              statusMsg.error
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 border border-zinc-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleLoad}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-102"
            >
              Load on Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

