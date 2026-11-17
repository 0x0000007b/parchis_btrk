import { createOnlineGameState } from '../engine/parchisRules';
import { supabase } from '../lib/supabase';
import { DEFAULT_AVATAR_BY_COLOR, PlayerColorId } from '../types/game';
import {
  ARM_BY_COLOR,
  COLOR_SLOTS_ORDER,
  OnlineSession,
  PLAYER_ID_BY_COLOR,
  RoomDocument,
  RoomPlayerSlot,
} from '../types/online';

const SESSION_STORAGE_KEY = 'parchis_online_session';
const ROOM_ID_STORAGE_KEY = 'parchis_room_id';
const PLAYER_ID_STORAGE_KEY = 'parchis_player_id';
const CLIENT_ID_STORAGE_KEY = 'parchis_client_id';

export function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return 'server-client';
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;
  const created =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
  return created;
}

export function saveOnlineSession(session: OnlineSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  window.localStorage.setItem(ROOM_ID_STORAGE_KEY, session.roomId);
  window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, String(session.playerId));
}

export function loadOnlineSession(): OnlineSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const roomId = window.localStorage.getItem(ROOM_ID_STORAGE_KEY);
    const playerIdRaw = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OnlineSession>;
      if (
        typeof parsed.roomId === 'string' &&
        typeof parsed.playerId === 'number' &&
        typeof parsed.clientId === 'string'
      ) {
        return parsed as OnlineSession;
      }
    }
    if (roomId && playerIdRaw !== null) {
      const pid = Number(playerIdRaw);
      if (!Number.isNaN(pid)) {
        return {
          roomId,
          playerId: pid,
          clientId: getOrCreateClientId(),
        };
      }
    }
  } catch {
    // ignore malformed localStorage
  }
  return null;
}

export function clearOnlineSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.localStorage.removeItem(ROOM_ID_STORAGE_KEY);
  window.localStorage.removeItem(PLAYER_ID_STORAGE_KEY);
}

export function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function findMySlotInDoc(
  doc: RoomDocument,
  clientId: string,
  playerId?: number
): RoomPlayerSlot | null {
  for (const color of COLOR_SLOTS_ORDER) {
    const slot = doc.slots[color];
    if (!slot) continue;
    if (slot.clientId === clientId) return slot;
  }
  if (playerId !== undefined) {
    for (const color of COLOR_SLOTS_ORDER) {
      const slot = doc.slots[color];
      if (slot && slot.playerId === playerId) return slot;
    }
  }
  return null;
}

export async function fetchRoomDocument(roomId: string): Promise<RoomDocument | null> {
  const cleanId = roomId.trim();
  const { data, error } = await supabase
    .from('rooms')
    .select('id, game_state')
    .eq('id', cleanId)
    .maybeSingle();

  if (error) {
    throw new Error(`Ошибка подключения к серверу: ${error.message}`);
  }
  if (!data || !data.game_state) return null;
  return data.game_state as RoomDocument;
}

export async function createOnlineRoom(): Promise<{
  doc: RoomDocument;
  session: OnlineSession;
}> {
  const clientId = getOrCreateClientId();
  const hostColor: PlayerColorId = 'blue';
  const hostPlayerId = PLAYER_ID_BY_COLOR[hostColor];

  for (let attempt = 0; attempt < 6; attempt++) {
    const roomId = generateRoomCode();
    const doc: RoomDocument = {
      version: 1,
      roomId,
      hostClientId: clientId,
      status: 'LOBBY',
      slots: {
        [hostColor]: {
          playerId: hostPlayerId,
          clientId,
          color: hostColor,
          arm: ARM_BY_COLOR[hostColor],
          name: 'Игрок 1',
          avatar: DEFAULT_AVATAR_BY_COLOR[hostColor],
          isHost: true,
          joinedAt: Date.now(),
        },
      },
      gameState: null,
    };

    const { error } = await supabase.from('rooms').insert({
      id: roomId,
      game_state: doc,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      const session: OnlineSession = { roomId, playerId: hostPlayerId, clientId };
      saveOnlineSession(session);
      return { doc, session };
    }

    // Retry on duplicate primary key
    if (error.code !== '23505') {
      throw new Error(`Не удалось создать комнату: ${error.message}`);
    }
  }

  throw new Error('Не удалось сгенерировать свободный код комнаты. Попробуйте ещё раз.');
}

export async function joinOnlineRoom(
  rawRoomId: string,
  expectedPlayerId?: number
): Promise<{
  doc: RoomDocument;
  session: OnlineSession;
}> {
  const roomId = rawRoomId.replace(/\D/g, '').slice(0, 4);
  if (roomId.length !== 4) {
    throw new Error('Введите корректный 4-значный код комнаты.');
  }

  const clientId = getOrCreateClientId();

  for (let attempt = 0; attempt < 3; attempt++) {
    const doc = await fetchRoomDocument(roomId);
    if (!doc) {
      throw new Error(`Комната #${roomId} не найдена.`);
    }

    // Reconnect existing slot (same browser clientId or saved playerId)
    const existingSlot = findMySlotInDoc(doc, clientId, expectedPlayerId);
    if (existingSlot) {
      if (existingSlot.clientId !== clientId) {
        const updatedSlot: RoomPlayerSlot = { ...existingSlot, clientId };
        const nextDoc: RoomDocument = {
          ...doc,
          version: doc.version + 1,
          hostClientId: existingSlot.isHost ? clientId : doc.hostClientId,
          slots: {
            ...doc.slots,
            [existingSlot.color]: updatedSlot,
          },
        };
        const { error } = await supabase
          .from('rooms')
          .update({
            game_state: nextDoc,
            updated_at: new Date().toISOString(),
          })
          .eq('id', roomId);
        if (error) {
          throw new Error(`Не удалось переподключиться: ${error.message}`);
        }
        const session: OnlineSession = { roomId, playerId: existingSlot.playerId, clientId };
        saveOnlineSession(session);
        return { doc: nextDoc, session };
      }

      const session: OnlineSession = { roomId, playerId: existingSlot.playerId, clientId };
      saveOnlineSession(session);
      return { doc, session };
    }

    // Reconnect mid-game if saved playerId exists in gameState
    if (doc.status === 'PLAYING') {
      if (
        expectedPlayerId !== undefined &&
        doc.gameState?.players.some((p) => p.id === expectedPlayerId)
      ) {
        const session: OnlineSession = { roomId, playerId: expectedPlayerId, clientId };
        saveOnlineSession(session);
        return { doc, session };
      }
      throw new Error(`Игра в комнате #${roomId} уже началась.`);
    }

    // Room is in LOBBY: assign first free color slot
    const freeColor = COLOR_SLOTS_ORDER.find((c) => !doc.slots[c]);
    if (!freeColor) {
      throw new Error(`Комната #${roomId} уже заполнена (4/4).`);
    }

    const occupiedCount = COLOR_SLOTS_ORDER.filter((c) => Boolean(doc.slots[c])).length;
    const playerId = PLAYER_ID_BY_COLOR[freeColor];
    const newSlot: RoomPlayerSlot = {
      playerId,
      clientId,
      color: freeColor,
      arm: ARM_BY_COLOR[freeColor],
      name: `Игрок ${occupiedCount + 1}`,
      avatar: DEFAULT_AVATAR_BY_COLOR[freeColor],
      isHost: occupiedCount === 0,
      joinedAt: Date.now(),
    };

    const nextDoc: RoomDocument = {
      ...doc,
      version: doc.version + 1,
      hostClientId: occupiedCount === 0 ? clientId : doc.hostClientId,
      slots: {
        ...doc.slots,
        [freeColor]: newSlot,
      },
    };

    const { error } = await supabase
      .from('rooms')
      .update({
        game_state: nextDoc,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId);

    if (!error) {
      const session: OnlineSession = { roomId, playerId, clientId };
      saveOnlineSession(session);
      return { doc: nextDoc, session };
    }
  }

  throw new Error('Не удалось войти в комнату. Попробуйте ещё раз.');
}

export async function switchLobbyColor(
  roomId: string,
  clientId: string,
  targetColor: PlayerColorId
): Promise<{ doc: RoomDocument; newPlayerId: number }> {
  const doc = await fetchRoomDocument(roomId);
  if (!doc) throw new Error('Комната не найдена.');
  if (doc.status !== 'LOBBY') throw new Error('Игра уже началась.');

  const mySlot = findMySlotInDoc(doc, clientId);
  if (!mySlot) throw new Error('Игрок не найден в комнате.');
  if (mySlot.color === targetColor) {
    return { doc, newPlayerId: mySlot.playerId };
  }
  if (doc.slots[targetColor]) {
    throw new Error('Этот цвет уже занят другим игроком.');
  }

  const newPlayerId = PLAYER_ID_BY_COLOR[targetColor];
  const nextSlots = { ...doc.slots };
  delete nextSlots[mySlot.color];
  nextSlots[targetColor] = {
    ...mySlot,
    playerId: newPlayerId,
    color: targetColor,
    arm: ARM_BY_COLOR[targetColor],
  };

  const nextDoc: RoomDocument = {
    ...doc,
    version: doc.version + 1,
    slots: nextSlots,
  };

  const { error } = await supabase
    .from('rooms')
    .update({
      game_state: nextDoc,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId);

  if (error) {
    throw new Error(`Не удалось сменить цвет: ${error.message}`);
  }

  saveOnlineSession({ roomId, playerId: newPlayerId, clientId });
  return { doc: nextDoc, newPlayerId };
}

export async function updateLobbyProfile(
  roomId: string,
  clientId: string,
  updates: { name?: string; avatar?: string }
): Promise<RoomDocument> {
  const doc = await fetchRoomDocument(roomId);
  if (!doc || doc.status !== 'LOBBY') {
    throw new Error('Комната недоступна для редактирования.');
  }
  const mySlot = findMySlotInDoc(doc, clientId);
  if (!mySlot) throw new Error('Слот игрока не найден.');

  const nextSlot: RoomPlayerSlot = {
    ...mySlot,
    name: updates.name !== undefined ? updates.name : mySlot.name,
    avatar: updates.avatar !== undefined ? updates.avatar : mySlot.avatar,
  };

  const nextDoc: RoomDocument = {
    ...doc,
    version: doc.version + 1,
    slots: {
      ...doc.slots,
      [mySlot.color]: nextSlot,
    },
  };

  const { error } = await supabase
    .from('rooms')
    .update({
      game_state: nextDoc,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId);

  if (error) {
    throw new Error(`Не удалось обновить профиль: ${error.message}`);
  }

  return nextDoc;
}

export async function leaveLobbySlot(roomId: string, clientId: string): Promise<void> {
  const doc = await fetchRoomDocument(roomId);
  if (!doc || doc.status !== 'LOBBY') return;

  const mySlot = findMySlotInDoc(doc, clientId);
  if (!mySlot) return;

  const nextSlots = { ...doc.slots };
  delete nextSlots[mySlot.color];

  let nextHostClientId = doc.hostClientId;
  if (mySlot.isHost) {
    const remaining = COLOR_SLOTS_ORDER.map((c) => nextSlots[c]).filter(
      (s): s is RoomPlayerSlot => Boolean(s)
    );
    if (remaining.length > 0) {
      const nextHost = remaining[0];
      nextHostClientId = nextHost.clientId;
      nextSlots[nextHost.color] = { ...nextHost, isHost: true };
    }
  }

  const nextDoc: RoomDocument = {
    ...doc,
    version: doc.version + 1,
    hostClientId: nextHostClientId,
    slots: nextSlots,
  };

  await supabase
    .from('rooms')
    .update({
      game_state: nextDoc,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId);
}

export async function startOnlineMatch(
  roomId: string,
  clientId: string
): Promise<RoomDocument> {
  const doc = await fetchRoomDocument(roomId);
  if (!doc) throw new Error('Комната не найдена.');
  if (doc.hostClientId !== clientId) {
    throw new Error('Только создатель комнаты может начать игру.');
  }

  const activeSlots = COLOR_SLOTS_ORDER.map((c) => doc.slots[c]).filter(
    (s): s is RoomPlayerSlot => Boolean(s)
  );
  if (activeSlots.length < 2) {
    throw new Error('Для начала игры нужно минимум 2 игрока.');
  }

  const initialGameState = createOnlineGameState(
    activeSlots.map((s) => ({
      playerId: s.playerId,
      arm: s.arm,
      color: s.color,
      name: s.name.trim() || `Игрок ${s.playerId + 1}`,
      avatar: s.avatar,
    }))
  );

  const nextDoc: RoomDocument = {
    ...doc,
    version: doc.version + 1,
    status: 'PLAYING',
    gameState: initialGameState,
  };

  const { error } = await supabase
    .from('rooms')
    .update({
      game_state: nextDoc,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId);

  if (error) {
    throw new Error(`Не удалось запустить партию: ${error.message}`);
  }

  return nextDoc;
}

export async function pushOnlineRoomGameState(
  baseDoc: RoomDocument,
  nextGameState: NonNullable<RoomDocument['gameState']>
): Promise<RoomDocument> {
  const nextSlots = { ...baseDoc.slots };
  for (const player of nextGameState.players) {
    const existing = nextSlots[player.color];
    if (existing) {
      nextSlots[player.color] = {
        ...existing,
        name: player.name,
        avatar: player.avatar,
      };
    }
  }

  const nextDoc: RoomDocument = {
    ...baseDoc,
    version: baseDoc.version + 1,
    status: 'PLAYING',
    slots: nextSlots,
    gameState: nextGameState,
  };

  const { error } = await supabase
    .from('rooms')
    .update({
      game_state: nextDoc,
      updated_at: new Date().toISOString(),
    })
    .eq('id', baseDoc.roomId);

  if (error) {
    throw new Error(`Ошибка синхронизации хода: ${error.message}`);
  }

  return nextDoc;
}

export function subscribeToRoom(
  roomId: string,
  onDoc: (doc: RoomDocument) => void
): () => void {
  const channel = supabase
    .channel(`room-sync-${roomId}-${Math.random().toString(36).slice(2, 7)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        const record = payload.new as { game_state?: RoomDocument } | undefined;
        if (record && record.game_state) {
          onDoc(record.game_state);
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
