import { PassAndPlayBoard } from '../../components/board/PassAndPlayBoard';
import { Swords } from 'lucide-react';

export default function SandboxPage() {
  return (
    <div className="flex-1 flex flex-col items-center py-6">
      <div className="w-full max-w-6xl px-4 flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Swords className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pass & Play Sandbox</h1>
            <p className="text-xs text-zinc-400">Play locally against a friend with complete rule validation</p>
          </div>
        </div>
      </div>

      <PassAndPlayBoard />
    </div>
  );
}

