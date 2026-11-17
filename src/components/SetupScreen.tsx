import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Globe,
  MonitorSmartphone,
  Moon,
  Play,
  Plus,
  Sun,
  Users,
} from 'lucide-react';
import {
  DEFAULT_AVATAR_BY_COLOR,
  PLAYER_AVATARS,
  PLAYER_THEMES,
  PlayerColorId,
} from '../types/game';

interface SetupScreenProps {
  themeMode: 'light' | 'dark';
  onToggleTheme: (mode: 'light' | 'dark') => void;
  onStartGame: (
    playerCount: 2 | 3 | 4,
    names: Partial<Record<PlayerColorId, string>>,
    avatars: Partial<Record<PlayerColorId, string>>
  ) => void;
  onCreateOnlineRoom: () => void;
  onJoinOnlineRoom: (roomCode: string) => void;
  onlineBusy: boolean;
  onlineError: string | null;
  onOpenRules: () => void;
}

const SLOTS_PREVIEW: Record<2 | 3 | 4, PlayerColorId[]> = {
  2: ['blue', 'green'],
  3: ['blue', 'yellow', 'green'],
  4: ['blue', 'yellow', 'green', 'red'],
};

export const SetupScreen: React.FC<SetupScreenProps> = ({
  themeMode,
  onToggleTheme,
  onStartGame,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onlineBusy,
  onlineError,
  onOpenRules,
}) => {
  const [modeTab, setModeTab] = useState<'online' | 'local'>('online');
  const [roomCodeInput, setRoomCodeInput] = useState('');

  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [names, setNames] = useState<Record<PlayerColorId, string>>({
    blue: 'Игрок 1',
    yellow: 'Игрок 2',
    green: 'Игрок 3',
    red: 'Игрок 4',
  });
  const [avatars, setAvatars] = useState<Record<PlayerColorId, string>>({
    ...DEFAULT_AVATAR_BY_COLOR,
  });
  const [openPaletteColor, setOpenPaletteColor] = useState<PlayerColorId | null>(null);

  const activeColors = SLOTS_PREVIEW[playerCount];

  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartGame(playerCount, names, avatars);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoinOnlineRoom(roomCodeInput);
  };

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4 sm:p-6 bg-[#ebe3d5] dark:bg-[#12100e] transition-colors"
      onClick={() => {
        if (openPaletteColor) setOpenPaletteColor(null);
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#faf6ee] dark:bg-[#1b2026] border border-[#d6c9b4] dark:border-[#2d3540] shadow-xl p-6 sm:p-8 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Настольная игра · Онлайн-комнаты и Pass & Play
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#1f1a16] dark:text-[#f8fafc] tracking-tight text-balance">
              Дворовый Парчис
            </h1>
          </div>

          <div className="flex items-center p-1 rounded-lg bg-[#ece4d5] dark:bg-[#14181d] border border-[#d6c9b4] dark:border-[#2d3540] shrink-0">
            <button
              type="button"
              onClick={() => onToggleTheme('light')}
              aria-label="Светлая тема"
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                themeMode === 'light'
                  ? 'bg-white text-[#1f1a16] shadow-xs'
                  : 'text-[#6d6052] dark:text-[#94a3b8]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Светлая</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleTheme('dark')}
              aria-label="Тёмная тема"
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                themeMode === 'dark'
                  ? 'bg-[#2a323d] text-[#f8fafc] shadow-xs'
                  : 'text-[#6d6052] dark:text-[#94a3b8]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Тёмная</span>
            </button>
          </div>
        </div>

        <p className="text-sm text-[#5c5044] dark:text-[#94a3b8] leading-relaxed">
          Классическая доска со срезками через центр, «Домиками», тюрьмой, выкупом пленных и предпросмотром маршрута.
        </p>

        {/* Mode Selector: Online vs Local Pass & Play */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-[#ece4d5] dark:bg-[#14181d] border border-[#d6c9b4] dark:border-[#2d3540]">
          <button
            type="button"
            onClick={() => setModeTab('online')}
            className={`min-h-[46px] px-3 py-2 rounded-lg font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              modeTab === 'online'
                ? 'bg-amber-500 text-[#1c140e] shadow-sm'
                : 'text-[#5c5044] dark:text-[#94a3b8] hover:text-[#1f1a16] dark:hover:text-[#f8fafc]'
            }`}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span>Игра по сети</span>
          </button>

          <button
            type="button"
            onClick={() => setModeTab('local')}
            className={`min-h-[46px] px-3 py-2 rounded-lg font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              modeTab === 'local'
                ? 'bg-amber-500 text-[#1c140e] shadow-sm'
                : 'text-[#5c5044] dark:text-[#94a3b8] hover:text-[#1f1a16] dark:hover:text-[#f8fafc]'
            }`}
          >
            <MonitorSmartphone className="w-4 h-4 shrink-0" />
            <span>На одном устройстве</span>
          </button>
        </div>

        {modeTab === 'online' ? (
          <div className="space-y-4">
            {onlineError && (
              <div className="rounded-xl bg-red-500/12 border border-red-500/45 px-4 py-2.5 text-xs sm:text-sm font-medium text-red-800 dark:text-red-200">
                {onlineError}
              </div>
            )}

            <div className="rounded-xl bg-[#f3ede2] dark:bg-[#14181d] border border-[#d6c9b4] dark:border-[#2d3540] p-4 space-y-3">
              <div className="text-xs font-semibold text-[#54493e] dark:text-[#cbd5e1]">
                Создайте новую онлайн-комнату и пригласите друзей по коду или ссылке
              </div>
              <button
                type="button"
                disabled={onlineBusy}
                onClick={onCreateOnlineRoom}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-[#1c140e] font-display font-bold text-base flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                <span>{onlineBusy ? 'Подключение...' : 'Создать комнату'}</span>
              </button>
            </div>

            <form
              onSubmit={handleJoinSubmit}
              className="rounded-xl bg-[#f3ede2] dark:bg-[#14181d] border border-[#d6c9b4] dark:border-[#2d3540] p-4 space-y-3"
            >
              <label
                htmlFor="room-code-input"
                className="block text-xs font-semibold text-[#54493e] dark:text-[#cbd5e1]"
              >
                Или войдите по 4-значному коду комнаты
              </label>
              <div className="flex gap-2">
                <input
                  id="room-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={roomCodeInput}
                  onChange={(e) =>
                    setRoomCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="4821"
                  className="flex-1 min-w-0 min-h-[46px] px-4 rounded-xl bg-[#faf6ee] dark:bg-[#1b2026] border border-[#cbbda8] dark:border-[#343d48] font-mono text-xl font-bold tracking-[0.25em] text-center text-[#1f1a16] dark:text-[#f8fafc] placeholder:text-[#9c8c78] focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={onlineBusy || roomCodeInput.length !== 4}
                  className="min-h-[46px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#d8cebe] dark:disabled:bg-[#2a313b] disabled:text-[#8a7a68] dark:disabled:text-[#64748b] text-white font-display font-bold text-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                >
                  <span>Войти по коду</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onOpenRules}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#efe8dc] dark:bg-[#252c35] hover:bg-[#e5dccb] dark:hover:bg-[#2f3844] border border-[#cbbda8] dark:border-[#3b4554] text-[#29221c] dark:text-[#f8fafc] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Правила</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLocalSubmit} className="space-y-5">
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-[#54493e] dark:text-[#cbd5e1] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Количество игроков (Pass & Play)</span>
              </label>
              <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-[#ece4d5] dark:bg-[#14181d] border border-[#d6c9b4] dark:border-[#2d3540]">
                {([2, 3, 4] as const).map((count) => {
                  const active = playerCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setPlayerCount(count)}
                      className={`min-h-[44px] rounded-lg font-display font-bold text-sm transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-500 text-[#1c140e] shadow-sm'
                          : 'text-[#5c5044] dark:text-[#94a3b8] hover:text-[#1f1a16] dark:hover:text-[#f8fafc]'
                      }`}
                    >
                      {count} игрока
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-[#54493e] dark:text-[#cbd5e1]">
                Участники (имя и аватарка · по 5 фишек)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeColors.map((colorId) => {
                  const theme = PLAYER_THEMES[colorId];
                  const isOpen = openPaletteColor === colorId;
                  return (
                    <div
                      key={colorId}
                      onClick={(e) => e.stopPropagation()}
                      className="relative flex items-center gap-2.5 rounded-xl bg-[#f3ede2] dark:bg-[#14181d] border border-[#d6c9b4] dark:border-[#2d3540] px-2.5 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenPaletteColor(isOpen ? null : colorId)}
                        aria-label={`Выбрать аватарку (${theme.name})`}
                        title="Нажмите для выбора аватарки"
                        className="w-10 h-10 rounded-xl bg-[#faf6ee] dark:bg-[#1e242c] border-2 flex items-center justify-center text-xl shrink-0 cursor-pointer hover:scale-105 transition-transform shadow-xs"
                        style={{ borderColor: theme.fill }}
                      >
                        {avatars[colorId]}
                      </button>

                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          maxLength={14}
                          value={names[colorId]}
                          onChange={(e) =>
                            setNames((prev) => ({ ...prev, [colorId]: e.target.value }))
                          }
                          aria-label={`Имя игрока (${theme.name})`}
                          className="w-full bg-transparent text-sm font-semibold text-[#1f1a16] dark:text-[#f8fafc] focus:outline-none placeholder:text-[#8a7a68]"
                          placeholder={theme.name}
                        />
                        <div className="text-[11px] text-[#7a6d5f] dark:text-[#94a3b8] flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: theme.fill }}
                          />
                          <span>{theme.name}</span>
                          <span className="opacity-65">· {theme.armLabel}</span>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="absolute left-0 top-[calc(100%+6px)] z-30 p-2 rounded-xl bg-[#faf6ee] dark:bg-[#1f262f] border border-[#cbbda8] dark:border-[#3b4554] shadow-xl grid grid-cols-5 gap-1.5 w-[220px]">
                          {PLAYER_AVATARS.map((emoji) => {
                            const selected = avatars[colorId] === emoji;
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  setAvatars((prev) => ({ ...prev, [colorId]: emoji }));
                                  setOpenPaletteColor(null);
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
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="submit"
                className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-[#1c140e] font-display font-bold text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Начать игру</span>
              </button>

              <button
                type="button"
                onClick={onOpenRules}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-[#efe8dc] dark:bg-[#252c35] hover:bg-[#e5dccb] dark:hover:bg-[#2f3844] border border-[#cbbda8] dark:border-[#3b4554] text-[#29221c] dark:text-[#f8fafc] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Правила</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
