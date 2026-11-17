import React, { useEffect, useState } from 'react';
import { Dices, Play, RotateCw, SkipForward, Sparkles, Star, Trophy } from 'lucide-react';
import { GameState, MoveOption, PLAYER_AVATARS, PLAYER_THEMES, Player } from '../types/game';

interface DiceTrayProps {
  state: GameState;
  isRolling: boolean;
  isTransitioningTurn: boolean;
  turnHighlightKey: number;
  hasAnyMoves: boolean;
  dieHasMoves: [boolean, boolean];
  selectedTokenId: string | null;
  selectedTokenMoves: MoveOption[];
  hoveredMoveId: string | null;
  isOnlineMode?: boolean;
  isMyTurn?: boolean;
  isHost?: boolean;
  myPlayerId?: number | null;
  onRollDraw: () => void;
  onStartFromDraw: () => void;
  onRoll: () => void;
  onSelectDie: (index: 0 | 1) => void;
  onEndTurn: () => void;
  onSelectMove: (move: MoveOption) => void;
  onHoverMove: (moveId: string | null) => void;
  onUpdatePlayerName: (playerId: number, name: string) => void;
  onUpdatePlayerAvatar: (playerId: number, avatar: string) => void;
}

const PIP_COORDS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
};

const DieFace: React.FC<{
  value: number | null;
  used: boolean;
  selected: boolean;
  rolling: boolean;
  hasMoves: boolean;
  goldenGlow?: boolean;
  onClick?: () => void;
}> = ({ value, used, selected, rolling, hasMoves, goldenGlow = false, onClick }) => {
  const pips = value ? PIP_COORDS[value] ?? [] : [];

  return (
    <button
      type="button"
      disabled={used || value === null || !onClick}
      onClick={onClick}
      aria-label={value ? `Кубик ${value}${used ? ' использован' : ''}` : 'Кубик не брошен'}
      className={`relative w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-xl transition-all duration-150 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
        rolling ? 'animate-dice-tumble' : ''
      } ${
        value === null
          ? 'bg-[#e7dfd1] dark:bg-[#232931] border border-[#cbbda8] dark:border-[#343d48] text-[#8a7a68] dark:text-[#64748b] cursor-default'
          : goldenGlow
          ? used
            ? 'bg-[#fcfaf5] dark:bg-[#ede8df] border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.65)] ring-2 ring-amber-400/50 opacity-80 cursor-not-allowed'
            : selected
            ? 'bg-white dark:bg-[#f8f5ef] border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.85),0_0_0_3px_rgba(245,158,11,0.35)] scale-105 cursor-pointer'
            : 'bg-[#fcfaf5] dark:bg-[#ede8df] border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.7)] hover:scale-[1.03] cursor-pointer'
          : used
          ? 'bg-[#e7dfd1] dark:bg-[#1a1f26] border border-[#d6cbb9] dark:border-[#2a313b] opacity-40 cursor-not-allowed'
          : selected
          ? 'bg-white dark:bg-[#f8f5ef] border-2 border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.3),0_8px_18px_rgba(0,0,0,0.22)] scale-105 cursor-pointer'
          : 'bg-[#fcfaf5] dark:bg-[#ede8df] border border-[#c4b59e] dark:border-[#64748b] shadow-[0_4px_10px_rgba(0,0,0,0.16)] hover:scale-[1.03] cursor-pointer'
      }`}
    >
      {value === null ? (
        <span className="font-display text-xl font-bold">?</span>
      ) : (
        <svg viewBox="0 0 100 100" className="w-full h-full p-1.5">
          {pips.map(([cx, cy], idx) => (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r="9.5"
              fill={value === 6 ? '#b91c1c' : '#18181b'}
            />
          ))}
        </svg>
      )}
      {value !== null && !used && !hasMoves && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#f5efe4] dark:bg-[#1e242b] border border-[#cbbda8] dark:border-[#475569] text-[10px] font-medium text-[#6b5d4f] dark:text-[#cbd5e1] whitespace-nowrap">
          нет хода
        </span>
      )}
    </button>
  );
};

const PlayerIdentityHeader: React.FC<{
  player: Player;
  canEdit?: boolean;
  onUpdateName: (playerId: number, name: string) => void;
  onUpdateAvatar: (playerId: number, avatar: string) => void;
}> = ({ player, canEdit = true, onUpdateName, onUpdateAvatar }) => {
  const theme = PLAYER_THEMES[player.color];
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(player.name);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);

  useEffect(() => {
    setDraftName(player.name);
    setIsEditingName(false);
    setIsAvatarOpen(false);
  }, [player.id, player.name]);

  useEffect(() => {
    if (!isAvatarOpen) return;
    const close = () => setIsAvatarOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [isAvatarOpen]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== player.name) {
      onUpdateName(player.id, trimmed);
    } else {
      setDraftName(player.name);
    }
    setIsEditingName(false);
  };

  return (
    <div className="relative flex items-center gap-2.5 min-w-0">
      <button
        type="button"
        disabled={!canEdit}
        onClick={(e) => {
          if (!canEdit) return;
          e.stopPropagation();
          setIsAvatarOpen((prev) => !prev);
        }}
        title={canEdit ? 'Нажмите для выбора аватарки' : undefined}
        aria-label={`Аватарка игрока ${player.name}`}
        className={`w-10 h-10 rounded-xl bg-[#f3ede2] dark:bg-[#14181d] border-2 flex items-center justify-center text-lg shrink-0 shadow-xs transition-transform ${
          canEdit ? 'cursor-pointer hover:scale-105' : 'cursor-default'
        }`}
        style={{ borderColor: theme.fill }}
      >
        {player.avatar}
      </button>

      <div className="min-w-0 flex-1">
        {canEdit && isEditingName ? (
          <input
            type="text"
            autoFocus
            maxLength={14}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitName();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraftName(player.name);
                setIsEditingName(false);
              }
            }}
            onBlur={commitName}
            aria-label={`Имя игрока ${theme.name}`}
            className="w-full bg-transparent border-b border-amber-500 font-display font-bold text-base sm:text-lg leading-tight text-[#1f1a16] dark:text-[#f8fafc] outline-none p-0"
          />
        ) : canEdit ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsAvatarOpen(false);
              setDraftName(player.name);
              setIsEditingName(true);
            }}
            title="Нажмите на имя для редактирования"
            className="block max-w-full text-left font-display font-bold text-base sm:text-lg leading-tight text-[#1f1a16] dark:text-[#f8fafc] truncate cursor-text hover:underline decoration-amber-500/60 underline-offset-2"
          >
            {player.name}
          </button>
        ) : (
          <div className="block max-w-full text-left font-display font-bold text-base sm:text-lg leading-tight text-[#1f1a16] dark:text-[#f8fafc] truncate">
            {player.name}
          </div>
        )}
        <div className="text-xs font-medium text-[#7a6d5f] dark:text-[#94a3b8] leading-tight mt-0.5">
          {theme.name}
        </div>
      </div>

      {isAvatarOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-[calc(100%+6px)] z-30 p-2 rounded-xl bg-[#faf6ee] dark:bg-[#1f262f] border border-[#cbbda8] dark:border-[#3b4554] shadow-xl grid grid-cols-5 gap-1.5 w-[220px]"
        >
          {PLAYER_AVATARS.map((emoji) => {
            const selected = player.avatar === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onUpdateAvatar(player.id, emoji);
                  setIsAvatarOpen(false);
                }}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center cursor-pointer transition-colors ${
                  selected
                    ? 'bg-amber-500/25 border border-amber-500'
                    : 'hover:bg-[#ece4d5] dark:hover:bg-[#2b3440]'
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const DiceTray: React.FC<DiceTrayProps> = ({
  state,
  isRolling,
  isTransitioningTurn,
  turnHighlightKey,
  hasAnyMoves,
  dieHasMoves,
  selectedTokenId,
  selectedTokenMoves,
  hoveredMoveId,
  isOnlineMode = false,
  isMyTurn = true,
  isHost = true,
  myPlayerId = null,
  onRollDraw,
  onStartFromDraw,
  onRoll,
  onSelectDie,
  onEndTurn,
  onSelectMove,
  onHoverMove,
  onUpdatePlayerName,
  onUpdatePlayerAvatar,
}) => {
  const activePlayer = state.compensation
    ? state.players.find((p) => p.id === state.compensation!.benefactorId)!
    : state.players[state.currentPlayerIndex];
  const theme = PLAYER_THEMES[activePlayer.color];
  const isTripleDouble = state.doublesStreak >= 3 && state.dice !== null;
  const canEditPlayer = (pid: number) => !isOnlineMode || myPlayerId === pid;

  // Phase: Pre-game Draw ("Жребий")
  if (state.phase === 'DRAW' && state.draw) {
    const draw = state.draw;
    const currentContenderId = draw.contenderIds[draw.currentContenderPos];
    const currentContender =
      state.players.find((p) => p.id === currentContenderId) ?? activePlayer;
    const drawWinner =
      draw.winnerId !== null ? state.players.find((p) => p.id === draw.winnerId) ?? null : null;
    const rolledEntries = Object.values(draw.rolls);
    const latestRoll =
      draw.status === 'ROLLING'
        ? draw.currentContenderPos > 0
          ? draw.rolls[draw.contenderIds[draw.currentContenderPos - 1]] ?? null
          : null
        : rolledEntries.length > 0
        ? rolledEntries[rolledEntries.length - 1]
        : null;
    const displayedDrawPlayer = drawWinner ?? currentContender;

    return (
      <div
        key={`draw-${currentContender.id}-${draw.round}`}
        className="rounded-xl bg-[#faf6ee] dark:bg-[#1b2026] border border-amber-500/70 p-4 space-y-3.5 shadow-sm transition-all duration-300 animate-turn-handoff"
      >
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <Dices className="w-3.5 h-3.5 shrink-0" />
            <span>
              Жребий первого хода · Раунд {draw.round}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <PlayerIdentityHeader
                player={displayedDrawPlayer}
                canEdit={canEditPlayer(displayedDrawPlayer.id)}
                onUpdateName={onUpdatePlayerName}
                onUpdateAvatar={onUpdatePlayerAvatar}
              />
            </div>

            {draw.status === 'ROLLING' && isMyTurn && (
              <button
                type="button"
                onClick={onRollDraw}
                disabled={isRolling}
                className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-[#1c140e] font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Dices className="w-4 h-4 shrink-0" />
                <span>Бросить кубик для жребия</span>
              </button>
            )}

            {draw.status === 'WINNER_PAUSE' && drawWinner && (!isOnlineMode || isHost) && (
              <button
                type="button"
                onClick={onStartFromDraw}
                className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span>Начать игру</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DieFace
            value={latestRoll}
            used={false}
            selected={draw.status === 'WINNER_PAUSE'}
            rolling={isRolling}
            hasMoves={true}
            goldenGlow={draw.status === 'WINNER_PAUSE'}
          />

          <div className="flex-1 min-w-0">
            {draw.status === 'ROLLING' && (
              <p className="text-xs text-[#54493e] dark:text-[#cbd5e1] leading-snug">
                {isOnlineMode && !isMyTurn
                  ? `Ожидаем бросок игрока ${currentContender.name}...`
                  : draw.round > 1 && draw.tiedMaxScore
                  ? `Ничья (${draw.tiedMaxScore})! Переброс только среди лидеров.`
                  : 'У кого выпадет больше, тот ходит первым.'}
              </p>
            )}
            {draw.status === 'TIE_PAUSE' && (
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 leading-snug">
                Совпал максимум ({draw.tiedMaxScore})! Готовим повторный раунд жребия...
              </p>
            )}
            {draw.status === 'WINNER_PAUSE' && drawWinner && (
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-start gap-1.5 leading-snug">
                <Trophy className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Первым ходит {drawWinner.name}! Начинаем партию...
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-[#e6dccb] dark:border-[#262d36] space-y-1.5">
          {draw.contenderIds.map((cid, pos) => {
            const p = state.players.find((pl) => pl.id === cid);
            if (!p) return null;
            const pTheme = PLAYER_THEMES[p.color];
            const rolled = draw.rolls[cid];
            const isCurrent = draw.status === 'ROLLING' && pos === draw.currentContenderPos;
            const isWin = draw.winnerId === cid;
            return (
              <div
                key={cid}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  isWin
                    ? 'bg-emerald-500/15 border border-emerald-500/50'
                    : isCurrent
                    ? 'bg-amber-500/15 border border-amber-500/45'
                    : 'bg-[#f3ede2]/80 dark:bg-[#14181d]/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span>{p.avatar}</span>
                  <span className="font-semibold text-[#1f1a16] dark:text-[#f8fafc] truncate">
                    {p.name}
                  </span>
                  <span className="text-[11px] text-[#7a6d5f] dark:text-[#94a3b8]">
                    {pTheme.name}
                  </span>
                </div>
                <span className="font-mono font-bold tabular-nums text-[#29221c] dark:text-[#e2e8f0] shrink-0">
                  {rolled !== undefined ? rolled : isCurrent ? 'бросает...' : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (state.compensation) {
    return (
      <div className="rounded-xl bg-[#faf6ee] dark:bg-[#1b2026] border border-amber-500/70 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Компенсация за выкуп</span>
            </div>
            <PlayerIdentityHeader
              player={activePlayer}
              canEdit={canEditPlayer(activePlayer.id)}
              onUpdateName={onUpdatePlayerName}
              onUpdateAvatar={onUpdatePlayerAvatar}
            />
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 font-mono text-sm font-bold tabular-nums text-amber-700 dark:text-amber-300 shrink-0">
            6 шагов
          </div>
        </div>

        <p className="text-xs text-[#635648] dark:text-[#94a3b8] leading-relaxed">
          {isMyTurn ? (
            <>
              Необходимо пройти ровно <strong>6 шагов</strong> одной фишкой по полю (без препятствий и перелёта). Нажмите на фишку для предпросмотра маршрута и подтвердите ход.
            </>
          ) : (
            <>
              Ожидаем, пока <strong>{activePlayer.name}</strong> разыграет бонусные 6 шагов за выкуп.
            </>
          )}
        </p>

        {isMyTurn && selectedTokenId && selectedTokenMoves.length > 0 && (
          <div className="pt-2 border-t border-[#e2d8c7] dark:border-[#2c3440] space-y-1.5">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Подтвердите ход:</div>
            <div className="flex flex-wrap gap-2">
              {selectedTokenMoves.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMove(m)}
                  onMouseEnter={() => onHoverMove(m.id)}
                  onMouseLeave={() => onHoverMove(null)}
                  onFocus={() => onHoverMove(m.id)}
                  onBlur={() => onHoverMove(null)}
                  className={`px-3 py-2 min-h-[40px] rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    hoveredMoveId === m.id
                      ? 'bg-amber-500/30 border-amber-500 text-amber-950 dark:text-amber-100 ring-2 ring-amber-400/50'
                      : 'bg-amber-500/15 border-amber-500/60 text-amber-900 dark:text-amber-200 hover:bg-amber-500/25'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      key={`turn-tray-${turnHighlightKey}`}
      className={`rounded-xl bg-[#faf6ee] dark:bg-[#1b2026] border p-4 space-y-3.5 shadow-sm transition-all duration-500 ${
        turnHighlightKey > 0 ? 'animate-turn-handoff' : ''
      } ${
        isTripleDouble
          ? 'border-amber-400 dark:border-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.2)]'
          : state.phase === 'ROLL' && !isTransitioningTurn
          ? 'border-amber-500/65 dark:border-amber-400/55'
          : 'border-[#d6c9b4] dark:border-[#2d3540]'
      }`}
    >
      <div className="space-y-1.5">
        <div className="text-[11px] text-[#7a6d5f] dark:text-[#94a3b8] flex items-center gap-1.5 flex-wrap">
          <span>
            Ход #{state.turnNumber} · {theme.armLabel}
          </span>
          {state.doublesStreak > 0 && (
            <span className="text-amber-700 dark:text-amber-300 font-semibold inline-flex items-center gap-1">
              <span>· Дубли: {state.doublesStreak}/3</span>
              {isTripleDouble && <Star className="w-3 h-3 fill-current" />}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <PlayerIdentityHeader
              player={activePlayer}
              canEdit={canEditPlayer(activePlayer.id)}
              onUpdateName={onUpdatePlayerName}
              onUpdateAvatar={onUpdatePlayerAvatar}
            />
          </div>

          {state.phase === 'ROLL' && isMyTurn && (
            <button
              type="button"
              onClick={onRoll}
              disabled={isRolling || isTransitioningTurn}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-[#1c140e] font-display font-bold text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Dices className="w-4 h-4" />
              <span>{state.doublesStreak > 0 ? 'Доп. бросок' : 'Бросить кубики'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-1">
        <div
          className={`flex items-center gap-3 ${
            isTripleDouble ? 'p-1.5 -m-1.5 rounded-2xl bg-amber-400/12' : ''
          }`}
        >
          {([0, 1] as const).map((idx) => {
            const val = state.dice ? state.dice[idx] : null;
            const used = state.diceUsed[idx];
            const selected = isMyTurn && state.selectedDieIndex === idx && !used;
            return (
              <DieFace
                key={idx}
                value={val}
                used={used}
                selected={selected}
                rolling={isRolling}
                goldenGlow={isTripleDouble}
                hasMoves={
                  !isMyTurn ||
                  isTransitioningTurn ||
                  state.phase === 'TRIPLE_DOUBLE_BONUS' ||
                  val === null ||
                  used ||
                  dieHasMoves[idx]
                }
                onClick={
                  isMyTurn && !used && val !== null && state.phase === 'MOVE' && !isTransitioningTurn
                    ? () => onSelectDie(idx)
                    : undefined
                }
              />
            );
          })}
        </div>

        <div className="flex-1 text-right">
          {isTransitioningTurn && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300 leading-snug">
              Завершение хода...
            </p>
          )}

          {!isTransitioningTurn && isOnlineMode && !isMyTurn && (
            <p className="text-xs text-[#6d6052] dark:text-[#94a3b8] leading-snug">
              Сейчас ходит <strong>{activePlayer.name}</strong>. Ожидайте своей очереди...
            </p>
          )}

          {!isTransitioningTurn && isMyTurn && state.phase === 'ROLL' && (
            <p className="text-xs text-[#6d6052] dark:text-[#94a3b8] leading-snug">
              {state.doublesStreak > 0
                ? 'Выпал дубль — бросайте кубики ещё раз!'
                : 'Нажмите «Бросить кубики», чтобы начать ход.'}
            </p>
          )}

          {!isTransitioningTurn && isMyTurn && state.phase === 'TRIPLE_DOUBLE_BONUS' && (
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-snug">
              Супер-бонус ★: выберите любую фишку на поле для отправки на ФИНИШ!
            </p>
          )}

          {!isTransitioningTurn && isMyTurn && state.phase === 'MOVE' && hasAnyMoves && !selectedTokenId && (
            <p
              className={`text-xs leading-snug ${
                isTripleDouble
                  ? 'text-amber-800 dark:text-amber-300 font-medium'
                  : 'text-[#54493e] dark:text-[#cbd5e1]'
              }`}
            >
              {isTripleDouble
                ? '3-й дубль! Сначала походите кубиками, затем сработает супер-бонус на ФИНИШ.'
                : 'Нажмите на подсвеченную фишку для предпросмотра маршрута.'}
            </p>
          )}

          {!isTransitioningTurn && isMyTurn && state.phase === 'MOVE' && hasAnyMoves && selectedTokenId && (
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-snug">
              {selectedTokenMoves.length === 1
                ? 'Нажмите на конечную клетку или повторно на фишку.'
                : 'Выберите конечную клетку маршрута на доске или ниже.'}
            </p>
          )}

          {!isTransitioningTurn && isMyTurn && state.phase === 'MOVE' && !hasAnyMoves && (
            <div className="space-y-2">
              {isTripleDouble ? (
                <>
                  <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Ходов кубиками нет — переход к Супер-бонусу ★
                  </div>
                  <button
                    type="button"
                    onClick={onEndTurn}
                    className="px-3.5 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1c140e] font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>Выбрать фишку на ФИНИШ</span>
                  </button>
                </>
              ) : state.doublesStreak > 0 && state.doublesStreak < 3 ? (
                <>
                  <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Ходов нет — за дубль положен повторный бросок
                  </div>
                  <button
                    type="button"
                    onClick={onEndTurn}
                    className="px-3.5 py-2 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1c140e] font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Повторный бросок</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                    Нет доступных ходов — кубики сгорают
                  </div>
                  <button
                    type="button"
                    onClick={onEndTurn}
                    className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#efe8dc] dark:bg-[#252c35] hover:bg-[#e5dccb] dark:hover:bg-[#2f3844] border border-[#cbbda8] dark:border-[#475569] text-[#29221c] dark:text-[#f8fafc] font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Завершить ход</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!isTransitioningTurn &&
        isMyTurn &&
        state.phase === 'TRIPLE_DOUBLE_BONUS' &&
        selectedTokenId &&
        selectedTokenMoves.length > 0 && (
          <div className="pt-2.5 border-t border-[#e2d8c7] dark:border-[#2c3440]">
            <button
              type="button"
              onClick={() => onSelectMove(selectedTokenMoves[0])}
              onMouseEnter={() => onHoverMove(selectedTokenMoves[0].id)}
              onMouseLeave={() => onHoverMove(null)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-sm cursor-pointer transition-colors"
            >
              {selectedTokenMoves[0].label}
            </button>
          </div>
        )}

      {!isTransitioningTurn &&
        isMyTurn &&
        state.phase === 'MOVE' &&
        selectedTokenId &&
        selectedTokenMoves.length > 0 && (
          <div className="pt-2.5 border-t border-[#e2d8c7] dark:border-[#2c3440] space-y-1.5">
            <div className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Варианты хода выбранной фишки:
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedTokenMoves.map((m) => {
                const isHovered = hoveredMoveId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMove(m)}
                    onMouseEnter={() => onHoverMove(m.id)}
                    onMouseLeave={() => onHoverMove(null)}
                    onFocus={() => onHoverMove(m.id)}
                    onBlur={() => onHoverMove(null)}
                    className={`px-3 py-2 min-h-[40px] rounded-lg border text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                      m.capturesEnemyIds.length > 0
                        ? isHovered
                          ? 'bg-red-500/30 border-red-500 text-red-950 dark:text-red-100 ring-2 ring-red-400/50'
                          : 'bg-red-500/15 border-red-500/60 text-red-800 dark:text-red-200 hover:bg-red-500/25'
                        : m.kind.startsWith('SHORTCUT')
                        ? isHovered
                          ? 'bg-sky-500/30 border-sky-500 text-sky-950 dark:text-sky-100 ring-2 ring-sky-400/50'
                          : 'bg-sky-500/15 border-sky-500/60 text-sky-900 dark:text-sky-200 hover:bg-sky-500/25'
                        : m.usesBothDice
                        ? isHovered
                          ? 'bg-emerald-500/30 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-400/50'
                          : 'bg-emerald-500/15 border-emerald-500/60 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-500/25'
                        : isHovered
                        ? 'bg-amber-500/30 border-amber-500 text-amber-950 dark:text-amber-100 ring-2 ring-amber-400/50'
                        : 'bg-amber-500/15 border-amber-500/60 text-amber-900 dark:text-amber-200 hover:bg-amber-500/25'
                    }`}
                  >
                    <span>{m.label}</span>
                    {m.usesBothDice && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600/20 dark:bg-emerald-400/20 text-[10px] font-bold uppercase tracking-wide">
                        2 куб.
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
};
