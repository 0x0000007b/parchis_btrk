import React, { useEffect, useMemo, useState } from 'react';
import {
  BOARD_CELLS,
  CORNER_ZONES,
  CellGeometry,
  getCellCenterForLocation,
  getLocationKey,
  getPrisonerPosition,
  getStackOffset,
} from '../engine/boardGeometry';
import {
  ArmIndex,
  GameState,
  MoveOption,
  PLAYER_AVATARS,
  PLAYER_THEMES,
  Player,
  PlayerColorId,
  Token,
  TokenLocation,
} from '../types/game';

import { BoardRotationDeg } from '../types/online';

interface BoardProps {
  state: GameState;
  themeMode: 'light' | 'dark';
  availableMoves: MoveOption[];
  selectedTokenId: string | null;
  selectedDieIndex: 0 | 1 | null;
  hoveredMoveId: string | null;
  visualLocationOverrides?: Record<string, TokenLocation>;
  boardRotationDeg?: BoardRotationDeg;
  editablePlayerId?: number | null;
  onSelectToken: (tokenId: string) => void;
  onDeselectToken: () => void;
  onSelectMove: (move: MoveOption) => void;
  onHoverMove: (moveId: string | null) => void;
  onUpdatePlayerName: (playerId: number, name: string) => void;
  onUpdatePlayerAvatar: (playerId: number, avatar: string) => void;
}

const PLYWOOD_TEXTURE_URL = '/src/assets/images/plywood_board_texture_1794702379968.jpg';

const ARM_COLOR_BY_INDEX: Record<ArmIndex, PlayerColorId> = {
  0: 'blue',
  1: 'red',
  2: 'green',
  3: 'yellow',
};

const FINISH_STYLE_BY_COLOR: Record<
  'light' | 'dark',
  Record<PlayerColorId, { fill: string; stroke: string; text: string; innerAccent: string }>
> = {
  light: {
    blue: { fill: '#dfe7f4', stroke: '#7b96be', text: '#1e3a6e', innerAccent: '#2563eb' },
    red: { fill: '#f1e1e0', stroke: '#c08280', text: '#6e2220', innerAccent: '#dc2626' },
    green: { fill: '#dce9df', stroke: '#74a382', text: '#184b2b', innerAccent: '#16a34a' },
    yellow: { fill: '#f1ebd4', stroke: '#baa054', text: '#63480b', innerAccent: '#ca8a04' },
  },
  dark: {
    blue: { fill: '#1d293a', stroke: '#3c5c87', text: '#bfdbfe', innerAccent: '#60a5fa' },
    red: { fill: '#2f1f23', stroke: '#7d4146', text: '#fecaca', innerAccent: '#f87171' },
    green: { fill: '#1b2e26', stroke: '#3a6b54', text: '#bbf7d0', innerAccent: '#4ade80' },
    yellow: { fill: '#2c271a', stroke: '#786534', text: '#fef08a', innerAccent: '#facc15' },
  },
};

function getCellStyle(
  cell: CellGeometry,
  mode: 'light' | 'dark'
): { fill: string; stroke: string; strokeWidth: number; text: string; innerAccent?: string } {
  if (cell.kind === 'finish' && cell.arm !== undefined) {
    const armColor = ARM_COLOR_BY_INDEX[cell.arm];
    const palette = FINISH_STYLE_BY_COLOR[mode][armColor];
    return {
      fill: palette.fill,
      stroke: palette.stroke,
      strokeWidth: 1.9,
      text: palette.text,
      innerAccent: palette.innerAccent,
    };
  }

  if (mode === 'dark') {
    switch (cell.kind) {
      case 'start':
      case 'prison':
      case 'track':
      case 'pre_finish':
        return { fill: '#1E242B', stroke: '#36404d', strokeWidth: 1.8, text: '#dce2ea' };
      case 'house':
        return { fill: '#1E242B', stroke: '#d97706', strokeWidth: 2.6, text: '#fbbf24' };
      case 'finish':
        return { fill: '#1b3128', stroke: '#3c7a5d', strokeWidth: 2, text: '#a7f3d0' };
      case 'center_x':
      case 'center_arrow':
        return { fill: '#252d38', stroke: '#465466', strokeWidth: 2, text: '#e2e8f0' };
    }
  }

  // Light theme (Light Oak / Birch Plywood + Calm Matte Stone Cells)
  switch (cell.kind) {
    case 'start':
    case 'prison':
    case 'track':
    case 'pre_finish':
      return { fill: '#ece8e0', stroke: '#a19889', strokeWidth: 1.8, text: '#26231f' };
    case 'house':
      return { fill: '#f3efe6', stroke: '#d97706', strokeWidth: 2.6, text: '#b45309' };
    case 'finish':
      return { fill: '#cfe1d5', stroke: '#3a785c', strokeWidth: 2, text: '#14452f' };
    case 'center_x':
    case 'center_arrow':
      return { fill: '#dce1e7', stroke: '#7b8798', strokeWidth: 2, text: '#1e293b' };
  }
}

function getTargetBadgeText(move: MoveOption): string {
  if (move.kind === 'TRIPLE_DOUBLE_FINISH') return 'ФИНИШ ★';
  if (move.capturesEnemyIds.length > 0) return `СЪЕСТЬ +${move.stepsUsed}`;
  if (move.kind === 'SHORTCUT_STRAIGHT') return 'СРЕЗКА 1';
  if (move.kind === 'SHORTCUT_DIAGONAL') return 'СРЕЗКА 3';
  if (move.kind === 'CHARGE') return 'СТАРТ (6)';
  if (move.kind === 'EXIT_PRISON') return 'ВЫХОД (6)';
  if (move.kind === 'RANSOM') return 'ВЫКУП (6)';
  if (move.autoPrison) return `ТЮРЬМА +${move.stepsUsed}`;
  if (move.autoHouse) return `ДОМИК +${move.stepsUsed}`;
  if (move.usesBothDice) return `СУММА +${move.stepsUsed}`;
  return `+${move.stepsUsed}`;
}

function rotateBoardPoint(
  x: number,
  y: number,
  deg: BoardRotationDeg
): { x: number; y: number } {
  const dx = x - 500;
  const dy = y - 500;
  switch (deg) {
    case 0:
      return { x, y };
    case 90:
      return { x: 500 - dy, y: 500 + dx };
    case -90:
      return { x: 500 + dy, y: 500 - dx };
    case 180:
      return { x: 500 - dx, y: 500 - dy };
  }
}

function normalizeAngle(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

function getBottomLogicalArmForRotation(deg: BoardRotationDeg): ArmIndex {
  switch (deg) {
    case 0:
      return 0;
    case 90:
      return 1;
    case 180:
      return 2;
    case -90:
      return 3;
  }
}

export const Board: React.FC<BoardProps> = ({
  state,
  themeMode,
  availableMoves,
  selectedTokenId,
  selectedDieIndex,
  hoveredMoveId,
  visualLocationOverrides,
  boardRotationDeg = 0,
  editablePlayerId,
  onSelectToken,
  onDeselectToken,
  onSelectMove,
  onHoverMove,
  onUpdatePlayerName,
  onUpdatePlayerAvatar,
}) => {
  const bottomLogicalArm = getBottomLogicalArmForRotation(boardRotationDeg);
  const getScreenArm = (logicalArm: ArmIndex): ArmIndex =>
    (((logicalArm - bottomLogicalArm + 4) % 4) as ArmIndex);
  const getLogicalArmForScreen = (screenArm: ArmIndex): ArmIndex =>
    (((screenArm + bottomLogicalArm) % 4) as ArmIndex);
  const isDark = themeMode === 'dark';
  const [editingNamePlayerId, setEditingNamePlayerId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [openAvatarPlayerId, setOpenAvatarPlayerId] = useState<number | null>(null);

  useEffect(() => {
    if (openAvatarPlayerId === null) return;
    const handleOutsideClick = () => setOpenAvatarPlayerId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [openAvatarPlayerId]);

  const commitNameEdit = (player: Player) => {
    const trimmed = editingNameValue.trim();
    if (trimmed) {
      onUpdatePlayerName(player.id, trimmed);
    }
    setEditingNamePlayerId(null);
  };

  const playerById = useMemo(() => {
    const map = new Map<number, (typeof state.players)[number]>();
    state.players.forEach((p) => map.set(p.id, p));
    return map;
  }, [state.players]);

  const playerByArm = useMemo(() => {
    const map = new Map<ArmIndex, (typeof state.players)[number]>();
    state.players.forEach((p) => map.set(p.arm, p));
    return map;
  }, [state.players]);

  const movesByToken = useMemo(() => {
    const map = new Map<string, MoveOption[]>();
    for (const m of availableMoves) {
      const list = map.get(m.tokenId) ?? [];
      list.push(m);
      map.set(m.tokenId, list);
    }
    return map;
  }, [availableMoves]);

  const selectedTokenMoves = useMemo(() => {
    if (!selectedTokenId) return [];
    return movesByToken.get(selectedTokenId) ?? [];
  }, [selectedTokenId, movesByToken]);

  const activeRouteMove = useMemo(() => {
    if (selectedTokenMoves.length === 0) return null;
    if (hoveredMoveId) {
      const hovered = selectedTokenMoves.find((m) => m.id === hoveredMoveId);
      if (hovered) return hovered;
    }
    if (selectedDieIndex !== null) {
      const matchingDie = selectedTokenMoves.find((m) => m.dieIndex === selectedDieIndex);
      if (matchingDie) return matchingDie;
    }
    return selectedTokenMoves[0];
  }, [selectedTokenMoves, hoveredMoveId, selectedDieIndex]);

  const tokenPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();

    const cellGroups = new Map<string, { token: Token; loc: TokenLocation }[]>();
    const reserveGroups = new Map<number, Token[]>();
    const capturedGroups = new Map<number, Token[]>();

    for (const token of state.tokens) {
      const effectiveLoc = visualLocationOverrides?.[token.id] ?? token.location;
      if (effectiveLoc.kind === 'RESERVE') {
        const list = reserveGroups.get(token.ownerId) ?? [];
        list.push(token);
        reserveGroups.set(token.ownerId, list);
      } else if (effectiveLoc.kind === 'CAPTURED') {
        const list = capturedGroups.get(effectiveLoc.captorId) ?? [];
        list.push(token);
        capturedGroups.set(effectiveLoc.captorId, list);
      } else {
        const key = getLocationKey(effectiveLoc);
        const list = cellGroups.get(key) ?? [];
        list.push({ token, loc: effectiveLoc });
        cellGroups.set(key, list);
      }
    }

    reserveGroups.forEach((tokens, ownerId) => {
      const player = playerById.get(ownerId);
      if (!player) return;
      const zone = CORNER_ZONES[getScreenArm(player.arm)];
      tokens.forEach((t) => {
        const slot = zone.reserveSlots[t.index] ?? zone.reserveSlots[0];
        positions.set(t.id, { x: slot.x, y: slot.y });
      });
    });

    capturedGroups.forEach((tokens, captorId) => {
      const captor = playerById.get(captorId);
      if (!captor) return;
      const zone = CORNER_ZONES[getScreenArm(captor.arm)];
      tokens.forEach((t, idx) => {
        const pos = getPrisonerPosition(zone, idx, tokens.length);
        positions.set(t.id, pos);
      });
    });

    cellGroups.forEach((entries) => {
      const firstLoc = entries[0].loc;
      const center = getCellCenterForLocation(firstLoc);
      if (!center) return;
      const startArm = firstLoc.kind === 'START' ? firstLoc.arm : undefined;
      entries.forEach(({ token }, idx) => {
        const offset = getStackOffset(idx, entries.length, startArm);
        const rawPt = { x: center.x + offset.dx, y: center.y + offset.dy };
        positions.set(token.id, rotateBoardPoint(rawPt.x, rawPt.y, boardRotationDeg));
      });
    });

    return positions;
  }, [state.tokens, playerById, visualLocationOverrides, boardRotationDeg, bottomLogicalArm]);

  const occupiedCellIds = useMemo(() => {
    const ids = new Set<string>();
    for (const token of state.tokens) {
      const effectiveLoc = visualLocationOverrides?.[token.id] ?? token.location;
      if (effectiveLoc.kind !== 'RESERVE' && effectiveLoc.kind !== 'CAPTURED') {
        ids.add(getLocationKey(effectiveLoc));
      }
    }
    return ids;
  }, [state.tokens, visualLocationOverrides]);

  const trimEndpointToTargetBorder = (
    points: Array<{ x: number; y: number }>,
    dest: TokenLocation
  ): Array<{ x: number; y: number }> => {
    if (points.length < 2) return points;
    const prev = points[points.length - 2];
    const last = points[points.length - 1];
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;

    let trimmedLast = last;
    if (dest.kind === 'RESERVE') {
      const dist = Math.hypot(dx, dy);
      if (dist > 26) {
        const t = (dist - 26) / dist;
        trimmedLast = { x: prev.x + dx * t, y: prev.y + dy * t };
      }
    } else {
      const isStart = dest.kind === 'START';
      const screenStartArm = isStart ? getScreenArm(dest.arm) : 0;
      const isHorizStart = isStart && (screenStartArm === 1 || screenStartArm === 3);
      const halfW = (isStart ? (isHorizStart ? 70 : 158) : 52) / 2;
      const halfH = (isStart ? (isHorizStart ? 158 : 70) : 52) / 2;
      const tx = Math.abs(dx) > 0.001 ? halfW / Math.abs(dx) : Infinity;
      const ty = Math.abs(dy) > 0.001 ? halfH / Math.abs(dy) : Infinity;
      const tEdge = Math.min(tx, ty);
      if (tEdge < 1) {
        trimmedLast = { x: last.x - dx * tEdge, y: last.y - dy * tEdge };
      }
    }

    return [...points.slice(0, -1), trimmedLast];
  };

  const getRouteGeometry = (
    move: MoveOption
  ): { polylinePoints: Array<{ x: number; y: number }>; stepDots: Array<{ x: number; y: number }> } => {
    const token = state.tokens.find((t) => t.id === move.tokenId);
    const owner = token ? playerById.get(token.ownerId) : null;
    const startPos = tokenPositions.get(move.tokenId);

    const resolveLoc = (loc: TokenLocation, idx: number): { x: number; y: number } | null => {
      if (idx === 0 && startPos) return startPos;
      if (loc.kind === 'RESERVE' && owner && token) {
        return CORNER_ZONES[getScreenArm(owner.arm)].reserveSlots[token.index] ?? null;
      }
      if (loc.kind === 'CAPTURED' && loc.captorId !== undefined) {
        return startPos ?? null;
      }
      const center = getCellCenterForLocation(loc);
      return center ? rotateBoardPoint(center.x, center.y, boardRotationDeg) : null;
    };

    if (move.kind === 'SHORTCUT_DIAGONAL') {
      const p0 = resolveLoc(move.pathLocations[0], 0);
      const pEnd = resolveLoc(move.destination, 1);
      if (p0 && pEnd) {
        return {
          polylinePoints: trimEndpointToTargetBorder([p0, { x: 500, y: 500 }, pEnd], move.destination),
          stepDots: [{ x: 500, y: 500 }],
        };
      }
    }

    if (move.kind === 'SHORTCUT_STRAIGHT') {
      const p0 = resolveLoc(move.pathLocations[0], 0);
      const pEnd = resolveLoc(move.destination, 1);
      if (p0 && pEnd) {
        const mid = { x: (p0.x + pEnd.x) / 2, y: (p0.y + pEnd.y) / 2 };
        return {
          polylinePoints: trimEndpointToTargetBorder([p0, mid, pEnd], move.destination),
          stepDots: [mid],
        };
      }
    }

    const polylinePoints: Array<{ x: number; y: number }> = [];
    const stepDots: Array<{ x: number; y: number }> = [];

    move.pathLocations.forEach((loc, idx) => {
      // When exiting House onto cell 13, route orthogonally through cell 12 center
      // (visual bend only, without adding a step dot on 12)
      if (
        idx === 1 &&
        move.pathLocations[0].kind === 'HOUSE' &&
        loc.kind === 'TRACK' &&
        loc.cell === 13
      ) {
        const bend12 = getCellCenterForLocation({
          kind: 'TRACK',
          arm: move.pathLocations[0].arm,
          cell: 12,
        });
        if (bend12) polylinePoints.push(rotateBoardPoint(bend12.x, bend12.y, boardRotationDeg));
      }

      const pt = resolveLoc(loc, idx);
      if (pt) {
        polylinePoints.push(pt);
        if (idx > 0 && idx < move.pathLocations.length - 1) {
          stepDots.push(pt);
        }
      }
    });

    return {
      polylinePoints: trimEndpointToTargetBorder(polylinePoints, move.destination),
      stepDots,
    };
  };

  const activeRouteGeometry = useMemo(() => {
    if (!activeRouteMove) return { polylinePoints: [], stepDots: [] };
    return getRouteGeometry(activeRouteMove);
  }, [activeRouteMove, tokenPositions, boardRotationDeg]);

  const currentPlayer =
    state.phase === 'DRAW' && state.draw
      ? state.draw.winnerId !== null
        ? playerById.get(state.draw.winnerId)
        : state.draw.status === 'ROLLING'
        ? playerById.get(state.draw.contenderIds[state.draw.currentContenderPos])
        : undefined
      : state.phase === 'GAME_OVER'
      ? undefined
      : state.compensation
      ? playerById.get(state.compensation.benefactorId)
      : state.players[state.currentPlayerIndex];

  return (
    <div className="relative w-full aspect-square max-w-[min(95vw,840px)] lg:max-w-[min(calc(100dvh-4.75rem),860px)] mx-auto select-none">
      <div
        className={`w-full h-full rounded-2xl overflow-hidden transition-colors duration-200 ${
          isDark
            ? 'shadow-[0_24px_60px_rgba(0,0,0,0.7)] ring-2 ring-[#3b322b] bg-[#191613]'
            : 'shadow-[0_20px_50px_rgba(45,30,15,0.25)] ring-3 ring-[#b6926c] bg-[#e5c99f]'
        }`}
      >
        <svg
          viewBox="0 0 1000 1000"
          className="w-full h-full block"
          role="img"
          aria-label="Игровое поле Парчис"
          onClick={() => {
            if (openAvatarPlayerId !== null) setOpenAvatarPlayerId(null);
            if (selectedTokenId) onDeselectToken();
          }}
        >
          <defs>
            {/* Light Birch / Oak Plywood Pattern */}
            <pattern id="plywoodLight" patternUnits="userSpaceOnUse" width="1000" height="1000">
              <rect width="1000" height="1000" fill="#e5c99f" />
              <image
                href={PLYWOOD_TEXTURE_URL}
                x="-70"
                y="-70"
                width="1140"
                height="1140"
                preserveAspectRatio="xMidYMid slice"
              />
              <rect width="1000" height="1000" fill="rgba(248, 240, 224, 0.2)" />
            </pattern>

            {/* Dark Walnut / Anthracite Pattern */}
            <pattern id="plywoodDark" patternUnits="userSpaceOnUse" width="1000" height="1000">
              <rect width="1000" height="1000" fill="#171412" />
              <image
                href={PLYWOOD_TEXTURE_URL}
                x="-70"
                y="-70"
                width="1140"
                height="1140"
                preserveAspectRatio="xMidYMid slice"
                opacity="0.11"
              />
            </pattern>

            {/* 3D Tactile Radial Gradients for Player Tokens */}
            <radialGradient id="tokenGrad-blue" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="52%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </radialGradient>
            <radialGradient id="tokenGrad-red" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="52%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </radialGradient>
            <radialGradient id="tokenGrad-green" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="52%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#14532d" />
            </radialGradient>
            <radialGradient id="tokenGrad-yellow" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="52%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#854d0e" />
            </radialGradient>

            <filter id="tokenShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="0"
                dy="3.5"
                stdDeviation="2.8"
                floodColor="#000000"
                floodOpacity={isDark ? '0.68' : '0.42'}
              />
            </filter>
            <filter id="cellShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.2"
                floodColor="#000000"
                floodOpacity={isDark ? '0.45' : '0.16'}
              />
            </filter>
            <filter id="targetGlow" x="-35%" y="-35%" width="170%" height="170%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#facc15" floodOpacity="0.85" />
            </filter>
          </defs>

          {/* Board Surface */}
          <rect
            x="0"
            y="0"
            width="1000"
            height="1000"
            fill={isDark ? 'url(#plywoodDark)' : 'url(#plywoodLight)'}
          />
          <rect
            x="10"
            y="10"
            width="980"
            height="980"
            rx="16"
            fill="none"
            stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(92, 60, 30, 0.24)'}
            strokeWidth="2"
          />

          {/* 4 Compact Corner Zones (Prisoners on Top, Reserve Below) */}
          {([0, 1, 2, 3] as ArmIndex[]).map((screenArm) => {
            const zone = CORNER_ZONES[screenArm];
            const logicalArm = getLogicalArmForScreen(screenArm);
            const player = playerByArm.get(logicalArm);
            const theme = player ? PLAYER_THEMES[player.color] : null;
            const isCurrentTurn = player && currentPlayer && player.id === currentPlayer.id;
            const canEditPlayer =
              Boolean(player) &&
              (editablePlayerId === undefined || editablePlayerId === player?.id);

            const panelFill = isDark
              ? isCurrentTurn
                ? 'rgba(34, 41, 50, 0.94)'
                : 'rgba(23, 27, 33, 0.88)'
              : isCurrentTurn
              ? 'rgba(255, 253, 248, 0.88)'
              : 'rgba(250, 246, 238, 0.68)';

            const panelStroke =
              isCurrentTurn && theme
                ? theme.fill
                : isDark
                ? 'rgba(71, 85, 105, 0.5)'
                : 'rgba(130, 104, 78, 0.35)';

            const titleColor = isDark
              ? player
                ? '#f3efe9'
                : '#64748b'
              : player
              ? '#29221c'
              : '#786858';

            const subLabelColor = isDark ? '#94a3b8' : '#6c5c4d';
            const capturedCount = player
              ? state.tokens.filter(
                  (t) => t.location.kind === 'CAPTURED' && t.location.captorId === player.id
                ).length
              : 0;

            return (
              <g key={`corner-${screenArm}`} opacity={player ? 1 : 0.3}>
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.w}
                  height={zone.h}
                  rx="14"
                  fill={panelFill}
                  stroke={panelStroke}
                  strokeWidth={isCurrentTurn ? 3.4 : 1.8}
                  style={{
                    transition: 'fill 450ms ease, stroke 450ms ease, stroke-width 450ms ease',
                  }}
                />

                {/* Avatar (clickable strictly for emoji when editable) + Name & Color subtitle */}
                {player && theme ? (
                  <>
                    <g
                      className={canEditPlayer ? 'cursor-pointer' : 'cursor-default'}
                      onClick={(e) => {
                        if (!canEditPlayer) return;
                        e.stopPropagation();
                        setEditingNamePlayerId(null);
                        setOpenAvatarPlayerId((prev) => (prev === player.id ? null : player.id));
                      }}
                    >
                      {canEditPlayer && <title>Нажмите для выбора аватарки</title>}
                      <rect
                        x={zone.x + 14}
                        y={zone.y + 9}
                        width="28"
                        height="28"
                        rx="7"
                        fill={isDark ? '#14181d' : '#f3ede2'}
                        stroke={theme.fill}
                        strokeWidth="1.8"
                      />
                      <text
                        x={zone.x + 28}
                        y={zone.y + 23.5}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="15.5"
                      >
                        {player.avatar}
                      </text>
                    </g>

                    <foreignObject x={zone.x + 48} y={zone.y + 5} width={zone.w - 82} height="38">
                      <div className="w-full h-full flex flex-col justify-center min-w-0">
                        {canEditPlayer && editingNamePlayerId === player.id ? (
                          <input
                            type="text"
                            autoFocus
                            maxLength={14}
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitNameEdit(player);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingNamePlayerId(null);
                              }
                            }}
                            onBlur={() => commitNameEdit(player)}
                            aria-label={`Имя игрока ${theme.name}`}
                            className="w-full bg-transparent border-b border-amber-500/80 text-[13.5px] leading-[17px] font-bold outline-none p-0 m-0"
                            style={{
                              color: titleColor,
                              fontFamily: 'var(--font-display)',
                            }}
                          />
                        ) : canEditPlayer ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenAvatarPlayerId(null);
                              setEditingNameValue(player.name);
                              setEditingNamePlayerId(player.id);
                            }}
                            title="Нажмите на имя для редактирования"
                            className="w-full text-left truncate text-[13.5px] leading-[17px] font-bold cursor-text hover:underline decoration-amber-500/60 underline-offset-2 bg-transparent border-0 p-0 m-0"
                            style={{
                              color: titleColor,
                              fontFamily: 'var(--font-display)',
                            }}
                          >
                            {player.name}
                          </button>
                        ) : (
                          <div
                            className="w-full text-left truncate text-[13.5px] leading-[17px] font-bold"
                            style={{
                              color: titleColor,
                              fontFamily: 'var(--font-display)',
                            }}
                          >
                            {player.name}
                          </div>
                        )}
                        <div
                          className="text-[10.5px] leading-[13px] font-medium truncate mt-[1px]"
                          style={{ color: subLabelColor }}
                        >
                          {theme.name}
                        </div>
                      </div>
                    </foreignObject>

                    <circle
                      cx={zone.x + zone.w - 20}
                      cy={zone.y + 23}
                      r="7.5"
                      fill={theme.fill}
                      stroke="#ffffff"
                      strokeWidth="1.8"
                    />
                  </>
                ) : (
                  <text
                    x={zone.x + 16}
                    y={zone.y + 26}
                    fill={titleColor}
                    fontFamily="var(--font-display)"
                    fontWeight="700"
                    fontSize="15"
                  >
                    Свободно
                  </text>
                )}

                {/* Top Section: Prisoners (compact, non-clickable) */}
                <text
                  x={zone.x + 14}
                  y={zone.y + 51}
                  fill={subLabelColor}
                  fontFamily="var(--font-sans)"
                  fontWeight="700"
                  fontSize="10"
                  letterSpacing="0.06em"
                >
                  ПЛЕННЫЕ{capturedCount > 0 ? ` (${capturedCount})` : ''}
                </text>
                <rect
                  x={zone.prisonerBox.x}
                  y={zone.prisonerBox.y}
                  width={zone.prisonerBox.w}
                  height={zone.prisonerBox.h}
                  rx="10"
                  fill={isDark ? 'rgba(15, 19, 24, 0.65)' : 'rgba(120, 96, 70, 0.08)'}
                  stroke={isDark ? 'rgba(71, 85, 105, 0.35)' : 'rgba(120, 96, 70, 0.2)'}
                  strokeWidth="1.4"
                />

                <line
                  x1={zone.x + 14}
                  y1={zone.y + 123}
                  x2={zone.x + zone.w - 14}
                  y2={zone.y + 123}
                  stroke={isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(120, 96, 70, 0.18)'}
                  strokeWidth="1.4"
                />

                {/* Bottom Section: Reserve (5 token slots) */}
                <text
                  x={zone.x + 14}
                  y={zone.y + 141}
                  fill={subLabelColor}
                  fontFamily="var(--font-sans)"
                  fontWeight="700"
                  fontSize="10"
                  letterSpacing="0.06em"
                >
                  РЕЗЕРВ
                </text>

                {zone.reserveSlots.map((slot, idx) => (
                  <circle
                    key={`res-slot-${screenArm}-${idx}`}
                    cx={slot.x}
                    cy={slot.y}
                    r="21"
                    fill={isDark ? 'rgba(15, 19, 24, 0.7)' : 'rgba(120, 96, 70, 0.12)'}
                    stroke={
                      theme
                        ? isDark
                          ? 'rgba(148, 163, 184, 0.35)'
                          : 'rgba(120, 96, 70, 0.32)'
                        : 'rgba(120, 96, 70, 0.2)'
                    }
                    strokeWidth="1.8"
                  />
                ))}
              </g>
            );
          })}

          {/* Board Cross Cells */}
          {BOARD_CELLS.map((cell) => {
            const style = getCellStyle(cell, themeMode);
            const vPos = rotateBoardPoint(cell.x, cell.y, boardRotationDeg);
            const isQuarterTurn = boardRotationDeg === 90 || boardRotationDeg === -90;
            const vw = isQuarterTurn ? cell.h : cell.w;
            const vh = isQuarterTurn ? cell.w : cell.h;
            const left = vPos.x - vw / 2;
            const top = vPos.y - vh / 2;
            const startAccent =
              cell.kind === 'start' && cell.arm !== undefined
                ? PLAYER_THEMES[ARM_COLOR_BY_INDEX[cell.arm]].fill
                : null;
            const netRot = normalizeAngle(cell.rotation + boardRotationDeg);
            const contentRot =
              cell.kind === 'start' || cell.kind === 'center_arrow' || cell.kind === 'center_x'
                ? netRot
                : boardRotationDeg === 0
                ? cell.rotation
                : 0;

            return (
              <g key={cell.id} filter="url(#cellShadow)">
                <rect
                  x={left + 1.5}
                  y={top + 1.5}
                  width={vw - 3}
                  height={vh - 3}
                  rx="7"
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                />
                {style.innerAccent && (
                  <rect
                    x={left + 5}
                    y={top + 5}
                    width={vw - 10}
                    height={vh - 10}
                    rx="4.5"
                    fill="none"
                    stroke={style.innerAccent}
                    strokeWidth="1.2"
                    strokeOpacity={isDark ? 0.5 : 0.42}
                  />
                )}

                <g transform={`translate(${vPos.x}, ${vPos.y}) rotate(${contentRot})`}>
                  {cell.kind === 'start' && startAccent && (
                    <>
                      <rect
                        x="-74"
                        y="21"
                        width="148"
                        height="9"
                        rx="4.5"
                        fill={startAccent}
                      />
                      <g
                        transform={`translate(0, -6) rotate(${
                          netRot === 180 ? 180 : 0
                        })`}
                      >
                        <text
                          x="0"
                          y="0"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={style.text}
                          fontFamily="var(--font-display)"
                          fontWeight="700"
                          fontSize="24"
                          letterSpacing="0.08em"
                        >
                          {cell.label}
                        </text>
                      </g>
                    </>
                  )}

                  {cell.kind === 'house' && (
                    <g transform="translate(-14, -14)">
                      <path
                        d="M14 3.5L3.5 12.5h3v10.5h15V12.5h3L14 3.5z"
                        fill="none"
                        stroke={style.text}
                        strokeWidth="2.6"
                        strokeLinejoin="round"
                      />
                      <rect x="11.5" y="15" width="5" height="8" fill={style.text} rx="0.5" />
                    </g>
                  )}

                  {cell.kind === 'prison' && (
                    <g transform="translate(-14, -14)">
                      <path
                        d="M10.5 4.5L8.5 23.5M19.5 4.5L17.5 23.5M4.5 10.5H23.5M4.5 17.5H23.5"
                        fill="none"
                        stroke={style.text}
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {cell.kind === 'center_arrow' && (
                    <path
                      d="M-11 0 L9 0 M3 -7 L10 0 L3 7"
                      fill="none"
                      stroke={style.text}
                      strokeWidth="3.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {cell.kind === 'center_x' && (
                    <g
                      fill="none"
                      stroke={style.text}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {/* Crossed diagonal shafts */}
                      <path d="M-15 -15 L15 15 M15 -15 L-15 15" />
                      {/* 4 diagonal corner arrowheads: ↖ ↗ ↘ ↙ */}
                      <path d="M-15 -7.5 L-15 -15 L-7.5 -15" />
                      <path d="M7.5 -15 L15 -15 L15 -7.5" />
                      <path d="M15 7.5 L15 15 L7.5 15" />
                      <path d="M-7.5 15 L-15 15 L-15 7.5" />
                    </g>
                  )}

                  {cell.kind !== 'start' &&
                    cell.kind !== 'house' &&
                    cell.kind !== 'prison' &&
                    cell.kind !== 'center_arrow' &&
                    cell.kind !== 'center_x' &&
                    cell.label && (
                      <text
                        x="0"
                        y="1"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={style.text}
                        fontFamily="var(--font-display)"
                        fontWeight="700"
                        fontSize={cell.kind === 'finish' ? '23' : '21'}
                      >
                        {cell.label}
                      </text>
                    )}
                </g>
              </g>
            );
          })}

          {/* Tokens Layer (Enlarged 3D Volume Chips) */}
          {state.tokens.map((token) => {
            const pos = tokenPositions.get(token.id);
            const owner = playerById.get(token.ownerId);
            if (!pos || !owner) return null;

            const effectiveLoc = visualLocationOverrides?.[token.id] ?? token.location;
            const theme = PLAYER_THEMES[owner.color];
            const tokenMoves = movesByToken.get(token.id);
            const isMovable = Boolean(tokenMoves && tokenMoves.length > 0);
            const isSelected = selectedTokenId === token.id;
            const isFinished = effectiveLoc.kind === 'FINISH';
            const immunityTurns =
              effectiveLoc.kind === 'TRACK' && effectiveLoc.cell === 2
                ? token.prisonImmunityTurns ?? 0
                : 0;

            const handleTokenClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!isMovable || !tokenMoves) {
                if (selectedTokenId) onDeselectToken();
                return;
              }
              if (isSelected) {
                if (tokenMoves.length === 1) {
                  onSelectMove(tokenMoves[0]);
                }
                return;
              }
              onHoverMove(null);
              onSelectToken(token.id);
            };

            return (
              <g
                key={token.id}
                onClick={handleTokenClick}
                className={isMovable ? 'cursor-pointer' : 'cursor-default'}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {isMovable && <circle cx="0" cy="0" r="26" fill="transparent" />}

                {isSelected ? (
                  <>
                    <circle
                      cx="0"
                      cy="0"
                      r="24"
                      fill="rgba(250, 204, 21, 0.22)"
                      stroke="#ffffff"
                      strokeWidth="3.5"
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r="27"
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                    />
                  </>
                ) : (
                  <>
                    {immunityTurns > 0 && !isMovable && (
                      <circle
                        cx="0"
                        cy="0"
                        r="21"
                        fill="none"
                        stroke="#14b8a6"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                        opacity="0.9"
                      />
                    )}
                    {isMovable && (
                      <circle
                        cx="0"
                        cy="0"
                        r="22"
                        fill="none"
                        stroke={isDark ? '#fde047' : '#d97706'}
                        strokeWidth="3"
                        className="animate-target-pulse"
                      />
                    )}
                  </>
                )}

                <g filter="url(#tokenShadow)">
                  <circle
                    cx="0"
                    cy="0"
                    r="17.5"
                    fill={`url(#tokenGrad-${owner.color})`}
                    stroke="#ffffff"
                    strokeWidth="2.8"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="12"
                    fill="none"
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth="1.4"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="17.5"
                    fill="none"
                    stroke={theme.stroke}
                    strokeWidth="0.9"
                    opacity="0.55"
                  />
                </g>

                {isFinished ? (
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontFamily="var(--font-display)"
                    fontWeight="800"
                    fontSize="13"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.65)' }}
                  >
                    ★
                  </text>
                ) : (
                  <text
                    x="0"
                    y="0.5"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                    fontSize="12"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.75)' }}
                  >
                    {token.index + 1}
                  </text>
                )}

                {immunityTurns > 0 && (
                  <g transform="translate(16, 2)" className="pointer-events-none">
                    <title>{`Иммунитет от тюрьмы: осталось ходов — ${immunityTurns}`}</title>
                    <path
                      d="M0 -8.5 L7 -5.5 V1 C7 5.5 3.8 8.3 0 9.8 C-3.8 8.3 -7 5.5 -7 1 V-5.5 Z"
                      fill="#0f766e"
                      stroke="#ffffff"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <text
                      x="0"
                      y="0.5"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontFamily="var(--font-mono)"
                      fontWeight="800"
                      fontSize="9.5"
                    >
                      {immunityTurns}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Occupied Route Cell Corner Number Badges (1–14 always legible above tokens) */}
          <g className="pointer-events-none">
            {BOARD_CELLS.map((cell) => {
              if (
                (cell.kind !== 'track' && cell.kind !== 'pre_finish') ||
                !cell.label ||
                !occupiedCellIds.has(cell.id)
              ) {
                return null;
              }
              const style = getCellStyle(cell, themeMode);
              const vPos = rotateBoardPoint(cell.x, cell.y, boardRotationDeg);
              const badgeRot = boardRotationDeg === 0 ? cell.rotation : 0;
              return (
                <g
                  key={`occ-num-${cell.id}`}
                  transform={`translate(${vPos.x}, ${vPos.y}) rotate(${badgeRot})`}
                >
                  <rect
                    x="-25"
                    y="-25"
                    width="18"
                    height="13.5"
                    rx="3.5"
                    fill={isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 252, 246, 0.95)'}
                    stroke={style.stroke}
                    strokeWidth="1.1"
                  />
                  <text
                    x="-16"
                    y="-18"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isDark ? '#f8fafc' : '#1f1a16'}
                    fontFamily="var(--font-mono)"
                    fontWeight="800"
                    fontSize="9.5"
                  >
                    {cell.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Civilization-style Animated Route Line Overlay (no arrowhead; flows into glowing target border) */}
          {activeRouteGeometry.polylinePoints.length >= 2 && (
            <g className="pointer-events-none">
              <polyline
                points={activeRouteGeometry.polylinePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="rgba(15, 23, 42, 0.72)"
                strokeWidth="8.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={activeRouteGeometry.polylinePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#facc15"
                strokeWidth="4.2"
                strokeDasharray="9 5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-route-dash"
              />
              {activeRouteGeometry.stepDots.map((pt, idx) => (
                <circle
                  key={`step-dot-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="4.8"
                  fill="#facc15"
                  stroke="#1e1b4b"
                  strokeWidth="1.8"
                />
              ))}
            </g>
          )}

          {/* Highlighted Destination Confirmation Targets */}
          {selectedTokenMoves.map((move) => {
            const isActiveRoute = activeRouteMove?.id === move.id;
            const isCapture = move.capturesEnemyIds.length > 0;
            const isShortcut =
              move.kind === 'SHORTCUT_STRAIGHT' || move.kind === 'SHORTCUT_DIAGONAL';
            const isCombined = Boolean(move.usesBothDice);
            const badgeText = getTargetBadgeText(move);

            if (move.destination.kind === 'RESERVE') {
              const token = state.tokens.find((t) => t.id === move.tokenId);
              const owner = token ? playerById.get(token.ownerId) : null;
              if (!owner || !token) return null;
              const slot = CORNER_ZONES[getScreenArm(owner.arm)].reserveSlots[token.index];
              return (
                <g
                  key={`target-${move.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMove(move);
                  }}
                  onMouseEnter={() => onHoverMove(move.id)}
                  onMouseLeave={() => onHoverMove(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={slot.x}
                    cy={slot.y}
                    r="26"
                    fill="rgba(250, 204, 21, 0.28)"
                    stroke="#facc15"
                    strokeWidth="4"
                    className="animate-target-pulse"
                    style={{ transformOrigin: `${slot.x}px ${slot.y}px` }}
                  />
                </g>
              );
            }

            const rawCenter = getCellCenterForLocation(move.destination);
            if (!rawCenter) return null;
            const center = rotateBoardPoint(rawCenter.x, rawCenter.y, boardRotationDeg);
            const isStart = move.destination.kind === 'START';
            const screenStartArm =
              move.destination.kind === 'START' ? getScreenArm(move.destination.arm) : 0;
            const isHorizStart = isStart && (screenStartArm === 1 || screenStartArm === 3);
            const w = isStart ? (isHorizStart ? 70 : 158) : 52;
            const h = isStart ? (isHorizStart ? 158 : 70) : 52;

            const ringColor = isCapture
              ? '#ef4444'
              : isShortcut
              ? '#38bdf8'
              : isCombined
              ? '#10b981'
              : '#f59e0b';

            return (
              <g
                key={`target-${move.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMove(move);
                }}
                onMouseEnter={() => onHoverMove(move.id)}
                onMouseLeave={() => onHoverMove(null)}
                className="cursor-pointer"
              >
                <rect
                  x={center.x - w / 2 - 4}
                  y={center.y - h / 2 - 4}
                  width={w + 8}
                  height={h + 8}
                  fill="transparent"
                />
                <rect
                  x={center.x - w / 2}
                  y={center.y - h / 2}
                  width={w}
                  height={h}
                  rx="8"
                  fill={
                    isCapture
                      ? 'rgba(239, 68, 68, 0.22)'
                      : isCombined
                      ? isActiveRoute
                        ? 'rgba(16, 185, 129, 0.22)'
                        : 'rgba(16, 185, 129, 0.13)'
                      : isActiveRoute
                      ? 'rgba(250, 204, 21, 0.2)'
                      : 'rgba(250, 204, 21, 0.12)'
                  }
                  stroke={ringColor}
                  strokeWidth={isActiveRoute ? '4.5' : '3'}
                  filter={isActiveRoute ? 'url(#targetGlow)' : undefined}
                  className="animate-target-pulse"
                  style={{ transformOrigin: `${center.x}px ${center.y}px` }}
                />
                <g transform={`translate(${center.x}, ${center.y - h / 2 - 6})`}>
                  <rect
                    x="-39"
                    y="-15"
                    width="78"
                    height="17"
                    rx="4"
                    fill={
                      isCapture
                        ? '#dc2626'
                        : isShortcut
                        ? '#0284c7'
                        : isCombined
                        ? '#059669'
                        : '#d97706'
                    }
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="-6"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontFamily="var(--font-sans)"
                    fontWeight="700"
                    fontSize="9.5"
                  >
                    {badgeText}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Avatar-only Emoji Picker Popover */}
      {openAvatarPlayerId !== null && (() => {
        const avatarPlayer = playerById.get(openAvatarPlayerId);
        if (!avatarPlayer) return null;
        const screenArm = getScreenArm(avatarPlayer.arm);
        const zone = CORNER_ZONES[screenArm];
        const isTop = screenArm === 1 || screenArm === 2;
        const isLeft = screenArm === 2 || screenArm === 3;
        const posStyle: React.CSSProperties = {
          ...(isTop
            ? { top: `${((zone.y + 42) / 1000) * 100}%` }
            : { bottom: `${((1000 - (zone.y + 4)) / 1000) * 100}%` }),
          ...(isLeft
            ? { left: `${((zone.x + 14) / 1000) * 100}%` }
            : { right: `${((1000 - (zone.x + zone.w - 14)) / 1000) * 100}%` }),
        };

        return (
          <div
            onClick={(e) => e.stopPropagation()}
            style={posStyle}
            className="absolute z-40 p-2 rounded-xl bg-[#faf6ee] dark:bg-[#1f262f] border border-[#cbbda8] dark:border-[#3b4554] shadow-xl grid grid-cols-5 gap-1.5 w-[220px]"
          >
            {PLAYER_AVATARS.map((emoji) => {
              const selected = avatarPlayer.avatar === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onUpdatePlayerAvatar(avatarPlayer.id, emoji);
                    setOpenAvatarPlayerId(null);
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
        );
      })()}
    </div>
  );
};
