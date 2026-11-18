import { PassAndPlayBoard } from '../../components/board/PassAndPlayBoard';

export default function SandboxPage() {
  return (
    <div className="flex-1 flex flex-col items-center py-6">
      <div className="w-full max-w-6xl px-4 flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-serif font-bold text-parchment-100">Sandbox</h1>
          <p className="text-xs text-parchment-400">Play locally against a friend or test moves with complete rule validation</p>
        </div>
      </div>

      <PassAndPlayBoard />
    </div>
  );
}

