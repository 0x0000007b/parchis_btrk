import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Globe, LogOut, Moon, RotateCcw, Sun, Volume2, VolumeX } from 'lucide-react';
import { Board } from './components/Board';
import { DiceTray } from './components/DiceTray';
import { LobbyScreen } from './components/LobbyScreen';
import { RulesModal } from './components/RulesModal';
import { SetupScreen } from './components/SetupScreen';
import { VictoryModal } from './components/VictoryModal';
import {
  advanceDrawAfterTie,
  advanceToNextTurn,
  applyMove,
  createInitialGameState,
  getAllLegalMovesForCurrentTurn,
  getAvailableBonusStepCounts,
  getAvailableMovesForSteps,
  getDieHasMoves,
  handleNoMovesRemaining,
  hasAnyLegalMoveForRemainingDice,
  hasPendingEndOfTurnTraps,
  isTurnReadyToAdvance,
  resolveEndOfTurnPrisonAndHouse,
  rollDiceInState,
  rollDrawDieInState,
  startMatchFromDraw,
} from './engine/parchisRules';
import {
  clearOnlineSession,
  createOnlineRoom,
  fetchRoomDocument,
  getOrCreateClientId,
  joinOnlineRoom,
  leaveLobbySlot,
  loadOnlineSession,
  pushOnlineRoomGameState,
  startOnlineMatch,
  subscribeToRoom,
  switchLobbyColor,
  updateLobbyProfile,
} from './services/roomService';
import {
  FINISH_LETTERS,
  GameState,
  MoveOption,
  PLAYER_AVATARS,
  PLAYER_THEMES,
  Player,
  PlayerColorId,
  TokenLocation,
  formatPlayerLabel,
} from './types/game';
import {
  BOARD_ROTATION_BY_COLOR,
  BoardRotationDeg,
  OnlineSession,
  RoomDocument,
} from './types/online';
import { soundFX } from './utils/sound';

function syncUrlRoomParam(roomId: string | null): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (roomId) {
    if (url.searchParams.get('room') === roomId) return;
    url.searchParams.set('room', roomId);
  } else {
    if (!url.searchParams.has('room')) return;
    url.searchParams.delete('room');
  }
  window.history.replaceState({}, '', url.toString());
}

export default function App() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('parchis-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'light';
  });

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomDoc, setRoomDoc] = useState<RoomDocument | null>(null);
  const [onlineSession, setOnlineSession] = useState<OnlineSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(true);
  const [onlineBusy, setOnlineBusy] = useState<boolean>(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [isAnimatingHop, setIsAnimatingHop] = useState(false);
  const [visualLocationOverrides, setVisualLocationOverrides] = useState<
    Record<string, TokenLocation>
  >({});
  const [isTransitioningTurn, setIsTransitioningTurn] = useState(false);
  const [turnHighlightKey, setTurnHighlightKey] = useState(0);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [hoveredMoveId, setHoveredMoveId] = useState<string | null>(null);
  const [sidebarEditNameId, setSidebarEditNameId] = useState<number | null>(null);
  const [sidebarDraftName, setSidebarDraftName] = useState('');
  const [sidebarAvatarPlayerId, setSidebarAvatarPlayerId] = useState<number | null>(null);
  const [selectedBonusSteps, setSelectedBonusSteps] = useState<number>(6);

  const rollTimeoutRef = useRef<number | null>(null);
  const transitionTimeoutsRef = useRef<number[]>([]);
  const roomDocRef = useRef<RoomDocument | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const pushQueueRef = useRef<Promise<void>>(Promise.resolve());

  const myClientId = useMemo(() => getOrCreateClientId(), []);

  useEffect(() => {
    roomDocRef.current = roomDoc;
  }, [roomDoc]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const clearAllTimers = useCallback(() => {
    if (rollTimeoutRef.current) {
      window.clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
    transitionTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    transitionTimeoutsRef.current = [];
  }, []);

  const scheduleTimer = useCallback((fn: () => void, delayMs: number) => {
    const id = window.setTimeout(() => {
      transitionTimeoutsRef.current = transitionTimeoutsRef.current.filter((t) => t !== id);
      fn();
    }, delayMs);
    transitionTimeoutsRef.current.push(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
    window.localStorage.setItem('parchis-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (sidebarAvatarPlayerId === null) return;
    const close = () => setSidebarAvatarPlayerId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [sidebarAvatarPlayerId]);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Helper to commit a new GameState locally and sync to Supabase if in online mode
  const commitGameState = useCallback((next: GameState) => {
    gameStateRef.current = next;
    setGameState(next);

    const currentDoc = roomDocRef.current;
    if (!currentDoc) return;

    const optimisticDoc: RoomDocument = {
      ...currentDoc,
      version: currentDoc.version + 1,
      status: 'PLAYING',
      gameState: next,
    };
    roomDocRef.current = optimisticDoc;
    setRoomDoc(optimisticDoc);

    pushQueueRef.current = pushQueueRef.current
      .then(async () => {
        await pushOnlineRoomGameState(currentDoc, next);
      })
      .catch((err) => {
        setOnlineError(err instanceof Error ? err.message : 'Ошибка синхронизации.');
      });
  }, []);

  const applyIncomingRoomDoc = useCallback(
    (incoming: RoomDocument | null) => {
      if (!incoming) return;
      const currentDoc = roomDocRef.current;
      if (
        currentDoc &&
        currentDoc.roomId === incoming.roomId &&
        incoming.version <= currentDoc.version
      ) {
        return;
      }

      roomDocRef.current = incoming;
      setRoomDoc(incoming);

      // Update playerId in session if player switched colors in lobby or synced
      setOnlineSession((prev) => {
        if (!prev || prev.roomId !== incoming.roomId) return prev;
        const mySlot = Object.values(incoming.slots).find((s) => s?.clientId === prev.clientId);
        if (mySlot && mySlot.playerId !== prev.playerId) {
          return { ...prev, playerId: mySlot.playerId };
        }
        return prev;
      });

      if (incoming.status === 'PLAYING' && incoming.gameState) {
        const nextGame = incoming.gameState;
        const prevGame = gameStateRef.current;

        if (!prevGame) {
          gameStateRef.current = nextGame;
          setGameState(nextGame);
          setTurnHighlightKey((k) => k + 1);
          return;
        }

        // Detect meaningful remote state changes for SFX & smooth House animations
        const prevTopLogId = prevGame.logs[0]?.id;
        const nextTopLog = nextGame.logs[0];
        const hasNewLog = Boolean(nextTopLog && nextTopLog.id !== prevTopLogId);

        const diceJustRolled =
          nextGame.dice !== null &&
          (!prevGame.dice ||
            prevGame.dice[0] !== nextGame.dice[0] ||
            prevGame.dice[1] !== nextGame.dice[1] ||
            (prevGame.phase === 'ROLL' && nextGame.phase === 'MOVE'));
        const drawJustRolled =
          nextGame.phase === 'DRAW' &&
          prevGame.phase === 'DRAW' &&
          JSON.stringify(prevGame.draw?.rolls) !== JSON.stringify(nextGame.draw?.rolls);
        const tokenMoved = nextGame.tokens.some((nt) => {
          const pt = prevGame.tokens.find((t) => t.id === nt.id);
          return pt && JSON.stringify(pt.location) !== JSON.stringify(nt.location);
        });

        if (nextGame.phase === 'GAME_OVER' && prevGame.phase !== 'GAME_OVER') {
          soundFX.playWin();
        } else if (hasNewLog && nextTopLog) {
          if (nextTopLog.type === 'win') {
            soundFX.playWin();
          } else if (nextTopLog.type === 'finish') {
            soundFX.playFinish();
          } else if (nextTopLog.type === 'ransom') {
            soundFX.playRansom();
          } else if (nextTopLog.type === 'capture') {
            soundFX.playCapture();
          } else if (nextTopLog.type === 'prison') {
            soundFX.playPrison();
          } else if (nextTopLog.type === 'house') {
            soundFX.playHouse();
          } else if (diceJustRolled || drawJustRolled) {
            soundFX.playRoll();
          } else if (tokenMoved) {
            soundFX.playMove();
          }
        } else if (diceJustRolled || drawJustRolled) {
          soundFX.playRoll();
        } else if (tokenMoved) {
          soundFX.playMove();
        }

        // Detect immediate House entry on remote update (cell 12 -> HOUSE hop)
        const houseEnteredToken = nextGame.tokens.find((nt) => {
          if (nt.location.kind !== 'HOUSE') return false;
          const pt = prevGame.tokens.find((t) => t.id === nt.id);
          if (!pt) return false;
          if (pt.location.kind === 'HOUSE') return false;
          if (pt.location.kind === 'TRACK' && pt.location.cell === 12) return false;
          return true;
        });

        if (houseEnteredToken && houseEnteredToken.location.kind === 'HOUSE') {
          const houseArm = houseEnteredToken.location.arm;
          const tokenId = houseEnteredToken.id;
          setIsAnimatingHop(true);
          setVisualLocationOverrides((prev) => ({
            ...prev,
            [tokenId]: { kind: 'TRACK', arm: houseArm, cell: 12 },
          }));
          scheduleTimer(() => {
            setVisualLocationOverrides((prev) => {
              const copy = { ...prev };
              delete copy[tokenId];
              return copy;
            });
            setIsAnimatingHop(false);
          }, 360);
        }

        if (
          prevGame.currentPlayerIndex !== nextGame.currentPlayerIndex ||
          (prevGame.phase === 'DRAW' && nextGame.phase !== 'DRAW')
        ) {
          setSelectedTokenId(null);
          setHoveredMoveId(null);
          setTurnHighlightKey((k) => k + 1);
        }

        if (nextGame.compensation && !prevGame.compensation) {
          const counts = getAvailableBonusStepCounts(nextGame);
          setSelectedBonusSteps(counts[counts.length - 1] ?? 1);
        }

        gameStateRef.current = nextGame;
        setGameState(nextGame);
      }
    },
    [scheduleTimer]
  );

  // Restore session on startup from URL (?room=XXXX) or localStorage
  useEffect(() => {
    let active = true;

    const restore = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoomRaw = urlParams.get('room');
      const urlRoom = urlRoomRaw ? urlRoomRaw.replace(/\D/g, '').slice(0, 4) : '';
      const saved = loadOnlineSession();

      try {
        if (urlRoom.length === 4) {
          const expectedId = saved && saved.roomId === urlRoom ? saved.playerId : undefined;
          const { doc, session } = await joinOnlineRoom(urlRoom, expectedId);
          if (!active) return;
          roomDocRef.current = doc;
          setRoomDoc(doc);
          setOnlineSession(session);
          if (doc.status === 'PLAYING' && doc.gameState) {
            gameStateRef.current = doc.gameState;
            setGameState(doc.gameState);
          }
          syncUrlRoomParam(doc.roomId);
        } else if (saved) {
          try {
            const { doc, session } = await joinOnlineRoom(saved.roomId, saved.playerId);
            if (!active) return;
            roomDocRef.current = doc;
            setRoomDoc(doc);
            setOnlineSession(session);
            if (doc.status === 'PLAYING' && doc.gameState) {
              gameStateRef.current = doc.gameState;
              setGameState(doc.gameState);
            }
            syncUrlRoomParam(doc.roomId);
          } catch {
            clearOnlineSession();
          }
        }
      } catch (err) {
        if (!active) return;
        setOnlineError(err instanceof Error ? err.message : 'Не удалось подключиться к комнате.');
        syncUrlRoomParam(null);
      } finally {
        if (active) {
          setIsRestoringSession(false);
        }
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, []);

  // Realtime subscription + 2s fallback polling while inside an online room
  useEffect(() => {
    const activeRoomId = roomDoc?.roomId;
    if (!activeRoomId) return;

    const unsubscribe = subscribeToRoom(activeRoomId, (incoming) => {
      applyIncomingRoomDoc(incoming);
    });

    const pollInterval = window.setInterval(() => {
      void fetchRoomDocument(activeRoomId)
        .then((latest) => {
          if (latest) applyIncomingRoomDoc(latest);
        })
        .catch(() => {
          // Ignore transient poll errors
        });
    }, 2000);

    return () => {
      unsubscribe();
      window.clearInterval(pollInterval);
    };
  }, [roomDoc?.roomId, applyIncomingRoomDoc]);

  const toggleMute = () => {
    const next = !isMuted;
    soundFX.muted = next;
    setIsMuted(next);
  };

  // Online Room Actions
  const handleCreateOnlineRoom = async () => {
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const { doc, session } = await createOnlineRoom();
      roomDocRef.current = doc;
      setRoomDoc(doc);
      setOnlineSession(session);
      setGameState(null);
      gameStateRef.current = null;
      syncUrlRoomParam(doc.roomId);
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : 'Не удалось создать комнату.');
    } finally {
      setOnlineBusy(false);
    }
  };

  const handleJoinOnlineRoom = async (roomCode: string) => {
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const saved = loadOnlineSession();
      const expectedId =
        saved && saved.roomId === roomCode.replace(/\D/g, '').slice(0, 4)
          ? saved.playerId
          : undefined;
      const { doc, session } = await joinOnlineRoom(roomCode, expectedId);
      roomDocRef.current = doc;
      setRoomDoc(doc);
      setOnlineSession(session);
      if (doc.status === 'PLAYING' && doc.gameState) {
        gameStateRef.current = doc.gameState;
        setGameState(doc.gameState);
      } else {
        gameStateRef.current = null;
        setGameState(null);
      }
      syncUrlRoomParam(doc.roomId);
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : 'Не удалось войти в комнату.');
    } finally {
      setOnlineBusy(false);
    }
  };

  const handleSwitchLobbyColor = async (color: PlayerColorId) => {
    if (!roomDoc) return;
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const { doc, newPlayerId } = await switchLobbyColor(roomDoc.roomId, myClientId, color);
      roomDocRef.current = doc;
      setRoomDoc(doc);
      setOnlineSession((prev) => (prev ? { ...prev, playerId: newPlayerId } : prev));
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : 'Не удалось сменить цвет.');
    } finally {
      setOnlineBusy(false);
    }
  };

  const handleUpdateLobbyProfile = async (updates: { name?: string; avatar?: string }) => {
    if (!roomDoc) return;
    setOnlineError(null);
    try {
      const doc = await updateLobbyProfile(roomDoc.roomId, myClientId, updates);
      roomDocRef.current = doc;
      setRoomDoc(doc);
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : 'Не удалось обновить профиль.');
    }
  };

  const handleStartOnlineMatch = async () => {
    if (!roomDoc) return;
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const doc = await startOnlineMatch(roomDoc.roomId, myClientId);
      roomDocRef.current = doc;
      setRoomDoc(doc);
      if (doc.gameState) {
        gameStateRef.current = doc.gameState;
        setGameState(doc.gameState);
      }
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : 'Не удалось начать игру.');
    } finally {
      setOnlineBusy(false);
    }
  };

  const handleLeaveRoom = async () => {
    const activeRoom = roomDocRef.current;
    clearAllTimers();
    setIsRolling(false);
    setIsAnimatingHop(false);
    setVisualLocationOverrides({});
    setIsTransitioningTurn(false);
    setTurnHighlightKey(0);
    setSelectedTokenId(null);
    setHoveredMoveId(null);
    setSidebarEditNameId(null);
    setSidebarAvatarPlayerId(null);
    setOnlineError(null);

    if (activeRoom && activeRoom.status === 'LOBBY') {
      try {
        await leaveLobbySlot(activeRoom.roomId, myClientId);
      } catch {
        // Ignore cleanup errors on exit
      }
    }

    clearOnlineSession();
    syncUrlRoomParam(null);
    roomDocRef.current = null;
    gameStateRef.current = null;
    setRoomDoc(null);
    setOnlineSession(null);
    setGameState(null);
  };

  // Local Pass & Play Actions
  const handleStartGame = (
    playerCount: 2 | 3 | 4,
    names: Partial<Record<PlayerColorId, string>>,
    avatars: Partial<Record<PlayerColorId, string>>
  ) => {
    clearAllTimers();
    clearOnlineSession();
    syncUrlRoomParam(null);
    roomDocRef.current = null;
    setRoomDoc(null);
    setOnlineSession(null);
    setOnlineError(null);
    setIsRolling(false);
    setIsAnimatingHop(false);
    setVisualLocationOverrides({});
    setIsTransitioningTurn(false);
    setTurnHighlightKey(0);
    setSelectedTokenId(null);
    setHoveredMoveId(null);
    setSidebarEditNameId(null);
    setSidebarAvatarPlayerId(null);
    setSelectedBonusSteps(6);
    const initial = createInitialGameState(playerCount, names, avatars);
    gameStateRef.current = initial;
    setGameState(initial);
  };

  const handleRestartToSetup = () => {
    clearAllTimers();
    setIsRolling(false);
    setIsAnimatingHop(false);
    setVisualLocationOverrides({});
    setIsTransitioningTurn(false);
    setTurnHighlightKey(0);
    setSelectedTokenId(null);
    setHoveredMoveId(null);
    setSidebarEditNameId(null);
    setSidebarAvatarPlayerId(null);
    gameStateRef.current = null;
    setGameState(null);
  };

  // Online mode status & permissions
  const isOnlineMode = Boolean(roomDoc && onlineSession);
  const isHost = Boolean(roomDoc && onlineSession && roomDoc.hostClientId === onlineSession.clientId);
  const myPlayerId = onlineSession?.playerId ?? null;

  const actingOnlinePlayerId = useMemo<number | null>(() => {
    if (!gameState) return null;
    if (gameState.phase === 'DRAW') {
      if (!gameState.draw || gameState.draw.status !== 'ROLLING') return null;
      return gameState.draw.contenderIds[gameState.draw.currentContenderPos] ?? null;
    }
    if (gameState.phase === 'GAME_OVER') return null;
    if (gameState.compensation) return gameState.compensation.benefactorId;
    return gameState.players[gameState.currentPlayerIndex]?.id ?? null;
  }, [gameState]);

  const isMyTurn = !isOnlineMode || (myPlayerId !== null && actingOnlinePlayerId === myPlayerId);

  const myPlayer = useMemo(() => {
    if (!isOnlineMode || !gameState || myPlayerId === null) return null;
    return gameState.players.find((p) => p.id === myPlayerId) ?? null;
  }, [isOnlineMode, gameState, myPlayerId]);

  const boardRotationDeg: BoardRotationDeg = myPlayer
    ? BOARD_ROTATION_BY_COLOR[myPlayer.color]
    : 0;

  const handleUpdatePlayerName = (playerId: number, name: string) => {
    if (isOnlineMode && playerId !== myPlayerId) return;
    const trimmed = name.trim();
    if (!trimmed || !gameStateRef.current) return;
    const next: GameState = {
      ...gameStateRef.current,
      players: gameStateRef.current.players.map((p) =>
        p.id === playerId ? { ...p, name: trimmed } : p
      ),
    };
    commitGameState(next);
  };

  const handleUpdatePlayerAvatar = (playerId: number, avatar: string) => {
    if (isOnlineMode && playerId !== myPlayerId) return;
    if (!gameStateRef.current) return;
    const next: GameState = {
      ...gameStateRef.current,
      players: gameStateRef.current.players.map((p) =>
        p.id === playerId ? { ...p, avatar } : p
      ),
    };
    commitGameState(next);
  };

  const commitSidebarName = (player: Player) => {
    const trimmed = sidebarDraftName.trim();
    if (trimmed) {
      handleUpdatePlayerName(player.id, trimmed);
    }
    setSidebarEditNameId(null);
  };

  const availableBonusCounts = useMemo(() => {
    if (!gameState || !gameState.compensation) return [];
    return getAvailableBonusStepCounts(gameState);
  }, [gameState]);

  const effectiveBonusSteps = useMemo(() => {
    if (availableBonusCounts.length === 0) return 1;
    if (availableBonusCounts.includes(selectedBonusSteps)) return selectedBonusSteps;
    return availableBonusCounts[availableBonusCounts.length - 1];
  }, [availableBonusCounts, selectedBonusSteps]);

  const dieHasMoves = useMemo<[boolean, boolean]>(() => {
    if (!gameState || isTransitioningTurn || isAnimatingHop) return [false, false];
    if (isOnlineMode && !isMyTurn) return [false, false];
    return getDieHasMoves(gameState);
  }, [gameState, isTransitioningTurn, isAnimatingHop, isOnlineMode, isMyTurn]);

  const hasAnyMoves = useMemo(() => {
    if (!gameState || isTransitioningTurn || isAnimatingHop) return false;
    if (gameState.phase === 'DRAW') return false;
    if (gameState.compensation) return availableBonusCounts.length > 0;
    return hasAnyLegalMoveForRemainingDice(gameState);
  }, [gameState, availableBonusCounts, isTransitioningTurn, isAnimatingHop]);

  const availableMoves = useMemo<MoveOption[]>(() => {
    if (
      !gameState ||
      isTransitioningTurn ||
      isAnimatingHop ||
      gameState.phase === 'DRAW' ||
      gameState.phase === 'GAME_OVER'
    ) {
      return [];
    }
    if (isOnlineMode && !isMyTurn) return [];

    if (gameState.compensation) {
      if (availableBonusCounts.length === 0) return [];
      return getAvailableMovesForSteps(
        gameState,
        gameState.compensation.benefactorId,
        effectiveBonusSteps,
        true
      );
    }

    return getAllLegalMovesForCurrentTurn(gameState);
  }, [
    gameState,
    availableBonusCounts,
    effectiveBonusSteps,
    isTransitioningTurn,
    isAnimatingHop,
    isOnlineMode,
    isMyTurn,
  ]);

  const selectedTokenMoves = useMemo(() => {
    if (!selectedTokenId) return [];
    return availableMoves.filter((m) => m.tokenId === selectedTokenId);
  }, [availableMoves, selectedTokenId]);

  // Pre-game Draw phase auto-advance after tie or winner announcement
  // In online mode, only the Host executes and pushes the transition so clients don't race.
  useEffect(() => {
    if (!gameState || gameState.phase !== 'DRAW' || !gameState.draw) return;
    if (isOnlineMode && !isHost) return;

    if (gameState.draw.status === 'TIE_PAUSE') {
      const id = window.setTimeout(() => {
        const latest = gameStateRef.current;
        if (latest && latest.phase === 'DRAW' && latest.draw?.status === 'TIE_PAUSE') {
          commitGameState(advanceDrawAfterTie(latest));
        }
      }, 1200);
      return () => window.clearTimeout(id);
    }
    if (gameState.draw.status === 'WINNER_PAUSE') {
      const id = window.setTimeout(() => {
        const latest = gameStateRef.current;
        if (latest && latest.phase === 'DRAW' && latest.draw?.status === 'WINNER_PAUSE') {
          commitGameState(startMatchFromDraw(latest));
          setTurnHighlightKey((k) => k + 1);
        }
      }, 1500);
      return () => window.clearTimeout(id);
    }
  }, [gameState, isOnlineMode, isHost, commitGameState]);

  const runTurnAdvanceSequence = useCallback(
    (intermediateState: GameState, justMovedOntoTrapCell: boolean, extraDelayMs = 0) => {
      setIsTransitioningTurn(true);
      const hasTraps = hasPendingEndOfTurnTraps(intermediateState);

      if (hasTraps) {
        const dwellDelay = (justMovedOntoTrapCell ? 780 : 400) + extraDelayMs;
        scheduleTimer(() => {
          const prev = gameStateRef.current;
          if (prev && isTurnReadyToAdvance(prev)) {
            const prevPrisonCount = prev.tokens.filter((t) => t.location.kind === 'PRISON').length;
            const prevHouseCount = prev.tokens.filter((t) => t.location.kind === 'HOUSE').length;
            const resolved = resolveEndOfTurnPrisonAndHouse(prev);
            const nextPrisonCount = resolved.tokens.filter((t) => t.location.kind === 'PRISON').length;
            const nextHouseCount = resolved.tokens.filter((t) => t.location.kind === 'HOUSE').length;
            if (nextPrisonCount > prevPrisonCount) {
              soundFX.playPrison();
            } else if (nextHouseCount > prevHouseCount) {
              soundFX.playHouse();
            }
            commitGameState(resolved);
          }

          scheduleTimer(() => {
            const latest = gameStateRef.current;
            if (latest && isTurnReadyToAdvance(latest)) {
              commitGameState(advanceToNextTurn(latest));
            }
            setIsTransitioningTurn(false);
            setTurnHighlightKey((k) => k + 1);
          }, 750);
        }, dwellDelay);
      } else {
        scheduleTimer(() => {
          const prev = gameStateRef.current;
          if (prev && isTurnReadyToAdvance(prev)) {
            commitGameState(resolveEndOfTurnPrisonAndHouse(prev));
          }
        }, extraDelayMs);

        scheduleTimer(() => {
          const latest = gameStateRef.current;
          if (latest && isTurnReadyToAdvance(latest)) {
            commitGameState(advanceToNextTurn(latest));
          }
          setIsTransitioningTurn(false);
          setTurnHighlightKey((k) => k + 1);
        }, 750 + extraDelayMs);
      }
    },
    [commitGameState, scheduleTimer]
  );

  // Host watchdog in case an active player disconnects during the 750ms turn handoff window
  useEffect(() => {
    if (!isOnlineMode || !isHost || !gameState) return;
    if (!isTurnReadyToAdvance(gameState) || isTransitioningTurn) return;

    const id = window.setTimeout(() => {
      const latest = gameStateRef.current;
      if (!latest || !isTurnReadyToAdvance(latest)) return;
      const resolved = resolveEndOfTurnPrisonAndHouse(latest);
      commitGameState(advanceToNextTurn(resolved));
      setTurnHighlightKey((k) => k + 1);
    }, 3000);

    return () => window.clearTimeout(id);
  }, [gameState, isOnlineMode, isHost, isTransitioningTurn, commitGameState]);

  // Auto-burn if active player rolled and has no legal moves
  useEffect(() => {
    if (
      !gameState ||
      gameState.compensation ||
      gameState.phase !== 'MOVE' ||
      hasAnyMoves ||
      isTransitioningTurn ||
      isAnimatingHop ||
      isTurnReadyToAdvance(gameState)
    ) {
      return;
    }
    if (isOnlineMode && !isMyTurn) return;

    const timer = window.setTimeout(() => {
      const prev = gameStateRef.current;
      if (!prev || prev.compensation || prev.phase !== 'MOVE' || isTurnReadyToAdvance(prev)) {
        return;
      }
      if (hasAnyLegalMoveForRemainingDice(prev)) return;
      setSelectedTokenId(null);
      setHoveredMoveId(null);
      const p = prev.players[prev.currentPlayerIndex];
      const next = handleNoMovesRemaining(
        prev,
        `${formatPlayerLabel(p)}: доступных ходов нет — значения сгорели.`,
        { deferTurnAdvance: true }
      );
      commitGameState(next);
      if (isTurnReadyToAdvance(next)) {
        runTurnAdvanceSequence(next, false);
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [
    gameState,
    hasAnyMoves,
    isTransitioningTurn,
    isAnimatingHop,
    isOnlineMode,
    isMyTurn,
    commitGameState,
    runTurnAdvanceSequence,
  ]);

  const handleRollDraw = () => {
    if (
      !gameState ||
      gameState.phase !== 'DRAW' ||
      !gameState.draw ||
      gameState.draw.status !== 'ROLLING' ||
      isRolling ||
      (isOnlineMode && !isMyTurn)
    ) {
      return;
    }
    soundFX.playRoll();
    setIsRolling(true);

    rollTimeoutRef.current = window.setTimeout(() => {
      const latest = gameStateRef.current;
      if (latest && latest.phase === 'DRAW') {
        commitGameState(rollDrawDieInState(latest));
      }
      setIsRolling(false);
    }, 320);
  };

  const handleStartFromDraw = () => {
    if (
      !gameState ||
      gameState.phase !== 'DRAW' ||
      !gameState.draw ||
      gameState.draw.winnerId === null ||
      (isOnlineMode && !isHost)
    ) {
      return;
    }
    commitGameState(startMatchFromDraw(gameState));
    setTurnHighlightKey((k) => k + 1);
  };

  const handleRoll = () => {
    if (
      !gameState ||
      gameState.phase !== 'ROLL' ||
      isRolling ||
      isTransitioningTurn ||
      isAnimatingHop ||
      gameState.compensation ||
      (isOnlineMode && !isMyTurn)
    ) {
      return;
    }
    soundFX.playRoll();
    setIsRolling(true);
    setSelectedTokenId(null);
    setHoveredMoveId(null);

    rollTimeoutRef.current = window.setTimeout(() => {
      const latest = gameStateRef.current;
      if (latest && latest.phase === 'ROLL') {
        commitGameState(rollDiceInState(latest));
      }
      setIsRolling(false);
    }, 320);
  };

  const handleSelectDie = (idx: 0 | 1) => {
    if (
      !gameState ||
      gameState.diceUsed[idx] ||
      gameState.compensation ||
      isTransitioningTurn ||
      isAnimatingHop ||
      (isOnlineMode && !isMyTurn)
    ) {
      return;
    }
    commitGameState({ ...gameState, selectedDieIndex: idx });
  };

  const handleSelectMove = (move: MoveOption) => {
    if (!gameState || isTransitioningTurn || isAnimatingHop || (isOnlineMode && !isMyTurn)) return;
    setSelectedTokenId(null);
    setHoveredMoveId(null);

    const usedDieIndex =
      gameState.compensation ||
      gameState.phase === 'TRIPLE_DOUBLE_BONUS' ||
      move.usesBothDice
        ? undefined
        : move.dieIndex ?? gameState.selectedDieIndex ?? undefined;

    const prevPrisonCount = gameState.tokens.filter((t) => t.location.kind === 'PRISON').length;
    const prevHouseCount = gameState.tokens.filter((t) => t.location.kind === 'HOUSE').length;
    const next = applyMove(gameState, move, usedDieIndex, { deferTurnAdvance: true });
    const nextPrisonCount = next.tokens.filter((t) => t.location.kind === 'PRISON').length;
    const nextHouseCount = next.tokens.filter((t) => t.location.kind === 'HOUSE').length;

    if (next.phase === 'GAME_OVER') {
      soundFX.playWin();
    } else if (move.kind === 'ENTER_FINISH' || move.kind === 'TRIPLE_DOUBLE_FINISH') {
      soundFX.playFinish();
    } else if (move.kind === 'RANSOM') {
      soundFX.playRansom();
    } else if (move.capturesEnemyIds.length > 0) {
      soundFX.playCapture();
    } else if (nextPrisonCount > prevPrisonCount || move.autoPrison) {
      soundFX.playPrison();
    } else if (nextHouseCount > prevHouseCount || move.autoHouse) {
      soundFX.playHouse();
    } else {
      soundFX.playMove();
    }

    if (next.compensation) {
      const counts = getAvailableBonusStepCounts(next);
      setSelectedBonusSteps(counts[counts.length - 1] ?? 1);
    }

    const didImmediateHouse = move.autoHouse && move.destination.kind === 'HOUSE';
    if (didImmediateHouse && move.destination.kind === 'HOUSE') {
      const houseArm = move.destination.arm;
      setIsAnimatingHop(true);
      setVisualLocationOverrides((prev) => ({
        ...prev,
        [move.tokenId]: { kind: 'TRACK', arm: houseArm, cell: 12 },
      }));
      scheduleTimer(() => {
        setVisualLocationOverrides((prev) => {
          const copy = { ...prev };
          delete copy[move.tokenId];
          return copy;
        });
        setIsAnimatingHop(false);
      }, 360);
    }

    commitGameState(next);

    if (isTurnReadyToAdvance(next)) {
      const landedOnTrapCell =
        move.destination.kind === 'TRACK' &&
        (move.destination.cell === 2 || move.destination.cell === 12);
      runTurnAdvanceSequence(next, landedOnTrapCell, didImmediateHouse ? 360 : 0);
    }
  };

  const handleEndTurn = () => {
    if (
      !gameState ||
      gameState.compensation ||
      gameState.phase !== 'MOVE' ||
      isTransitioningTurn ||
      isAnimatingHop ||
      (isOnlineMode && !isMyTurn)
    ) {
      return;
    }
    setSelectedTokenId(null);
    setHoveredMoveId(null);
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const next = handleNoMovesRemaining(
      gameState,
      `${formatPlayerLabel(currentPlayer)}: доступных ходов нет — значения сгорели.`,
      { deferTurnAdvance: true }
    );
    commitGameState(next);
    if (isTurnReadyToAdvance(next)) {
      runTurnAdvanceSequence(next, false);
    }
  };

  // Loading state while checking saved online session or ?room=XXXX
  if (isRestoringSession) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-[#ebe3d5] dark:bg-[#12100e] text-[#1f1a16] dark:text-[#f3efe9] p-6">
        <div className="w-10 h-10 rounded-full border-3 border-amber-500 border-t-transparent animate-spin" />
        <div className="font-display font-bold text-base">Подключение к комнате...</div>
      </div>
    );
  }

  // Online Lobby Screen
  if (roomDoc && roomDoc.status === 'LOBBY') {
    return (
      <>
        <LobbyScreen
          roomDoc={roomDoc}
          myClientId={myClientId}
          themeMode={themeMode}
          isBusy={onlineBusy}
          errorMessage={onlineError}
          onToggleTheme={setThemeMode}
          onOpenRules={() => setIsRulesOpen(true)}
          onSwitchColor={handleSwitchLobbyColor}
          onUpdateProfile={handleUpdateLobbyProfile}
          onStartMatch={handleStartOnlineMatch}
          onLeaveRoom={handleLeaveRoom}
        />
        <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      </>
    );
  }

  // Start / Setup Screen
  if (!gameState) {
    return (
      <>
        <SetupScreen
          themeMode={themeMode}
          onToggleTheme={setThemeMode}
          onStartGame={handleStartGame}
          onCreateOnlineRoom={handleCreateOnlineRoom}
          onJoinOnlineRoom={handleJoinOnlineRoom}
          onlineBusy={onlineBusy}
          onlineError={onlineError}
          onOpenRules={() => setIsRulesOpen(true)}
        />
        <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      </>
    );
  }

  const actingPlayer =
    actingOnlinePlayerId !== null
      ? gameState.players.find((p) => p.id === actingOnlinePlayerId) ?? null
      : null;
  const actingTheme = actingPlayer ? PLAYER_THEMES[actingPlayer.color] : null;

  return (
    <div className="min-h-dvh flex flex-col bg-[#ebe3d5] dark:bg-[#12100e] text-[#1f1a16] dark:text-[#f3efe9] transition-colors">
      {/* Top Bar */}
      <header className="border-b border-[#d6c9b4] dark:border-[#2a2f38] bg-[#f7f2e8]/95 dark:bg-[#181b20]/95 backdrop-blur-xs">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-5 h-13 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="font-display font-extrabold text-base sm:text-lg tracking-tight text-[#1f1a16] dark:text-[#f8fafc] whitespace-nowrap shrink-0">
              Дворовый Парчис
            </div>
            {isOnlineMode && roomDoc && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#efe8dc] dark:bg-[#222830] border border-[#d6c9b4] dark:border-[#343d48] text-[11px] font-mono font-bold text-[#4a4036] dark:text-[#cbd5e1] shrink-0">
                <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>#{roomDoc.roomId}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Light / Dark Theme Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-[#e7dfd1] dark:bg-[#121519] border border-[#d6c9b4] dark:border-[#2d3540]">
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                aria-label="Светлая тема"
                className={`px-2 sm:px-2.5 h-8 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                  themeMode === 'light'
                    ? 'bg-white text-[#1f1a16] shadow-xs'
                    : 'text-[#6d6052] dark:text-[#94a3b8]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Светлая</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                aria-label="Тёмная тема"
                className={`px-2 sm:px-2.5 h-8 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                  themeMode === 'dark'
                    ? 'bg-[#2a323d] text-[#f8fafc] shadow-xs'
                    : 'text-[#6d6052] dark:text-[#94a3b8]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Тёмная</span>
              </button>
            </div>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
              className="w-9 h-9 rounded-lg bg-[#efe8dc] dark:bg-[#222830] hover:bg-[#e5dccb] dark:hover:bg-[#2c343f] border border-[#d6c9b4] dark:border-[#343d48] flex items-center justify-center text-[#4a4036] dark:text-[#cbd5e1] cursor-pointer transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#efe8dc] dark:bg-[#222830] hover:bg-[#e5dccb] dark:hover:bg-[#2c343f] border border-[#d6c9b4] dark:border-[#343d48] text-xs font-semibold text-[#29221c] dark:text-[#f8fafc] inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Правила</span>
            </button>

            {isOnlineMode ? (
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#efe8dc] dark:bg-[#222830] hover:bg-red-500/15 border border-[#d6c9b4] dark:border-[#343d48] hover:border-red-500/50 text-xs font-semibold text-[#29221c] dark:text-[#f8fafc] inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Выйти из комнаты</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestartToSetup}
                className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#efe8dc] dark:bg-[#222830] hover:bg-[#e5dccb] dark:hover:bg-[#2c343f] border border-[#d6c9b4] dark:border-[#343d48] text-xs font-semibold text-[#29221c] dark:text-[#f8fafc] inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Новая игра</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Online Turn Status Banner */}
      {isOnlineMode && gameState.phase !== 'GAME_OVER' && (
        <div className="max-w-[1440px] w-full mx-auto px-2 sm:px-4 pt-2">
          <div
            className={`rounded-xl px-4 py-2 border flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-medium transition-colors ${
              isMyTurn
                ? 'bg-emerald-500/14 border-emerald-500/55 text-emerald-900 dark:text-emerald-200'
                : 'bg-[#f5efe4] dark:bg-[#191e24] border-[#d6c9b4] dark:border-[#2d3540] text-[#54493e] dark:text-[#cbd5e1]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {actingPlayer && actingTheme ? (
                <>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: actingTheme.fill }}
                  />
                  <span className="truncate">
                    {isMyTurn ? (
                      <strong className="font-display">
                        {gameState.phase === 'DRAW'
                          ? 'Ваш бросок жребия!'
                          : gameState.compensation
                          ? 'Бонусный ход за выкуп (6 шагов) — ваш ход!'
                          : 'Ваш ход!'}
                      </strong>
                    ) : (
                      <>
                        Сейчас ходит{' '}
                        <strong className="font-display">
                          {actingPlayer.avatar} {formatPlayerLabel(actingPlayer)}
                        </strong>{' '}
                        ({actingTheme.name}). Ожидайте своей очереди...
                      </>
                    )}
                  </span>
                </>
              ) : (
                <span>
                  {gameState.phase === 'DRAW'
                    ? 'Подведение итогов жребия...'
                    : 'Определение следующего хода...'}
                </span>
              )}
            </div>

            {myPlayer && (
              <div className="text-[11px] font-semibold text-[#6d6052] dark:text-[#94a3b8] shrink-0">
                Вы: {myPlayer.avatar} {myPlayer.name} ({PLAYER_THEMES[myPlayer.color].name})
              </div>
            )}
          </div>
        </div>
      )}

      {onlineError && (
        <div className="max-w-[1440px] w-full mx-auto px-2 sm:px-4 pt-2">
          <div className="rounded-xl bg-red-500/12 border border-red-500/45 px-4 py-2 text-xs font-medium text-red-800 dark:text-red-200 flex items-center justify-between gap-2">
            <span>{onlineError}</span>
            <button
              type="button"
              onClick={() => setOnlineError(null)}
              className="underline cursor-pointer shrink-0"
            >
              Скрыть
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-2 sm:px-4 py-2 sm:py-3 grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_390px] gap-3 lg:gap-5 items-start">
        <div className="lg:hidden">
          <DiceTray
            state={gameState}
            isRolling={isRolling}
            isTransitioningTurn={isTransitioningTurn}
            turnHighlightKey={turnHighlightKey}
            hasAnyMoves={hasAnyMoves}
            dieHasMoves={dieHasMoves}
            selectedTokenId={selectedTokenId}
            selectedTokenMoves={selectedTokenMoves}
            hoveredMoveId={hoveredMoveId}
            isOnlineMode={isOnlineMode}
            isMyTurn={isMyTurn}
            isHost={isHost}
            myPlayerId={myPlayerId}
            onRollDraw={handleRollDraw}
            onStartFromDraw={handleStartFromDraw}
            onRoll={handleRoll}
            onSelectDie={handleSelectDie}
            onEndTurn={handleEndTurn}
            onSelectMove={handleSelectMove}
            onHoverMove={setHoveredMoveId}
            onUpdatePlayerName={handleUpdatePlayerName}
            onUpdatePlayerAvatar={handleUpdatePlayerAvatar}
          />
        </div>

        {/* Maximized Game Board */}
        <div className="w-full flex items-center justify-center">
          <Board
            state={gameState}
            themeMode={themeMode}
            availableMoves={availableMoves}
            selectedTokenId={selectedTokenId}
            selectedDieIndex={gameState.selectedDieIndex}
            hoveredMoveId={hoveredMoveId}
            visualLocationOverrides={visualLocationOverrides}
            boardRotationDeg={boardRotationDeg}
            editablePlayerId={isOnlineMode ? myPlayerId : undefined}
            onSelectToken={(id) => {
              if (isOnlineMode && !isMyTurn) return;
              setHoveredMoveId(null);
              setSelectedTokenId(id);
            }}
            onDeselectToken={() => {
              setHoveredMoveId(null);
              setSelectedTokenId(null);
            }}
            onSelectMove={handleSelectMove}
            onHoverMove={setHoveredMoveId}
            onUpdatePlayerName={handleUpdatePlayerName}
            onUpdatePlayerAvatar={handleUpdatePlayerAvatar}
          />
        </div>

        {/* Right Sidebar */}
        <aside className="space-y-3">
          <div className="hidden lg:block">
            <DiceTray
              state={gameState}
              isRolling={isRolling}
              isTransitioningTurn={isTransitioningTurn}
              turnHighlightKey={turnHighlightKey}
              hasAnyMoves={hasAnyMoves}
              dieHasMoves={dieHasMoves}
              selectedTokenId={selectedTokenId}
              selectedTokenMoves={selectedTokenMoves}
              hoveredMoveId={hoveredMoveId}
              isOnlineMode={isOnlineMode}
              isMyTurn={isMyTurn}
              isHost={isHost}
              myPlayerId={myPlayerId}
              onRollDraw={handleRollDraw}
              onStartFromDraw={handleStartFromDraw}
              onRoll={handleRoll}
              onSelectDie={handleSelectDie}
              onEndTurn={handleEndTurn}
              onSelectMove={handleSelectMove}
              onHoverMove={setHoveredMoveId}
              onUpdatePlayerName={handleUpdatePlayerName}
              onUpdatePlayerAvatar={handleUpdatePlayerAvatar}
            />
          </div>

          <section className="rounded-xl bg-[#faf6ee] dark:bg-[#1b2026] border border-[#d6c9b4] dark:border-[#2d3540] p-4 space-y-3 shadow-sm">
            <h2 className="font-display font-bold text-sm text-[#29221c] dark:text-[#e2e8f0]">
              Прогресс игроков
            </h2>
            <div className="divide-y divide-[#e6dccb] dark:divide-[#262d36]">
              {gameState.players.map((p, idx) => {
                const theme = PLAYER_THEMES[p.color];
                const isTurn =
                  gameState.phase !== 'DRAW' &&
                  gameState.phase !== 'GAME_OVER' &&
                  (gameState.compensation
                    ? gameState.compensation.benefactorId === p.id
                    : gameState.currentPlayerIndex === idx);
                const canEditThisPlayer = !isOnlineMode || p.id === myPlayerId;
                const pTokens = gameState.tokens.filter((t) => t.ownerId === p.id);
                const finishedLetters = new Set<number>(
                  pTokens
                    .filter((t) => t.location.kind === 'FINISH')
                    .map((t) => (t.location.kind === 'FINISH' ? t.location.index : -1))
                );
                const reserveCount = pTokens.filter((t) => t.location.kind === 'RESERVE').length;
                const capturedCount = gameState.tokens.filter(
                  (t) => t.location.kind === 'CAPTURED' && t.location.captorId === p.id
                ).length;

                return (
                  <div
                    key={p.id}
                    className={`relative py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 transition-opacity ${
                      isTurn ? 'opacity-100' : 'opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        disabled={!canEditThisPlayer}
                        onClick={(e) => {
                          if (!canEditThisPlayer) return;
                          e.stopPropagation();
                          setSidebarEditNameId(null);
                          setSidebarAvatarPlayerId((prev) => (prev === p.id ? null : p.id));
                        }}
                        title={
                          canEditThisPlayer ? 'Нажмите для выбора аватарки' : undefined
                        }
                        aria-label={
                          canEditThisPlayer
                            ? `Сменить аватарку игрока ${p.name}`
                            : `Аватарка игрока ${p.name}`
                        }
                        className={`w-8 h-8 rounded-lg bg-[#f3ede2] dark:bg-[#14181d] border-2 flex items-center justify-center text-base shrink-0 shadow-xs transition-transform ${
                          canEditThisPlayer
                            ? 'cursor-pointer hover:scale-105'
                            : 'cursor-default'
                        }`}
                        style={{ borderColor: theme.fill }}
                      >
                        {p.avatar}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#1f1a16] dark:text-[#f8fafc] flex items-center gap-1.5 min-w-0">
                          {canEditThisPlayer && sidebarEditNameId === p.id ? (
                            <input
                              type="text"
                              autoFocus
                              maxLength={14}
                              value={sidebarDraftName}
                              onChange={(e) => setSidebarDraftName(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  commitSidebarName(p);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setSidebarEditNameId(null);
                                }
                              }}
                              onBlur={() => commitSidebarName(p)}
                              aria-label={`Имя игрока ${theme.name}`}
                              className="w-full min-w-0 bg-transparent border-b border-amber-500 text-sm font-semibold text-[#1f1a16] dark:text-[#f8fafc] outline-none p-0"
                            />
                          ) : canEditThisPlayer ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSidebarAvatarPlayerId(null);
                                setSidebarDraftName(p.name);
                                setSidebarEditNameId(p.id);
                              }}
                              title="Нажмите на имя для редактирования"
                              className="truncate text-left cursor-text hover:underline decoration-amber-500/60 underline-offset-2"
                            >
                              {p.name}
                            </button>
                          ) : (
                            <span className="truncate">{p.name}</span>
                          )}
                          {isOnlineMode && p.id === myPlayerId && (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                              (Вы)
                            </span>
                          )}
                          {isTurn && (
                            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 shrink-0">
                              · ходит
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#7a6d5f] dark:text-[#94a3b8] truncate">
                          <span>{theme.name}</span>
                          <span className="font-mono tabular-nums">
                            {' '}
                            · Резерв: {reserveCount} · Пленных: {capturedCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canEditThisPlayer && sidebarAvatarPlayerId === p.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 top-[calc(100%-2px)] z-30 p-2 rounded-xl bg-[#faf6ee] dark:bg-[#1f262f] border border-[#cbbda8] dark:border-[#3b4554] shadow-xl grid grid-cols-5 gap-1.5 w-[220px]"
                      >
                        {PLAYER_AVATARS.map((emoji) => {
                          const selected = p.avatar === emoji;
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                handleUpdatePlayerAvatar(p.id, emoji);
                                setSidebarAvatarPlayerId(null);
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

                    <div className="flex items-center gap-1 shrink-0" aria-label="Прогресс финиша">
                      {([4, 3, 2, 1, 0] as const).map((fIdx) => {
                        const taken = finishedLetters.has(fIdx);
                        return (
                          <span
                            key={fIdx}
                            className={`w-5 h-5 rounded text-[10px] font-display font-bold flex items-center justify-center ${
                              taken
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#ede6da] dark:bg-[#13171c] text-[#8a7a68] dark:text-[#475569] border border-[#d6c9b4] dark:border-[#2a313c]'
                            }`}
                          >
                            {FINISH_LETTERS[fIdx]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl bg-[#faf6ee] dark:bg-[#1b2026] border border-[#d6c9b4] dark:border-[#2d3540] p-4 space-y-2.5 shadow-sm">
            <h2 className="font-display font-bold text-sm text-[#29221c] dark:text-[#e2e8f0]">
              Журнал событий
            </h2>
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {gameState.logs.map((entry) => {
                const colorClass =
                  entry.type === 'capture'
                    ? 'text-red-700 dark:text-red-300'
                    : entry.type === 'prison'
                    ? 'text-rose-800 dark:text-rose-300'
                    : entry.type === 'house'
                    ? 'text-amber-700 dark:text-amber-300'
                    : entry.type === 'ransom'
                    ? 'text-amber-800 dark:text-amber-200'
                    : entry.type === 'finish' || entry.type === 'win'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : entry.type === 'burn'
                    ? 'text-orange-700 dark:text-orange-300'
                    : 'text-[#4a4036] dark:text-[#cbd5e1]';

                return (
                  <div
                    key={entry.id}
                    className="text-xs leading-relaxed flex items-baseline gap-2 border-b border-[#ece3d3] dark:border-[#242a33] pb-1.5 last:border-none last:pb-0"
                  >
                    <span className="font-mono text-[10px] tabular-nums text-[#8a7a68] dark:text-[#64748b] shrink-0">
                      #{entry.turn}
                    </span>
                    <span className={colorClass}>{entry.message}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </main>

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <VictoryModal
        state={gameState}
        onRestart={isOnlineMode ? handleLeaveRoom : handleRestartToSetup}
        buttonLabel={isOnlineMode ? 'Выйти из комнаты' : 'Играть снова'}
      />
    </div>
  );
}
