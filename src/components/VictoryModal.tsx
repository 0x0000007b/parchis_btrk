import React from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import { GameState, PLAYER_THEMES, formatPlayerLabel } from '../types/game';

interface VictoryModalProps {
  state: GameState;
  onRestart: () => void;
  buttonLabel?: string;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  state,
  onRestart,
  buttonLabel = 'Играть снова',
}) => {
  if (state.phase !== 'GAME_OVER' || state.winnerId === null) return null;

  const winner = state.players.find((p) => p.id === state.winnerId);
  if (!winner) return null;
  const winnerTheme = PLAYER_THEMES[winner.color];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#faf6ee] dark:bg-[#1b2026] border border-amber-500/60 shadow-2xl p-6 space-y-5 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-600 dark:text-amber-300">
          <Trophy className="w-9 h-9" />
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            Партия завершена за {state.turnNumber} кругов
          </div>
          <h2 id="victory-title" className="font-display text-2xl sm:text-3xl font-extrabold text-[#1f1a16] dark:text-[#f8fafc]">
            Победил {winner.avatar} {formatPlayerLabel(winner)}!
          </h2>
          <p className="text-sm text-[#635648] dark:text-[#94a3b8]">
            Все 5 фишек ({winnerTheme.armLabel}) собрали слово «ФИНИШ».
          </p>
        </div>

        <div className="rounded-xl bg-[#f3ede2] dark:bg-[#14181d] border border-[#d6c9b4] dark:border-[#2d3540] divide-y divide-[#e2d8c7] dark:divide-[#242a33] text-left">
          {state.players.map((p) => {
            const theme = PLAYER_THEMES[p.color];
            const finished = state.tokens.filter(
              (t) => t.ownerId === p.id && t.location.kind === 'FINISH'
            ).length;
            return (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-7 h-7 rounded-lg bg-[#faf6ee] dark:bg-[#1e242c] border flex items-center justify-center text-base shrink-0"
                    style={{ borderColor: theme.fill }}
                  >
                    {p.avatar}
                  </span>
                  <span className="font-semibold text-[#1f1a16] dark:text-[#f8fafc] truncate">
                    {formatPlayerLabel(p)}
                  </span>
                </div>
                <div className="font-mono text-xs tabular-nums text-[#635648] dark:text-[#94a3b8] shrink-0">
                  Финиш: {finished}/5 · Плен: {p.capturesCount}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1c140e] font-display font-bold text-base flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{buttonLabel}</span>
        </button>
      </div>
    </div>
  );
};
