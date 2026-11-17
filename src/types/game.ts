export type ArmIndex = 0 | 1 | 2 | 3; // 0: Нижний (Синий), 1: Правый (Красный), 2: Верхний (Зелёный), 3: Левый (Жёлтый)

export type PlayerColorId = 'blue' | 'red' | 'green' | 'yellow';

export interface PlayerColorTheme {
  id: PlayerColorId;
  name: string;
  armLabel: string;
  fill: string;
  stroke: string;
  ring: string;
  lightBg: string;
  textClass: string;
  badgeBg: string;
}

export type TokenLocation =
  | { kind: 'RESERVE' }
  | { kind: 'START'; arm: ArmIndex }
  | { kind: 'TRACK'; arm: ArmIndex; cell: number } // cell: 1..13
  | { kind: 'PRISON'; arm: ArmIndex }
  | { kind: 'HOUSE'; arm: ArmIndex }
  | { kind: 'PRE_FINISH'; arm: ArmIndex } // cell 14
  | { kind: 'FINISH'; arm: ArmIndex; index: 0 | 1 | 2 | 3 | 4 } // 0: Ш, 1: И, 2: Н, 3: И, 4: Ф
  | { kind: 'CAPTURED'; captorId: number };

export interface Token {
  id: string;
  ownerId: number;
  index: number; // 0..4
  location: TokenLocation;
  prisonImmunityTurns?: number;
  prisonImmunityNew?: boolean;
}

export interface Player {
  id: number;
  name: string;
  avatar: string;
  arm: ArmIndex;
  color: PlayerColorId;
  capturesCount: number;
  ransomsCount: number;
}

export type MoveKind =
  | 'CHARGE'
  | 'EXIT_PRISON'
  | 'RANSOM'
  | 'CONTOUR'
  | 'SHORTCUT_STRAIGHT'
  | 'SHORTCUT_DIAGONAL'
  | 'ENTER_FINISH'
  | 'TRIPLE_DOUBLE_FINISH';

export interface MoveOption {
  id: string;
  tokenId: string;
  dieIndex?: 0 | 1;
  usesBothDice?: boolean;
  stepsUsed: number;
  kind: MoveKind;
  destination: TokenLocation;
  pathLocations: TokenLocation[];
  label: string;
  capturesEnemyIds: string[];
  autoPrison: boolean;
  autoHouse: boolean;
}

export interface CompensationState {
  benefactorId: number;
  returnToPlayerId: number;
  stepsRemaining: number;
}

export interface LogEntry {
  id: string;
  turn: number;
  message: string;
  type: 'info' | 'capture' | 'prison' | 'house' | 'ransom' | 'finish' | 'win' | 'burn';
  playerColor?: PlayerColorId;
}

export type TurnPhase = 'DRAW' | 'ROLL' | 'MOVE' | 'TRIPLE_DOUBLE_BONUS' | 'GAME_OVER';

export interface DrawState {
  round: number;
  contenderIds: number[];
  rolls: Record<number, number>;
  currentContenderPos: number;
  status: 'ROLLING' | 'TIE_PAUSE' | 'WINNER_PAUSE';
  winnerId: number | null;
  tiedMaxScore: number | null;
  nextContenderIds: number[] | null;
}

export interface GameState {
  players: Player[];
  tokens: Token[];
  firstPlayerIndex: number;
  currentPlayerIndex: number;
  turnNumber: number;
  phase: TurnPhase;
  draw: DrawState | null;
  dice: [number, number] | null;
  diceUsed: [boolean, boolean];
  selectedDieIndex: 0 | 1 | null;
  doublesStreak: number;
  compensation: CompensationState | null;
  endOfTurnResolved?: boolean;
  logs: LogEntry[];
  winnerId: number | null;
}

export const FINISH_LETTERS = ['Ш', 'И', 'Н', 'И', 'Ф'] as const;

export const PLAYER_THEMES: Record<PlayerColorId, PlayerColorTheme> = {
  blue: {
    id: 'blue',
    name: 'Синий',
    armLabel: 'Нижний луч',
    fill: '#2563EB',
    stroke: '#1E3A8A',
    ring: '#93C5FD',
    lightBg: 'rgba(37, 99, 235, 0.16)',
    textClass: 'text-blue-400',
    badgeBg: 'bg-blue-600',
  },
  red: {
    id: 'red',
    name: 'Красный',
    armLabel: 'Правый луч',
    fill: '#DC2626',
    stroke: '#7F1D1D',
    ring: '#FCA5A5',
    lightBg: 'rgba(220, 38, 38, 0.16)',
    textClass: 'text-red-400',
    badgeBg: 'bg-red-600',
  },
  green: {
    id: 'green',
    name: 'Зелёный',
    armLabel: 'Верхний луч',
    fill: '#16A34A',
    stroke: '#14532D',
    ring: '#86EFAC',
    lightBg: 'rgba(22, 163, 74, 0.16)',
    textClass: 'text-emerald-400',
    badgeBg: 'bg-emerald-600',
  },
  yellow: {
    id: 'yellow',
    name: 'Жёлтый',
    armLabel: 'Левый луч',
    fill: '#EAB308',
    stroke: '#713F12',
    ring: '#FEF08A',
    lightBg: 'rgba(234, 179, 8, 0.16)',
    textClass: 'text-amber-300',
    badgeBg: 'bg-amber-500',
  },
};

export const PLAYER_AVATARS = [
  '🦊',
  '🐺',
  '🐻',
  '🦁',
  '🐯',
  '🦅',
  '🐉',
  '🦈',
  '🦉',
  '🦝',
] as const;

export const DEFAULT_AVATAR_BY_COLOR: Record<PlayerColorId, string> = {
  blue: '🐺',
  red: '🦊',
  green: '🐉',
  yellow: '🦁',
};

export function formatPlayerLabel(player: Pick<Player, 'name' | 'color'>): string {
  const colorName = PLAYER_THEMES[player.color].name;
  const trimmed = player.name.trim();
  if (!trimmed) return colorName;
  if (trimmed.toLowerCase() === colorName.toLowerCase()) return colorName;
  return `${trimmed} (${colorName})`;
}

