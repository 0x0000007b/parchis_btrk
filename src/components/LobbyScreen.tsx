import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Crown,
  Lock,
  LogOut,
  Moon,
  Play,
  Sun,
  Users,
} from 'lucide-react';
import { PLAYER_AVATARS, PLAYER_THEMES, PlayerColorId } from '../types/game';
import { COLOR_SLOTS_ORDER, RoomDocument, RoomPlayerSlot } from '../types/online';

interface LobbyScreenProps {
  roomDoc: RoomDocument;
  myClientId: string;
  themeMode: 'light' | 'dark';
  isBusy: boolean;
  errorMessage: string | null;
  onToggleTheme: (mode: 'light' | 'dark') => void;
  onOpenRules: () => void;
  onSwitchColor: (color: PlayerColorId) => void;
  onUpdateProfile: (updates: { name?: string; avatar?: string }) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  roomDoc,
  myClientId,
  themeMode,
  isBusy,
  errorMessage,
  onToggleTheme,
  onOpenRules,
  onSwitchColor,
  onUpdateProfile,
  onStartMatch,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const mySlot: RoomPlayerSlot | null =
    COLOR_SLOTS_ORDER.map((c) => roomDoc.slots[c]).find(
      (s): s is RoomPlayerSlot => Boolean(s && s.clientId === myClientId)
    ) ?? null;

  const [draftName, setDraftName] = useState(mySlot?.name ?? '');

  useEffect(() => {
    if (mySlot) {
      setDraftName(mySlot.name);
    }
  }, [mySlot?.color, mySlot?.name]);

  useEffect(() => {
    if (!avatarPickerOpen) return;
    const close = () => setAvatarPickerOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [avatarPickerOpen]);

  const occupiedCount = COLOR_SLOTS_ORDER.filter((c) => Boolean(roomDoc.slots[c])).length;
  const isHost = roomDoc.hostClientId === myClientId;
  const canStart = isHost && occupiedCount >= 2 && occupiedCount <= 4 && !isBusy;

  const handleCopyInvite = async () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomDoc.roomId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback copy via temporary input
      const input = document.createElement('input');
      input.value = inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const commitName = () => {
    if (!mySlot) return;
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== mySlot.name) {
      onUpdateProfile({ name: trimmed });
    } else if (!trimmed) {
      setDraftName(mySlot.name);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#ebe3d5] dark:bg-[#12100e] text-[#1f1a16] dark:text-[#f3efe9] transition-colors">
      <header className="border-b border-[#d6c9b4] dark:border-[#2a2f38] bg-[#f7f2e8]/95 dark:bg-[#181b20]/95 backdrop-blur-xs">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 h-13 flex items-center justify-between gap-3">
          <div className="font-display font-extrabold text-base sm:text-lg tracking-tight text-[#1f1a16] dark:text-[#f8fafc] whitespace-nowrap">
            Дворовый Парчис · Лобби
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center p-0.5 rounded-lg bg-[#e7dfd1] dark:bg-[#121519] border border-[#d6c9b4] dark:border-[#2d3540]">
              <button
                type="button"
                onClick={() => onToggleTheme('light')}
                aria-label="Светлая тема"
                className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  themeMode === 'light'
                    ? 'bg-white text-[#1f1a16] shadow-xs'
                    : 'text-[#6d6052] dark:text-[#94a3b8]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onToggleTheme('dark')}
                aria-label="Тёмная тема"
                className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  themeMode === 'dark'
                    ? 'bg-[#2a323d] text-[#f8fafc] shadow-xs'
                    : 'text-[#6d6052] dark:text-[#94a3b8]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenRules}
              className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#efe8dc] dark:bg-[#222830] hover:bg-[#e5dccb] dark:hover:bg-[#2c343f] border border-[#d6c9b4] dark:border-[#343d48] text-xs font-semibold text-[#29221c] dark:text-[#f8fafc] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Правила</span>
            </button>

            <button
              type="button"
              onClick={onLeaveRoom}
              className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#efe8dc] dark:bg-[#222830] hover:bg-red-500/15 border border-[#d6c9b4] dark:border-[#343d48] hover:border-red-500/50 text-xs font-semibold text-[#29221c] dark:text-[#f8fafc] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти из комнаты</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl rounded-2xl bg-[#faf6ee] dark:bg-[#1b2026] border border-[#d6c9b4] dark:border-[#2d3540] shadow-xl p-5 sm:p-7 space-y-6">
          {/* Room Code + Invite Copy */}
          <div className="rounded-xl bg-[#f3ede2] dark:bg-[#14181d] border border-[#d6c9b4] dark:border-[#2d3540] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#7a6d5f] dark:text-[#94a3b8] uppercase tracking-wider">
                Код комнаты
              </div>
              <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-[0.18em] text-[#1f1a16] dark:text-[#f8fafc] tabular-nums">
                {roomDoc.roomId}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyInvite}
              className={`min-h-[46px] px-4 py-2.5 rounded-xl font-display font-bold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-amber-500 hover:bg-amber-400 text-[#1c140e] shadow-sm'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Ссылка скопирована!' : 'Скопировать ссылку-приглашение'}</span>
            </button>
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-red-500/12 border border-red-500/45 px-4 py-2.5 text-xs sm:text-sm font-medium text-red-800 dark:text-red-200">
              {errorMessage}
            </div>
          )}

          {/* 4 Color Slots */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#54493e] dark:text-[#cbd5e1] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Выберите цвет луча, имя и аватарку</span>
              </div>
              <span className="text-xs font-mono font-bold tabular-nums text-[#7a6d5f] dark:text-[#94a3b8]">
                {occupiedCount} / 4 игроков
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COLOR_SLOTS_ORDER.map((colorId) => {
                const theme = PLAYER_THEMES[colorId];
                const slot = roomDoc.slots[colorId];
                const isMine = Boolean(slot && slot.clientId === myClientId);
                const isTakenByOther = Boolean(slot && !isMine);

                if (isMine && slot) {
                  return (
                    <div
                      key={colorId}
                      onClick={(e) => e.stopPropagation()}
                      className="relative rounded-xl bg-[#fffdf8] dark:bg-[#222933] border-2 p-3.5 space-y-2 shadow-xs"
                      style={{ borderColor: theme.fill }}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="inline-flex items-center gap-1.5 text-[#54493e] dark:text-[#cbd5e1]">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: theme.fill }}
                          />
                          {theme.name} · {theme.armLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                          {slot.isHost && <Crown className="w-3.5 h-3.5" />}
                          <span>Вы{slot.isHost ? ' · Хост' : ''}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAvatarPickerOpen((prev) => !prev);
                          }}
                          title="Нажмите для выбора аватарки"
                          className="w-11 h-11 rounded-xl bg-[#f3ede2] dark:bg-[#14181d] border-2 flex items-center justify-center text-xl shrink-0 cursor-pointer hover:scale-105 transition-transform"
                          style={{ borderColor: theme.fill }}
                        >
                          {slot.avatar}
                        </button>

                        <input
                          type="text"
                          maxLength={14}
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={commitName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitName();
                            }
                          }}
                          placeholder="Ваше имя"
                          aria-label="Ваше имя в комнате"
                          className="w-full min-w-0 px-2.5 py-2 rounded-lg bg-[#f3ede2] dark:bg-[#14181d] border border-[#d6c9b4] dark:border-[#343d48] text-sm font-semibold text-[#1f1a16] dark:text-[#f8fafc] focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {avatarPickerOpen && (
                        <div className="absolute left-3 top-[calc(100%+4px)] z-30 p-2 rounded-xl bg-[#faf6ee] dark:bg-[#1f262f] border border-[#cbbda8] dark:border-[#3b4554] shadow-xl grid grid-cols-5 gap-1.5 w-[220px]">
                          {PLAYER_AVATARS.map((emoji) => {
                            const selected = slot.avatar === emoji;
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  onUpdateProfile({ avatar: emoji });
                                  setAvatarPickerOpen(false);
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
                }

                if (isTakenByOther && slot) {
                  return (
                    <div
                      key={colorId}
                      className="rounded-xl bg-[#efe8dc]/80 dark:bg-[#14181d]/90 border border-[#d6c9b4] dark:border-[#2a313b] p-3.5 space-y-2 opacity-85"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="inline-flex items-center gap-1.5 text-[#54493e] dark:text-[#cbd5e1]">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: theme.fill }}
                          />
                          {theme.name} · {theme.armLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#7a6d5f] dark:text-[#94a3b8]">
                          {slot.isHost ? (
                            <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                          <span>{slot.isHost ? 'Хост' : 'Занято'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-11 h-11 rounded-xl bg-[#faf6ee] dark:bg-[#1b2026] border-2 flex items-center justify-center text-xl shrink-0"
                          style={{ borderColor: theme.fill }}
                        >
                          {slot.avatar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-display font-bold text-sm text-[#1f1a16] dark:text-[#f8fafc] truncate">
                            {slot.name}
                          </div>
                          <div className="text-[11px] text-[#7a6d5f] dark:text-[#94a3b8]">
                            Подключён
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Free slot — clickable to switch to this color
                return (
                  <button
                    key={colorId}
                    type="button"
                    disabled={isBusy}
                    onClick={() => onSwitchColor(colorId)}
                    className="rounded-xl bg-[#f3ede2]/60 dark:bg-[#14181d]/60 hover:bg-[#efe6d6] dark:hover:bg-[#1d232b] border border-dashed border-[#bfa98c] dark:border-[#394452] p-3.5 flex flex-col justify-between gap-2 text-left transition-colors cursor-pointer disabled:opacity-50 min-h-[104px]"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold w-full">
                      <span className="inline-flex items-center gap-1.5 text-[#54493e] dark:text-[#cbd5e1]">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: theme.fill }}
                        />
                        {theme.name} · {theme.armLabel}
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-400">Свободно</span>
                    </div>
                    <div className="text-xs font-semibold text-[#6d6052] dark:text-[#94a3b8]">
                      Нажмите, чтобы занять этот цвет
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start Match Bar */}
          <div className="pt-2 border-t border-[#e2d8c7] dark:border-[#2c3440] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#6d6052] dark:text-[#94a3b8]">
              {isHost
                ? occupiedCount < 2
                  ? 'Пригласите ещё хотя бы 1 игрока по ссылке или коду комнаты.'
                  : 'Всё готово! Нажмите «Начать игру», чтобы запустить жребий.'
                : 'Ожидаем, пока создатель комнаты начнёт игру...'}
            </div>

            {isHost && (
              <button
                type="button"
                disabled={!canStart}
                onClick={onStartMatch}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#d8cebe] dark:disabled:bg-[#2a313b] disabled:text-[#8a7a68] dark:disabled:text-[#64748b] text-white font-display font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Начать игру</span>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
