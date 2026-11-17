import { ArmIndex, GameState, PlayerColorId } from './game';

export type BoardRotationDeg = 0 | -90 | 180 | 90;

export const COLOR_SLOTS_ORDER: PlayerColorId[] = ['blue', 'yellow', 'green', 'red'];

export const ARM_BY_COLOR: Record<PlayerColorId, ArmIndex> = {
  blue: 0,
  yellow: 3,
  green: 2,
  red: 1,
};

export const PLAYER_ID_BY_COLOR: Record<PlayerColorId, number> = {
  blue: 0,
  yellow: 1,
  green: 2,
  red: 3,
};

export const BOARD_ROTATION_BY_COLOR: Record<PlayerColorId, BoardRotationDeg> = {
  blue: 0,
  yellow: -90,
  green: 180,
  red: 90,
};

export interface RoomPlayerSlot {
  playerId: number;
  clientId: string;
  color: PlayerColorId;
  arm: ArmIndex;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt: number;
}

export interface RoomDocument {
  version: number;
  roomId: string;
  hostClientId: string;
  status: 'LOBBY' | 'PLAYING';
  slots: Partial<Record<PlayerColorId, RoomPlayerSlot>>;
  gameState: GameState | null;
}

export interface OnlineSession {
  roomId: string;
  playerId: number;
  clientId: string;
}
