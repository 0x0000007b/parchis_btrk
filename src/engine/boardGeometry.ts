import { ArmIndex, FINISH_LETTERS, TokenLocation } from '../types/game';

export const CELL_SIZE = 54;
export const BOARD_CENTER = 500;

export interface CellGeometry {
  id: string;
  x: number; // center x in 0..1000
  y: number; // center y in 0..1000
  w: number;
  h: number;
  rotation: number;
  label?: string;
  kind: 'start' | 'track' | 'prison' | 'house' | 'pre_finish' | 'finish' | 'center_x' | 'center_arrow';
  arm?: ArmIndex;
  cellNumber?: number;
  finishIndex?: number;
  arrowDeg?: number;
}

export interface CornerZoneGeometry {
  arm: ArmIndex;
  x: number;
  y: number;
  w: number;
  h: number;
  prisonerBox: { x: number; y: number; w: number; h: number };
  reserveSlots: Array<{ x: number; y: number }>;
}

/**
 * Rotate local bottom-arm offsets (dx, dy) around (500, 500)
 * arm 0: 0° (bottom)
 * arm 1: -90° CCW (right)
 * arm 2: 180° (top)
 * arm 3: +90° (left)
 */
export function rotateOffset(dx: number, dy: number, arm: ArmIndex): { x: number; y: number; rotation: number } {
  switch (arm) {
    case 0:
      return { x: BOARD_CENTER + dx, y: BOARD_CENTER + dy, rotation: 0 };
    case 1:
      return { x: BOARD_CENTER + dy, y: BOARD_CENTER - dx, rotation: -90 };
    case 2:
      return { x: BOARD_CENTER - dx, y: BOARD_CENTER - dy, rotation: 180 };
    case 3:
      return { x: BOARD_CENTER - dy, y: BOARD_CENTER + dx, rotation: 90 };
  }
}

export function buildBoardCells(): CellGeometry[] {
  const cells: CellGeometry[] = [];
  const C = CELL_SIZE;

  // Center X cell
  cells.push({
    id: 'center-x',
    x: BOARD_CENTER,
    y: BOARD_CENTER,
    w: C,
    h: C,
    rotation: 0,
    label: 'Х',
    kind: 'center_x',
  });

  // 4 Center counter-clockwise arrow cells
  const arrowConfigs: Array<{ id: string; dx: number; dy: number; arrowDeg: number }> = [
    { id: 'arrow-bottom', dx: 0, dy: C, arrowDeg: 0 },
    { id: 'arrow-right', dx: C, dy: 0, arrowDeg: -90 },
    { id: 'arrow-top', dx: 0, dy: -C, arrowDeg: 180 },
    { id: 'arrow-left', dx: -C, dy: 0, arrowDeg: 90 },
  ];

  for (const arr of arrowConfigs) {
    cells.push({
      id: arr.id,
      x: BOARD_CENTER + arr.dx,
      y: BOARD_CENTER + arr.dy,
      w: C,
      h: C,
      rotation: arr.arrowDeg,
      kind: 'center_arrow',
      arrowDeg: arr.arrowDeg,
    });
  }

  // 4 symmetric arms
  const arms: ArmIndex[] = [0, 1, 2, 3];
  for (const arm of arms) {
    // START pad: spans 3 columns (162w), 72h, centered at dy = 441
    const startPos = rotateOffset(0, 441, arm);
    const isHorizontalArm = arm === 1 || arm === 3;
    cells.push({
      id: `start-${arm}`,
      x: startPos.x,
      y: startPos.y,
      w: isHorizontalArm ? 72 : C * 3,
      h: isHorizontalArm ? C * 3 : 72,
      rotation: startPos.rotation,
      label: 'СТАРТ',
      kind: 'start',
      arm,
    });

    // Right column from outer to center: 1..7
    // 7 is at dy=C (54), 6 at 108, ..., 1 at 7*54 = 378
    for (let n = 1; n <= 7; n++) {
      const dy = (8 - n) * C;
      const pos = rotateOffset(C, dy, arm);
      cells.push({
        id: `track-${arm}-${n}`,
        x: pos.x,
        y: pos.y,
        w: C,
        h: C,
        rotation: pos.rotation,
        label: String(n),
        kind: 'track',
        arm,
        cellNumber: n,
      });
    }

    // Left column from center to outer: 8..13
    // 8 is at dy=2*C (108), ..., 13 at 7*C (378)
    for (let n = 8; n <= 13; n++) {
      const dy = (n - 6) * C;
      const pos = rotateOffset(-C, dy, arm);
      cells.push({
        id: `track-${arm}-${n}`,
        x: pos.x,
        y: pos.y,
        w: C,
        h: C,
        rotation: pos.rotation,
        label: String(n),
        kind: 'track',
        arm,
        cellNumber: n,
      });
    }

    // Prison (#) to the right of cell 2 (dx = +2*C, dy = 6*C = 324)
    const prisonPos = rotateOffset(C * 2, C * 6, arm);
    cells.push({
      id: `prison-${arm}`,
      x: prisonPos.x,
      y: prisonPos.y,
      w: C,
      h: C,
      rotation: prisonPos.rotation,
      label: '#',
      kind: 'prison',
      arm,
    });

    // House (Домик) to the left of cell 12 (dx = -2*C, dy = 6*C = 324)
    const housePos = rotateOffset(-C * 2, C * 6, arm);
    cells.push({
      id: `house-${arm}`,
      x: housePos.x,
      y: housePos.y,
      w: C,
      h: C,
      rotation: housePos.rotation,
      kind: 'house',
      arm,
    });

    // Pre-finish 14 in middle column just before START (dx = 0, dy = 7*C = 378)
    const preFinishPos = rotateOffset(0, C * 7, arm);
    cells.push({
      id: `prefinish-${arm}`,
      x: preFinishPos.x,
      y: preFinishPos.y,
      w: C,
      h: C,
      rotation: preFinishPos.rotation,
      label: '14',
      kind: 'pre_finish',
      arm,
      cellNumber: 14,
    });

    // 5 Finish cells from outer (14) to center: Ш, И, Н, И, Ф
    // index 0 (Ш) at dy=6*C (324), ..., index 4 (Ф) at dy=2*C (108)
    for (let idx = 0; idx < 5; idx++) {
      const dy = (6 - idx) * C;
      const fPos = rotateOffset(0, dy, arm);
      cells.push({
        id: `finish-${arm}-${idx}`,
        x: fPos.x,
        y: fPos.y,
        w: C,
        h: C,
        rotation: fPos.rotation,
        label: FINISH_LETTERS[idx],
        kind: 'finish',
        arm,
        finishIndex: idx,
      });
    }
  }

  return cells;
}

export function buildCornerZones(): Record<ArmIndex, CornerZoneGeometry> {
  // Compact corner cards: Prisoners pocket on top, 5-slot Reserve below
  const boxes: Record<ArmIndex, { x: number; y: number; w: number; h: number }> = {
    0: { x: 660, y: 758, w: 316, h: 218 },
    1: { x: 660, y: 24, w: 316, h: 218 },
    2: { x: 24, y: 24, w: 316, h: 218 },
    3: { x: 24, y: 758, w: 316, h: 218 },
  };

  const result = {} as Record<ArmIndex, CornerZoneGeometry>;
  ([0, 1, 2, 3] as ArmIndex[]).forEach((arm) => {
    const b = boxes[arm];
    const prisonerBox = {
      x: b.x + 14,
      y: b.y + 56,
      w: b.w - 28,
      h: 56,
    };

    const reserveSlots = [0, 1, 2, 3, 4].map((i) => ({
      x: b.x + 44 + i * 57,
      y: b.y + 178,
    }));

    result[arm] = {
      arm,
      ...b,
      prisonerBox,
      reserveSlots,
    };
  });

  return result;
}

export function getPrisonerPosition(
  zone: CornerZoneGeometry,
  index: number,
  total: number
): { x: number; y: number } {
  const box = zone.prisonerBox;
  const cy = box.y + box.h / 2;
  const startX = box.x + 28;
  const maxSpan = box.w - 56; // 232px usable span between leftmost & rightmost token centers

  if (total <= 1) {
    return { x: startX, y: cy };
  }
  if (total <= 3) {
    // 1–3 captured tokens sit side-by-side with crisp spacing
    return { x: startX + index * 42, y: cy };
  }
  // 4+ captured tokens dynamically compress and overlap into a neat fan/stack
  const step = Math.min(28, Math.floor(maxSpan / (total - 1)));
  const fanOffsetY = index % 2 === 0 ? -1.5 : 1.5;
  return {
    x: startX + index * step,
    y: cy + fanOffsetY,
  };
}

export const BOARD_CELLS = buildBoardCells();
export const CORNER_ZONES = buildCornerZones();

export function getLocationKey(loc: TokenLocation): string {
  switch (loc.kind) {
    case 'RESERVE':
      return 'reserve';
    case 'START':
      return `start-${loc.arm}`;
    case 'TRACK':
      return `track-${loc.arm}-${loc.cell}`;
    case 'PRISON':
      return `prison-${loc.arm}`;
    case 'HOUSE':
      return `house-${loc.arm}`;
    case 'PRE_FINISH':
      return `prefinish-${loc.arm}`;
    case 'FINISH':
      return `finish-${loc.arm}-${loc.index}`;
    case 'CAPTURED':
      return `captured-${loc.captorId}`;
  }
}

export function getCellCenterForLocation(loc: TokenLocation): { x: number; y: number } | null {
  const key = getLocationKey(loc);
  const found = BOARD_CELLS.find((c) => c.id === key);
  return found ? { x: found.x, y: found.y } : null;
}

export function getStackOffset(
  indexInStack: number,
  stackTotal: number,
  startArm?: ArmIndex
): { dx: number; dy: number } {
  if (stackTotal <= 1) return { dx: 0, dy: 0 };
  if (startArm !== undefined) {
    const spacing =
      stackTotal === 2 ? 40 : stackTotal === 3 ? 38 : stackTotal === 4 ? 35 : 29;
    const startOffset = -((stackTotal - 1) * spacing) / 2;
    const offset = startOffset + indexInStack * spacing;
    return startArm === 1 || startArm === 3 ? { dx: 0, dy: offset } : { dx: offset, dy: 0 };
  }
  const angle = (indexInStack / stackTotal) * Math.PI * 2 - Math.PI / 2;
  const radius = stackTotal === 2 ? 9 : 12;
  return {
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius,
  };
}
