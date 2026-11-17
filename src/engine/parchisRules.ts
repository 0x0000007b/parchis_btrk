import {
  ArmIndex,
  DEFAULT_AVATAR_BY_COLOR,
  FINISH_LETTERS,
  GameState,
  LogEntry,
  MoveOption,
  PLAYER_THEMES,
  Player,
  PlayerColorId,
  Token,
  TokenLocation,
  formatPlayerLabel,
} from '../types/game';

// Clockwise arm order: Bottom (0, Blue) -> Left (3, Yellow) -> Top (2, Green) -> Right (1, Red)
const PLAYER_SLOTS_BY_COUNT: Record<2 | 3 | 4, Array<{ arm: ArmIndex; color: PlayerColorId }>> = {
  2: [
    { arm: 0, color: 'blue' },
    { arm: 2, color: 'green' },
  ],
  3: [
    { arm: 0, color: 'blue' },
    { arm: 3, color: 'yellow' },
    { arm: 2, color: 'green' },
  ],
  4: [
    { arm: 0, color: 'blue' },
    { arm: 3, color: 'yellow' },
    { arm: 2, color: 'green' },
    { arm: 1, color: 'red' },
  ],
};

let logCounter = 1;
function makeLog(
  turn: number,
  message: string,
  type: LogEntry['type'],
  playerColor?: PlayerColorId
): LogEntry {
  return {
    id: `log-${Date.now()}-${logCounter++}`,
    turn,
    message,
    type,
    playerColor,
  };
}

export function createInitialGameState(
  playerCount: 2 | 3 | 4,
  customNames?: Partial<Record<PlayerColorId, string>>,
  customAvatars?: Partial<Record<PlayerColorId, string>>
): GameState {
  const slots = PLAYER_SLOTS_BY_COUNT[playerCount];
  const players: Player[] = slots.map((slot, idx) => ({
    id: idx,
    name: customNames?.[slot.color]?.trim() || `Игрок ${idx + 1}`,
    avatar: customAvatars?.[slot.color] || DEFAULT_AVATAR_BY_COLOR[slot.color],
    arm: slot.arm,
    color: slot.color,
    capturesCount: 0,
    ransomsCount: 0,
  }));

  const tokens: Token[] = [];
  for (const p of players) {
    for (let i = 0; i < 5; i++) {
      tokens.push({
        id: `p${p.id}-t${i}`,
        ownerId: p.id,
        index: i,
        location: { kind: 'RESERVE' },
      });
    }
  }

  return {
    players,
    tokens,
    firstPlayerIndex: 0,
    currentPlayerIndex: 0,
    turnNumber: 1,
    phase: 'DRAW',
    draw: {
      round: 1,
      contenderIds: players.map((p) => p.id),
      rolls: {},
      currentContenderPos: 0,
      status: 'ROLLING',
      winnerId: null,
      tiedMaxScore: null,
      nextContenderIds: null,
    },
    dice: null,
    diceUsed: [false, false],
    selectedDieIndex: null,
    doublesStreak: 0,
    compensation: null,
    endOfTurnResolved: false,
    logs: [
      makeLog(
        1,
        'Жребий перед началом игры: бросьте по 1 кубику для определения первого хода.',
        'info'
      ),
    ],
    winnerId: null,
  };
}

export function createOnlineGameState(
  slots: Array<{
    playerId: number;
    arm: ArmIndex;
    color: PlayerColorId;
    name: string;
    avatar: string;
  }>
): GameState {
  const clockwiseColors: PlayerColorId[] = ['blue', 'yellow', 'green', 'red'];
  const ordered = [...slots].sort(
    (a, b) => clockwiseColors.indexOf(a.color) - clockwiseColors.indexOf(b.color)
  );

  const players: Player[] = ordered.map((slot, idx) => ({
    id: slot.playerId,
    name: slot.name.trim() || `Игрок ${idx + 1}`,
    avatar: slot.avatar || DEFAULT_AVATAR_BY_COLOR[slot.color],
    arm: slot.arm,
    color: slot.color,
    capturesCount: 0,
    ransomsCount: 0,
  }));

  const tokens: Token[] = [];
  for (const p of players) {
    for (let i = 0; i < 5; i++) {
      tokens.push({
        id: `p${p.id}-t${i}`,
        ownerId: p.id,
        index: i,
        location: { kind: 'RESERVE' },
      });
    }
  }

  return {
    players,
    tokens,
    firstPlayerIndex: 0,
    currentPlayerIndex: 0,
    turnNumber: 1,
    phase: 'DRAW',
    draw: {
      round: 1,
      contenderIds: players.map((p) => p.id),
      rolls: {},
      currentContenderPos: 0,
      status: 'ROLLING',
      winnerId: null,
      tiedMaxScore: null,
      nextContenderIds: null,
    },
    dice: null,
    diceUsed: [false, false],
    selectedDieIndex: null,
    doublesStreak: 0,
    compensation: null,
    endOfTurnResolved: false,
    logs: [
      makeLog(
        1,
        'Жребий перед началом игры: бросьте по 1 кубику для определения первого хода.',
        'info'
      ),
    ],
    winnerId: null,
  };
}

export function rollDrawDieInState(state: GameState, forcedRoll?: number): GameState {
  if (state.phase !== 'DRAW' || !state.draw || state.draw.status !== 'ROLLING') {
    return state;
  }

  const draw = state.draw;
  const contenderId = draw.contenderIds[draw.currentContenderPos];
  const contender = state.players.find((p) => p.id === contenderId);
  if (!contender) return state;

  const rolled = forcedRoll ?? Math.floor(Math.random() * 6) + 1;
  const nextRolls = { ...draw.rolls, [contenderId]: rolled };
  const rollLog = makeLog(
    1,
    `Жребий (раунд ${draw.round}): ${formatPlayerLabel(contender)} выбросил ${rolled}.`,
    'info',
    contender.color
  );

  // More contenders remain in this draw round
  if (draw.currentContenderPos + 1 < draw.contenderIds.length) {
    const nextPos = draw.currentContenderPos + 1;
    const nextContenderId = draw.contenderIds[nextPos];
    const nextIdx = state.players.findIndex((p) => p.id === nextContenderId);
    return {
      ...state,
      currentPlayerIndex: nextIdx >= 0 ? nextIdx : state.currentPlayerIndex,
      draw: {
        ...draw,
        rolls: nextRolls,
        currentContenderPos: nextPos,
      },
      logs: [rollLog, ...state.logs].slice(0, 60),
    };
  }

  // Round completed: determine max roll
  const maxScore = Math.max(...draw.contenderIds.map((id) => nextRolls[id]));
  const topIds = draw.contenderIds.filter((id) => nextRolls[id] === maxScore);

  if (topIds.length === 1) {
    const winnerId = topIds[0];
    const winnerIdx = state.players.findIndex((p) => p.id === winnerId);
    const winner = state.players[winnerIdx];
    const winLog = makeLog(
      1,
      `Победитель жребия — ${formatPlayerLabel(winner)} (${maxScore})! Он ходит первым.`,
      'finish',
      winner.color
    );
    return {
      ...state,
      currentPlayerIndex: winnerIdx,
      draw: {
        ...draw,
        rolls: nextRolls,
        status: 'WINNER_PAUSE',
        winnerId,
        tiedMaxScore: null,
        nextContenderIds: null,
      },
      logs: [winLog, rollLog, ...state.logs].slice(0, 60),
    };
  }

  // Tie between multiple contenders: repeat round only among tied leaders
  const tiedNames = topIds
    .map((id) => formatPlayerLabel(state.players.find((p) => p.id === id)!))
    .join(', ');
  const tieLog = makeLog(
    1,
    `Ничья в жребии (по ${maxScore})! Повторный бросок между: ${tiedNames}.`,
    'ransom'
  );

  return {
    ...state,
    draw: {
      ...draw,
      rolls: nextRolls,
      status: 'TIE_PAUSE',
      winnerId: null,
      tiedMaxScore: maxScore,
      nextContenderIds: topIds,
    },
    logs: [tieLog, rollLog, ...state.logs].slice(0, 60),
  };
}

export function advanceDrawAfterTie(state: GameState): GameState {
  if (
    state.phase !== 'DRAW' ||
    !state.draw ||
    state.draw.status !== 'TIE_PAUSE' ||
    !state.draw.nextContenderIds ||
    state.draw.nextContenderIds.length < 2
  ) {
    return state;
  }

  const nextContenders = state.draw.nextContenderIds;
  const firstIdx = state.players.findIndex((p) => p.id === nextContenders[0]);

  return {
    ...state,
    currentPlayerIndex: firstIdx >= 0 ? firstIdx : 0,
    draw: {
      round: state.draw.round + 1,
      contenderIds: nextContenders,
      rolls: {},
      currentContenderPos: 0,
      status: 'ROLLING',
      winnerId: null,
      tiedMaxScore: state.draw.tiedMaxScore,
      nextContenderIds: null,
    },
  };
}

export function startMatchFromDraw(state: GameState): GameState {
  if (state.phase !== 'DRAW' || !state.draw || state.draw.winnerId === null) {
    return state;
  }

  const winnerIdx = state.players.findIndex((p) => p.id === state.draw!.winnerId);
  if (winnerIdx < 0) return state;
  const winner = state.players[winnerIdx];

  return {
    ...state,
    firstPlayerIndex: winnerIdx,
    currentPlayerIndex: winnerIdx,
    turnNumber: 1,
    phase: 'ROLL',
    draw: null,
    dice: null,
    diceUsed: [false, false],
    selectedDieIndex: null,
    doublesStreak: 0,
    compensation: null,
    endOfTurnResolved: false,
    logs: [
      makeLog(
        1,
        `Игра началась! Первым ходит ${formatPlayerLabel(winner)}.`,
        'info',
        winner.color
      ),
      ...state.logs,
    ].slice(0, 60),
  };
}

export function getFarthestFreeFinishIndex(tokens: Token[], playerId: number): number | null {
  const occupied = new Set<number>();
  for (const t of tokens) {
    if (t.ownerId === playerId && t.location.kind === 'FINISH') {
      occupied.add(t.location.index);
    }
  }
  for (let idx = 4; idx >= 0; idx--) {
    if (!occupied.has(idx)) return idx;
  }
  return null;
}

/**
 * Outer perimeter path step:
 * ... -> 12 -> 13 -> 14 (PRE_FINISH) -> 1 -> 2 -> ... on non-home arms (never enters START pads).
 * On own arm at the end of the lap: 13 -> 14 -> Ш -> И -> Н -> И -> Ф.
 * START is used strictly as a launch pad (CHARGE for 6 -> step 1 onto cell 1).
 */
function stepForwardOne(loc: TokenLocation, ownerArm: ArmIndex): TokenLocation | null {
  switch (loc.kind) {
    case 'START':
      return { kind: 'TRACK', arm: loc.arm, cell: 1 };
    case 'HOUSE':
      return { kind: 'TRACK', arm: loc.arm, cell: 13 };
    case 'TRACK': {
      if (loc.cell >= 1 && loc.cell <= 6) {
        return { kind: 'TRACK', arm: loc.arm, cell: loc.cell + 1 };
      }
      if (loc.cell === 7) {
        return { kind: 'TRACK', arm: ((loc.arm + 1) % 4) as ArmIndex, cell: 8 };
      }
      if (loc.cell >= 8 && loc.cell <= 12) {
        return { kind: 'TRACK', arm: loc.arm, cell: loc.cell + 1 };
      }
      if (loc.cell === 13) {
        return { kind: 'PRE_FINISH', arm: loc.arm };
      }
      return null;
    }
    case 'PRE_FINISH':
      if (loc.arm === ownerArm) {
        return { kind: 'FINISH', arm: ownerArm, index: 0 };
      }
      return { kind: 'TRACK', arm: loc.arm, cell: 1 };
    case 'FINISH':
      if (loc.index < 4) {
        return { kind: 'FINISH', arm: ownerArm, index: (loc.index + 1) as 0 | 1 | 2 | 3 | 4 };
      }
      return null;
    default:
      return null;
  }
}

function getTokensAtBoardCell(tokens: Token[], loc: TokenLocation): Token[] {
  switch (loc.kind) {
    case 'START':
      return tokens.filter((t) => t.location.kind === 'START' && t.location.arm === loc.arm);
    case 'TRACK':
      return tokens.filter(
        (t) =>
          t.location.kind === 'TRACK' &&
          t.location.arm === loc.arm &&
          t.location.cell === loc.cell
      );
    case 'HOUSE':
      return tokens.filter((t) => t.location.kind === 'HOUSE' && t.location.arm === loc.arm);
    case 'PRISON':
      return tokens.filter((t) => t.location.kind === 'PRISON' && t.location.arm === loc.arm);
    case 'PRE_FINISH':
      return tokens.filter((t) => t.location.kind === 'PRE_FINISH' && t.location.arm === loc.arm);
    case 'FINISH':
      return tokens.filter(
        (t) =>
          t.location.kind === 'FINISH' &&
          t.location.arm === loc.arm &&
          t.location.index === loc.index
      );
    default:
      return [];
  }
}

function isStepLocationOccupied(tokens: Token[], loc: TokenLocation): boolean {
  return getTokensAtBoardCell(tokens, loc).length > 0;
}

function hasOwnTokenAt(tokens: Token[], playerId: number, loc: TokenLocation): boolean {
  return getTokensAtBoardCell(tokens, loc).some((t) => t.ownerId === playerId);
}

function getEnemyTokenIdsAt(tokens: Token[], playerId: number, loc: TokenLocation): string[] {
  return getTokensAtBoardCell(tokens, loc)
    .filter((t) => t.ownerId !== playerId)
    .map((t) => t.id);
}

function formatLocationLabel(loc: TokenLocation): string {
  switch (loc.kind) {
    case 'RESERVE':
      return 'Резерв';
    case 'START':
      return 'СТАРТ';
    case 'TRACK':
      return `клетка ${loc.cell}`;
    case 'PRISON':
      return 'Тюрьма #';
    case 'HOUSE':
      return 'Домик';
    case 'PRE_FINISH':
      return 'клетка 14';
    case 'FINISH':
      return `Финиш «${FINISH_LETTERS[loc.index]}»`;
    case 'CAPTURED':
      return 'Плен';
  }
}

export function getTripleDoubleBonusMoves(state: GameState, playerId: number): MoveOption[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const farthestFree = getFarthestFreeFinishIndex(state.tokens, playerId);
  if (farthestFree === null) return [];

  const dest: TokenLocation = {
    kind: 'FINISH',
    arm: player.arm,
    index: farthestFree as 0 | 1 | 2 | 3 | 4,
  };

  const moves: MoveOption[] = [];
  for (const token of state.tokens) {
    if (token.ownerId !== playerId) continue;
    const kind = token.location.kind;
    if (kind === 'TRACK' || kind === 'START' || kind === 'HOUSE' || kind === 'PRE_FINISH') {
      moves.push({
        id: `${token.id}-triple-double`,
        tokenId: token.id,
        stepsUsed: 0,
        kind: 'TRIPLE_DOUBLE_FINISH',
        destination: dest,
        pathLocations: [token.location, dest],
        label: `Супер-бонус на «${FINISH_LETTERS[farthestFree]}»`,
        capturesEnemyIds: [],
        autoPrison: false,
        autoHouse: false,
      });
    }
  }
  return moves;
}

export function getAvailableMovesForSteps(
  state: GameState,
  playerId: number,
  steps: number,
  isBonusStep: boolean,
  dieIndex?: 0 | 1,
  isCombinedSum = false
): MoveOption[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const ownerArm = player.arm;
  const farthestFreeFinish = getFarthestFreeFinishIndex(state.tokens, playerId);
  const myTokens = state.tokens.filter((t) => t.ownerId === playerId);
  const moves: MoveOption[] = [];
  const idTag = isCombinedSum ? 'sum' : `d${dieIndex ?? 'x'}`;
  const usesBothDice = isCombinedSum ? true : undefined;

  for (const token of myTokens) {
    const loc = token.location;

    // 1. Special 6 actions (single die 6 only: prohibited during bonus steps or combined 2+4=6!)
    if (!isBonusStep && !isCombinedSum && steps === 6) {
      // Charge onto own START (START allows multiple own tokens stacked; captures any enemy standing on START)
      if (loc.kind === 'RESERVE') {
        const startLoc: TokenLocation = { kind: 'START', arm: ownerArm };
        const captures = getEnemyTokenIdsAt(state.tokens, playerId, startLoc);
        moves.push({
          id: `${token.id}-charge-${idTag}`,
          tokenId: token.id,
          dieIndex,
          stepsUsed: 6,
          kind: 'CHARGE',
          destination: startLoc,
          pathLocations: [loc, startLoc],
          label: captures.length > 0 ? 'Зарядка на СТАРТ (съесть)' : 'Зарядка на СТАРТ (6)',
          capturesEnemyIds: captures,
          autoPrison: false,
          autoHouse: false,
        });
        continue;
      }

      // Exit Prison onto cell 2 (blocked if own token is on cell 2; captures enemy on cell 2)
      if (loc.kind === 'PRISON') {
        const dest: TokenLocation = { kind: 'TRACK', arm: loc.arm, cell: 2 };
        if (!hasOwnTokenAt(state.tokens, playerId, dest)) {
          const captures = getEnemyTokenIdsAt(state.tokens, playerId, dest);
          moves.push({
            id: `${token.id}-exit-prison-${idTag}`,
            tokenId: token.id,
            dieIndex,
            stepsUsed: 6,
            kind: 'EXIT_PRISON',
            destination: dest,
            pathLocations: [loc, dest],
            label: captures.length > 0 ? 'Выход на 2 (съесть)' : 'Выход из тюрьмы на 2 (6)',
            capturesEnemyIds: captures,
            autoPrison: false,
            autoHouse: false,
          });
        }
        continue;
      }

      if (loc.kind === 'CAPTURED') {
        const dest: TokenLocation = { kind: 'RESERVE' };
        moves.push({
          id: `${token.id}-ransom-${idTag}`,
          tokenId: token.id,
          dieIndex,
          stepsUsed: 6,
          kind: 'RANSOM',
          destination: dest,
          pathLocations: [loc, dest],
          label: 'Выкупить из плена (6)',
          capturesEnemyIds: [],
          autoPrison: false,
          autoHouse: false,
        });
        continue;
      }
    }

    // Tokens in RESERVE, PRISON, or CAPTURED cannot make regular field moves
    if (loc.kind === 'RESERVE' || loc.kind === 'PRISON' || loc.kind === 'CAPTURED') {
      continue;
    }

    // 2. Shortcuts from cell 7 (1 straight, 3 diagonal through X; strict 1-token-per-cell!)
    if (!isCombinedSum && loc.kind === 'TRACK' && loc.cell === 7) {
      if (steps === 1) {
        const nextArm = ((loc.arm + 1) % 4) as ArmIndex;
        const dest: TokenLocation = { kind: 'TRACK', arm: nextArm, cell: 7 };
        if (!hasOwnTokenAt(state.tokens, playerId, dest)) {
          const captures = getEnemyTokenIdsAt(state.tokens, playerId, dest);
          moves.push({
            id: `${token.id}-shortcut-1-${idTag}`,
            tokenId: token.id,
            dieIndex,
            stepsUsed: 1,
            kind: 'SHORTCUT_STRAIGHT',
            destination: dest,
            pathLocations: [loc, dest],
            label: captures.length > 0 ? 'Срезка 1 (съесть)' : 'Срезка по прямой (1)',
            capturesEnemyIds: captures,
            autoPrison: false,
            autoHouse: false,
          });
        }
      }
      if (steps === 3) {
        const oppArm = ((loc.arm + 2) % 4) as ArmIndex;
        const dest: TokenLocation = { kind: 'TRACK', arm: oppArm, cell: 7 };
        if (!hasOwnTokenAt(state.tokens, playerId, dest)) {
          const captures = getEnemyTokenIdsAt(state.tokens, playerId, dest);
          moves.push({
            id: `${token.id}-shortcut-3-${idTag}`,
            tokenId: token.id,
            dieIndex,
            stepsUsed: 3,
            kind: 'SHORTCUT_DIAGONAL',
            destination: dest,
            pathLocations: [loc, dest],
            label: captures.length > 0 ? 'Срезка Х (съесть)' : 'Срезка через Х (3)',
            capturesEnemyIds: captures,
            autoPrison: false,
            autoHouse: false,
          });
        }
      }
    }

    // 3. Regular perimeter / house exit / pre-finish / gradual finish path
    let cur: TokenLocation | null = loc;
    const pathLocations: TokenLocation[] = [loc];
    let blocked = false;

    for (let s = 1; s <= steps; s++) {
      if (!cur) {
        blocked = true;
        break;
      }
      cur = stepForwardOne(cur, ownerArm);
      if (!cur) {
        blocked = true;
        break;
      }
      pathLocations.push(cur);

      // Strict no-jumping: ANY token on strictly intermediate cell blocks path
      if (s < steps && isStepLocationOccupied(state.tokens, cur)) {
        blocked = true;
        break;
      }
    }

    if (blocked || !cur) continue;

    // Strict 1-token-per-cell: cannot end on any cell occupied by own token
    if (hasOwnTokenAt(state.tokens, playerId, cur)) {
      continue;
    }

    if (cur.kind === 'FINISH') {
      if (
        farthestFreeFinish === null ||
        cur.index > farthestFreeFinish ||
        isStepLocationOccupied(state.tokens, cur)
      ) {
        continue;
      }
      moves.push({
        id: `${token.id}-finish-${steps}-${idTag}`,
        tokenId: token.id,
        dieIndex,
        usesBothDice,
        stepsUsed: steps,
        kind: 'ENTER_FINISH',
        destination: cur,
        pathLocations,
        label: `Финиш «${FINISH_LETTERS[cur.index]}» (+${steps})`,
        capturesEnemyIds: [],
        autoPrison: false,
        autoHouse: false,
      });
      continue;
    }

    if (cur.kind === 'PRE_FINISH' || cur.kind === 'START') {
      const captures = getEnemyTokenIdsAt(state.tokens, playerId, cur);
      moves.push({
        id: `${token.id}-${cur.kind.toLowerCase()}-${steps}-${idTag}`,
        tokenId: token.id,
        dieIndex,
        usesBothDice,
        stepsUsed: steps,
        kind: 'CONTOUR',
        destination: cur,
        pathLocations,
        label:
          captures.length > 0
            ? `${formatLocationLabel(cur)} (съесть, +${steps})`
            : `${formatLocationLabel(cur)} (+${steps})`,
        capturesEnemyIds: captures,
        autoPrison: false,
        autoHouse: false,
      });
      continue;
    }

    if (cur.kind === 'TRACK') {
      const captures = getEnemyTokenIdsAt(state.tokens, playerId, cur);

      // Cell 12 -> enter House IMMEDIATELY whenever a step finishes on 12 and adjacent House is empty
      if (cur.cell === 12) {
        const houseLoc: TokenLocation = { kind: 'HOUSE', arm: cur.arm };
        const houseOccupied = isStepLocationOccupied(state.tokens, houseLoc);
        if (!houseOccupied) {
          moves.push({
            id: `${token.id}-house-${steps}-${idTag}`,
            tokenId: token.id,
            dieIndex,
            usesBothDice,
            stepsUsed: steps,
            kind: 'CONTOUR',
            destination: houseLoc,
            pathLocations: [...pathLocations, houseLoc],
            label:
              captures.length > 0
                ? `На 12 (съесть) → в Домик (+${steps})`
                : `В Домик (+${steps})`,
            capturesEnemyIds: captures,
            autoPrison: false,
            autoHouse: true,
          });
        } else {
          moves.push({
            id: `${token.id}-track12-${steps}-${idTag}`,
            tokenId: token.id,
            dieIndex,
            usesBothDice,
            stepsUsed: steps,
            kind: 'CONTOUR',
            destination: cur,
            pathLocations,
            label:
              captures.length > 0
                ? `Клетка 12 (съесть, +${steps})`
                : `Клетка 12 (+${steps})`,
            capturesEnemyIds: captures,
            autoPrison: false,
            autoHouse: false,
          });
        }
        continue;
      }

      // Cell 2 -> enter Prison immediately ONLY on bonus step (compensation);
      // during normal turns, stay on cell 2 until the entire turn finishes
      if (cur.cell === 2) {
        const prisonLoc: TokenLocation = { kind: 'PRISON', arm: cur.arm };
        const prisonOccupied = isStepLocationOccupied(state.tokens, prisonLoc);
        if (isBonusStep && !prisonOccupied) {
          moves.push({
            id: `${token.id}-prison-${steps}-${idTag}`,
            tokenId: token.id,
            dieIndex,
            usesBothDice,
            stepsUsed: steps,
            kind: 'CONTOUR',
            destination: prisonLoc,
            pathLocations: [...pathLocations, prisonLoc],
            label:
              captures.length > 0
                ? `На 2 (съесть) → Тюрьма # (+${steps})`
                : `В Тюрьму # (+${steps})`,
            capturesEnemyIds: captures,
            autoPrison: true,
            autoHouse: false,
          });
        } else {
          moves.push({
            id: `${token.id}-track2-${steps}-${idTag}`,
            tokenId: token.id,
            dieIndex,
            usesBothDice,
            stepsUsed: steps,
            kind: 'CONTOUR',
            destination: cur,
            pathLocations,
            label:
              captures.length > 0
                ? `Клетка 2 (съесть, +${steps})`
                : `Клетка 2 (+${steps})`,
            capturesEnemyIds: captures,
            autoPrison: false,
            autoHouse: false,
          });
        }
        continue;
      }

      moves.push({
        id: `${token.id}-track-${steps}-${idTag}`,
        tokenId: token.id,
        dieIndex,
        usesBothDice,
        stepsUsed: steps,
        kind: 'CONTOUR',
        destination: cur,
        pathLocations,
        label:
          captures.length > 0
            ? `${formatLocationLabel(cur)} (съесть, +${steps})`
            : `${formatLocationLabel(cur)} (+${steps})`,
        capturesEnemyIds: captures,
        autoPrison: false,
        autoHouse: false,
      });
    }
  }

  return moves;
}

export function getAllLegalMovesForCurrentTurn(state: GameState): MoveOption[] {
  if (state.phase === 'GAME_OVER') return [];
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return [];

  if (state.phase === 'TRIPLE_DOUBLE_BONUS') {
    return getTripleDoubleBonusMoves(state, currentPlayer.id);
  }

  if (state.phase !== 'MOVE' || !state.dice) return [];

  const all: MoveOption[] = [];
  const seenDoubleKey = new Set<string>();
  const isSameUnusedValues =
    !state.diceUsed[0] && !state.diceUsed[1] && state.dice[0] === state.dice[1];

  for (const idx of [0, 1] as const) {
    if (state.diceUsed[idx]) continue;
    const moves = getAvailableMovesForSteps(state, currentPlayer.id, state.dice[idx], false, idx);
    for (const m of moves) {
      if (isSameUnusedValues) {
        const key = `${m.tokenId}-${m.kind}-${JSON.stringify(m.destination)}`;
        if (seenDoubleKey.has(key)) continue;
        seenDoubleKey.add(key);
      }
      all.push(m);
    }
  }

  // Full combined move using the sum of both unused dice
  if (!state.diceUsed[0] && !state.diceUsed[1]) {
    const sumSteps = state.dice[0] + state.dice[1];
    const sumMoves = getAvailableMovesForSteps(
      state,
      currentPlayer.id,
      sumSteps,
      false,
      undefined,
      true
    );
    all.push(...sumMoves);
  }

  // Mandatory full-move rule:
  // 1) Prefer moves that allow using both dice (or win the game).
  // 2) If impossible to use both dice, force the larger die whenever it has legal moves.
  if (!state.diceUsed[0] && !state.diceUsed[1] && !state.compensation && all.length > 0) {
    const promising = all.filter((m) => {
      if (m.usesBothDice) return true;
      if (m.dieIndex === undefined) return false;
      const remainingIdx: 0 | 1 = m.dieIndex === 0 ? 1 : 0;
      const afterFirst = applyMove(state, m, m.dieIndex);
      if (afterFirst.phase === 'GAME_OVER') return true;
      if (afterFirst.compensation) {
        const compMoves = getAvailableMovesForSteps(
          afterFirst,
          afterFirst.compensation.benefactorId,
          6,
          true
        );
        return compMoves.some((cm) => {
          const afterComp = applyMove(afterFirst, cm);
          if (afterComp.phase === 'GAME_OVER') return true;
          return (
            afterComp.dice !== null &&
            !afterComp.diceUsed[remainingIdx] &&
            getAvailableMovesForSteps(
              afterComp,
              currentPlayer.id,
              afterComp.dice[remainingIdx],
              false,
              remainingIdx
            ).length > 0
          );
        });
      }
      return (
        afterFirst.currentPlayerIndex === state.currentPlayerIndex &&
        afterFirst.dice !== null &&
        !afterFirst.diceUsed[remainingIdx] &&
        getAvailableMovesForSteps(
          afterFirst,
          currentPlayer.id,
          afterFirst.dice[remainingIdx],
          false,
          remainingIdx
        ).length > 0
      );
    });
    if (promising.length > 0) {
      return promising;
    }

    if (state.dice[0] !== state.dice[1]) {
      const largerDieIdx: 0 | 1 = state.dice[0] > state.dice[1] ? 0 : 1;
      const largerMoves = all.filter((m) => m.dieIndex === largerDieIdx);
      if (largerMoves.length > 0) {
        return largerMoves;
      }
    }
  }

  return all;
}

export function getDieHasMoves(state: GameState): [boolean, boolean] {
  if (state.phase !== 'MOVE' || !state.dice || state.compensation) {
    return [false, false];
  }
  const legal = getAllLegalMovesForCurrentTurn(state);
  const hasCombined = legal.some((m) => m.usesBothDice);
  const isSameUnused =
    !state.diceUsed[0] && !state.diceUsed[1] && state.dice[0] === state.dice[1];

  const can0 = !state.diceUsed[0] && (hasCombined || legal.some((m) => m.dieIndex === 0));
  const can1 =
    !state.diceUsed[1] &&
    (isSameUnused ? can0 : hasCombined || legal.some((m) => m.dieIndex === 1));

  return [can0, can1];
}

export function getAvailableBonusStepCounts(state: GameState): number[] {
  if (!state.compensation) return [];
  const { benefactorId } = state.compensation;
  // Strict rule: ransom compensation must be used as one continuous 6-step move
  return getAvailableMovesForSteps(state, benefactorId, 6, true).length > 0 ? [6] : [];
}

export function getBestDefaultDieIndex(state: GameState): 0 | 1 | null {
  if (!state.dice) return null;
  const [can0, can1] = getDieHasMoves(state);

  if (can0) return 0;
  if (can1) return 1;
  if (!state.diceUsed[0]) return 0;
  if (!state.diceUsed[1]) return 1;
  return null;
}

export function hasAnyLegalMoveForRemainingDice(state: GameState): boolean {
  return getAllLegalMovesForCurrentTurn(state).length > 0;
}

export function rollDiceInState(state: GameState, d1?: number, d2?: number): GameState {
  if (state.phase !== 'ROLL' || state.compensation) return state;
  const die1 = d1 ?? Math.floor(Math.random() * 6) + 1;
  const die2 = d2 ?? Math.floor(Math.random() * 6) + 1;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isDouble = die1 === die2;
  const nextDoublesStreak = isDouble ? state.doublesStreak + 1 : 0;

  const playerLabel = formatPlayerLabel(currentPlayer);
  const rollMessage =
    isDouble && nextDoublesStreak >= 3
      ? `${playerLabel} выбросил 3-й дубль подряд (${die1}-${die2})! Сначала походите кубиками, затем активируется супер-бонус на ФИНИШ.`
      : isDouble
      ? `${playerLabel} выбросил дубль ${die1}-${die2}! (дублей подряд: ${nextDoublesStreak})`
      : `${playerLabel} бросил кубики: ${die1} и ${die2}.`;

  const nextState: GameState = {
    ...state,
    phase: 'MOVE',
    dice: [die1, die2],
    diceUsed: [false, false],
    selectedDieIndex: null,
    doublesStreak: nextDoublesStreak,
    endOfTurnResolved: false,
    logs: [
      makeLog(
        state.turnNumber,
        rollMessage,
        isDouble && nextDoublesStreak >= 3 ? 'finish' : 'info',
        currentPlayer.color
      ),
      ...state.logs,
    ].slice(0, 60),
  };

  nextState.selectedDieIndex = getBestDefaultDieIndex(nextState);
  return nextState;
}

export function hasPendingEndOfTurnTraps(state: GameState): boolean {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return false;
  for (const token of state.tokens) {
    if (token.ownerId !== currentPlayer.id) continue;
    if (token.location.kind === 'TRACK' && token.location.cell === 2) {
      const stillProtected =
        Boolean(token.prisonImmunityNew) ||
        (token.prisonImmunityTurns !== undefined && token.prisonImmunityTurns > 1);
      if (
        !stillProtected &&
        !isStepLocationOccupied(state.tokens, { kind: 'PRISON', arm: token.location.arm })
      ) {
        return true;
      }
    } else if (token.location.kind === 'TRACK' && token.location.cell === 12) {
      if (!isStepLocationOccupied(state.tokens, { kind: 'HOUSE', arm: token.location.arm })) {
        return true;
      }
    }
  }
  return false;
}

export function isTurnReadyToAdvance(state: GameState): boolean {
  return (
    state.phase === 'MOVE' &&
    !state.compensation &&
    state.diceUsed[0] &&
    state.diceUsed[1]
  );
}

export function resolveEndOfTurnPrisonAndHouse(state: GameState): GameState {
  if (state.endOfTurnResolved) return state;
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return state;

  const playerLabel = formatPlayerLabel(currentPlayer);
  let nextTokens = state.tokens;
  const extraLogs: LogEntry[] = [];
  let changed = false;

  for (const token of state.tokens) {
    if (token.ownerId !== currentPlayer.id) continue;

    if (token.location.kind === 'TRACK' && token.location.cell === 2) {
      // Newly freed on this exact turn -> stays at immunity 3 and clears the transient flag
      if (token.prisonImmunityNew) {
        changed = true;
        nextTokens = nextTokens.map((t) =>
          t.id === token.id ? { ...t, prisonImmunityTurns: 3, prisonImmunityNew: false } : t
        );
        continue;
      }

      // Immunity still active for next turn(s) -> decrement by 1 and keep safe on cell 2
      if (token.prisonImmunityTurns !== undefined && token.prisonImmunityTurns > 1) {
        const nextTurns = token.prisonImmunityTurns - 1;
        changed = true;
        nextTokens = nextTokens.map((t) =>
          t.id === token.id
            ? { ...t, prisonImmunityTurns: nextTurns, prisonImmunityNew: false }
            : t
        );
        continue;
      }

      // No immunity or final (3rd) turn expired (1 -> 0) -> attempt Prison entry
      const hadImmunity = token.prisonImmunityTurns !== undefined;
      const prisonLoc: TokenLocation = { kind: 'PRISON', arm: token.location.arm };
      if (!isStepLocationOccupied(nextTokens, prisonLoc)) {
        changed = true;
        nextTokens = nextTokens.map((t) =>
          t.id === token.id
            ? {
                ...t,
                location: prisonLoc,
                prisonImmunityTurns: undefined,
                prisonImmunityNew: undefined,
              }
            : t
        );
        extraLogs.push(
          makeLog(
            state.turnNumber,
            hadImmunity
              ? `${playerLabel}: иммунитет на клетке 2 истёк — фишка снова в Тюрьме #!`
              : `${playerLabel} завершил ход на клетке 2 и угодил в Тюрьму #!`,
            'prison',
            currentPlayer.color
          )
        );
      } else if (hadImmunity) {
        changed = true;
        nextTokens = nextTokens.map((t) =>
          t.id === token.id
            ? { ...t, prisonImmunityTurns: undefined, prisonImmunityNew: undefined }
            : t
        );
        extraLogs.push(
          makeLog(
            state.turnNumber,
            `${playerLabel}: иммунитет на клетке 2 истёк (Тюрьма # занята).`,
            'info',
            currentPlayer.color
          )
        );
      }
    } else if (token.location.kind === 'TRACK' && token.location.cell === 12) {
      const houseLoc: TokenLocation = { kind: 'HOUSE', arm: token.location.arm };
      if (!isStepLocationOccupied(nextTokens, houseLoc)) {
        changed = true;
        nextTokens = nextTokens.map((t) =>
          t.id === token.id ? { ...t, location: houseLoc } : t
        );
        extraLogs.push(
          makeLog(
            state.turnNumber,
            `${playerLabel} зашёл с клетки 12 в Домик.`,
            'house',
            currentPlayer.color
          )
        );
      }
    }
  }

  return {
    ...state,
    tokens: changed ? nextTokens : state.tokens,
    endOfTurnResolved: true,
    logs:
      extraLogs.length > 0
        ? [...extraLogs.reverse(), ...state.logs].slice(0, 60)
        : state.logs,
  };
}

export function advanceToNextTurn(state: GameState, skippedMessage?: string): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const preLogs = [...state.logs];
  if (skippedMessage) {
    preLogs.unshift(makeLog(state.turnNumber, skippedMessage, 'burn', currentPlayer.color));
  }

  const resolved = resolveEndOfTurnPrisonAndHouse({
    ...state,
    logs: preLogs.slice(0, 60),
  });

  const nextPlayerIndex = (resolved.currentPlayerIndex + 1) % resolved.players.length;
  const nextTurn =
    nextPlayerIndex === resolved.firstPlayerIndex ? resolved.turnNumber + 1 : resolved.turnNumber;
  const nextPlayer = resolved.players[nextPlayerIndex];

  const finalLogs = [
    makeLog(
      nextTurn,
      `Ход переходит к игроку ${formatPlayerLabel(nextPlayer)}.`,
      'info',
      nextPlayer.color
    ),
    ...resolved.logs,
  ].slice(0, 60);

  return {
    ...resolved,
    currentPlayerIndex: nextPlayerIndex,
    turnNumber: nextTurn,
    phase: 'ROLL',
    dice: null,
    diceUsed: [false, false],
    selectedDieIndex: null,
    doublesStreak: 0,
    compensation: null,
    endOfTurnResolved: false,
    logs: finalLogs,
  };
}

function tryActivateTripleDoubleOrAdvance(
  state: GameState,
  skippedMessage?: string,
  deferTurnAdvance = false
): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return state;

  const bonusMoves = getTripleDoubleBonusMoves(state, currentPlayer.id);
  const playerLabel = formatPlayerLabel(currentPlayer);

  if (bonusMoves.length > 0) {
    const newLogs = [...state.logs];
    if (skippedMessage) {
      newLogs.unshift(makeLog(state.turnNumber, skippedMessage, 'burn', currentPlayer.color));
    }
    newLogs.unshift(
      makeLog(
        state.turnNumber,
        `Супер-бонус за 3-й дубль подряд! ${playerLabel}: выберите любую свою фишку на поле для отправки на ФИНИШ!`,
        'finish',
        currentPlayer.color
      )
    );
    return {
      ...state,
      phase: 'TRIPLE_DOUBLE_BONUS',
      diceUsed: [true, true],
      selectedDieIndex: null,
      doublesStreak: 3,
      compensation: null,
      logs: newLogs.slice(0, 60),
    };
  }

  const burnMessage = `${playerLabel}: на поле нет подходящих фишек — супер-бонус за 3-й дубль сгорает.`;
  const combinedMessage = skippedMessage ? `${skippedMessage} ${burnMessage}` : burnMessage;
  if (deferTurnAdvance) {
    return {
      ...state,
      phase: 'MOVE',
      diceUsed: [true, true],
      selectedDieIndex: null,
      doublesStreak: 0,
      logs: [makeLog(state.turnNumber, combinedMessage, 'burn', currentPlayer.color), ...state.logs].slice(0, 60),
    };
  }
  return advanceToNextTurn({ ...state, doublesStreak: 0 }, combinedMessage);
}

/**
 * Called when no legal moves remain for unused dice.
 * If the current roll was a double (and streak < 3), the player ALWAYS keeps the turn and gets an extra roll.
 * On the 3rd double, activates TRIPLE_DOUBLE_BONUS if eligible field tokens exist.
 */
export function handleNoMovesRemaining(
  state: GameState,
  skippedMessage?: string,
  options?: { deferTurnAdvance?: boolean }
): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return state;

  if (state.doublesStreak >= 3) {
    return tryActivateTripleDoubleOrAdvance(state, skippedMessage, options?.deferTurnAdvance);
  }

  if (state.doublesStreak > 0 && state.doublesStreak < 3) {
    const newLogs = [...state.logs];
    if (skippedMessage) {
      newLogs.unshift(makeLog(state.turnNumber, skippedMessage, 'burn', currentPlayer.color));
    }
    newLogs.unshift(
      makeLog(
        state.turnNumber,
        `${formatPlayerLabel(currentPlayer)} выбросил дубль и всё равно получает повторный бросок!`,
        'info',
        currentPlayer.color
      )
    );
    return {
      ...state,
      phase: 'ROLL',
      dice: null,
      diceUsed: [false, false],
      selectedDieIndex: null,
      compensation: null,
      endOfTurnResolved: false,
      logs: newLogs.slice(0, 60),
    };
  }

  if (options?.deferTurnAdvance) {
    const newLogs = [...state.logs];
    if (skippedMessage) {
      newLogs.unshift(makeLog(state.turnNumber, skippedMessage, 'burn', currentPlayer.color));
    }
    return {
      ...state,
      phase: 'MOVE',
      diceUsed: [true, true],
      selectedDieIndex: null,
      logs: newLogs.slice(0, 60),
    };
  }

  return advanceToNextTurn(state, skippedMessage);
}

function checkWinner(tokens: Token[], playerId: number): boolean {
  const finishedCount = tokens.filter(
    (t) => t.ownerId === playerId && t.location.kind === 'FINISH'
  ).length;
  return finishedCount === 5;
}

export function applyMove(
  state: GameState,
  move: MoveOption,
  usedDieIndex?: 0 | 1,
  options?: { deferTurnAdvance?: boolean }
): GameState {
  const isCompensation = Boolean(state.compensation);
  const actingPlayerId = isCompensation
    ? state.compensation!.benefactorId
    : state.players[state.currentPlayerIndex].id;
  const actingPlayer = state.players.find((p) => p.id === actingPlayerId)!;
  const movingToken = state.tokens.find((t) => t.id === move.tokenId)!;

  let ransomedFromCaptorId: number | null = null;
  if (move.kind === 'RANSOM' && movingToken.location.kind === 'CAPTURED') {
    ransomedFromCaptorId = movingToken.location.captorId;
  }

  const nextTokens = state.tokens.map((t) => {
    if (t.id === move.tokenId) {
      if (move.kind === 'EXIT_PRISON') {
        return {
          ...t,
          location: move.destination,
          prisonImmunityTurns: 3,
          prisonImmunityNew: true,
        };
      }
      return {
        ...t,
        location: move.destination,
        prisonImmunityTurns: undefined,
        prisonImmunityNew: undefined,
      };
    }
    if (move.capturesEnemyIds.includes(t.id)) {
      return {
        ...t,
        location: { kind: 'CAPTURED', captorId: actingPlayerId } as TokenLocation,
        prisonImmunityTurns: undefined,
        prisonImmunityNew: undefined,
      };
    }
    return t;
  });

  const nextPlayers = state.players.map((p) => {
    if (p.id === actingPlayerId) {
      return {
        ...p,
        capturesCount: p.capturesCount + move.capturesEnemyIds.length,
        ransomsCount: p.ransomsCount + (move.kind === 'RANSOM' ? 1 : 0),
      };
    }
    return p;
  });

  const actingLabel = formatPlayerLabel(actingPlayer);
  const newLogs = [...state.logs];

  if (move.kind === 'TRIPLE_DOUBLE_FINISH' && move.destination.kind === 'FINISH') {
    newLogs.unshift(
      makeLog(
        state.turnNumber,
        `Супер-бонус за 3 дубля: ${actingLabel} перенёс фишку прямо на «${FINISH_LETTERS[move.destination.index]}»!`,
        'finish',
        actingPlayer.color
      )
    );
  } else if (move.kind === 'CHARGE') {
    newLogs.unshift(makeLog(state.turnNumber, `${actingLabel} зарядил фишку на СТАРТ.`, 'info', actingPlayer.color));
  } else if (move.kind === 'EXIT_PRISON') {
    newLogs.unshift(
      makeLog(
        state.turnNumber,
        `${actingLabel} вышел из тюрьмы на клетку 2 (иммунитет от тюрьмы на 3 хода).`,
        'info',
        actingPlayer.color
      )
    );
  } else if (move.kind === 'SHORTCUT_STRAIGHT') {
    newLogs.unshift(makeLog(state.turnNumber, `${actingLabel} срезал по прямой на клетку 7!`, 'info', actingPlayer.color));
  } else if (move.kind === 'SHORTCUT_DIAGONAL') {
    newLogs.unshift(makeLog(state.turnNumber, `${actingLabel} срезал по диагонали через центр на клетку 7!`, 'info', actingPlayer.color));
  } else if (move.kind === 'ENTER_FINISH' && move.destination.kind === 'FINISH') {
    newLogs.unshift(
      makeLog(
        state.turnNumber,
        `${actingLabel} продвинул фишку на букву «${FINISH_LETTERS[move.destination.index]}»!`,
        'finish',
        actingPlayer.color
      )
    );
  } else if (move.autoHouse) {
    newLogs.unshift(makeLog(state.turnNumber, `${actingLabel} укрылся в Домике (клетка 12).`, 'house', actingPlayer.color));
  } else if (move.autoPrison) {
    newLogs.unshift(makeLog(state.turnNumber, `${actingLabel} угодил в Тюрьму (клетка 2)!`, 'prison', actingPlayer.color));
  } else if (move.kind === 'RANSOM' && ransomedFromCaptorId !== null) {
    const captor = nextPlayers.find((p) => p.id === ransomedFromCaptorId)!;
    const captorLabel = formatPlayerLabel(captor);
    newLogs.unshift(
      makeLog(
        state.turnNumber,
        `${actingLabel} выкупил фишку у игрока ${captorLabel}! ${captorLabel} должен пройти ровно 6 шагов по полю.`,
        'ransom',
        actingPlayer.color
      )
    );
  } else {
    newLogs.unshift(
      makeLog(
        state.turnNumber,
        `${actingLabel}: ${move.label}.`,
        'info',
        actingPlayer.color
      )
    );
  }

  if (move.capturesEnemyIds.length > 0) {
    const capturedOwners = new Set<string>();
    for (const cid of move.capturesEnemyIds) {
      const capToken = state.tokens.find((t) => t.id === cid);
      if (capToken) {
        const owner = state.players.find((p) => p.id === capToken.ownerId);
        if (owner) capturedOwners.add(formatPlayerLabel(owner));
      }
    }
    const countWord = move.capturesEnemyIds.length > 1 ? `${move.capturesEnemyIds.length} фишки` : 'фишку';
    newLogs.unshift(
      makeLog(
        state.turnNumber,
        `${actingLabel} съел ${countWord} (${Array.from(capturedOwners).join(', ')}) в плен!`,
        'capture',
        actingPlayer.color
      )
    );
  }

  if (checkWinner(nextTokens, actingPlayerId)) {
    newLogs.unshift(
      makeLog(
        state.turnNumber,
        `${actingLabel} собрал слово «ФИНИШ» всеми 5 фишками и победил!`,
        'win',
        actingPlayer.color
      )
    );
    return {
      ...state,
      players: nextPlayers,
      tokens: nextTokens,
      phase: 'GAME_OVER',
      winnerId: actingPlayerId,
      compensation: null,
      logs: newLogs.slice(0, 60),
    };
  }

  if (move.kind === 'TRIPLE_DOUBLE_FINISH') {
    const completedState: GameState = {
      ...state,
      players: nextPlayers,
      tokens: nextTokens,
      phase: 'MOVE',
      diceUsed: [true, true],
      selectedDieIndex: null,
      doublesStreak: 0,
      logs: newLogs.slice(0, 60),
    };
    return options?.deferTurnAdvance ? completedState : advanceToNextTurn(completedState);
  }

  const effectiveDieIndex = usedDieIndex ?? move.dieIndex;
  const nextDiceUsed: [boolean, boolean] = [...state.diceUsed] as [boolean, boolean];
  if (!isCompensation) {
    if (move.usesBothDice) {
      nextDiceUsed[0] = true;
      nextDiceUsed[1] = true;
    } else if (effectiveDieIndex !== undefined) {
      nextDiceUsed[effectiveDieIndex] = true;
    }
  }

  let nextState: GameState = {
    ...state,
    players: nextPlayers,
    tokens: nextTokens,
    diceUsed: nextDiceUsed,
    endOfTurnResolved: false,
    logs: newLogs.slice(0, 60),
  };

  if (isCompensation) {
    // Strict 6-step compensation completes in a single continuous 6-cell move
    nextState = {
      ...nextState,
      compensation: null,
    };
    return finalizeOriginalPlayerTurnAfterMove(nextState, options?.deferTurnAdvance);
  }

  if (move.kind === 'RANSOM' && ransomedFromCaptorId !== null) {
    const compState: GameState = {
      ...nextState,
      compensation: {
        benefactorId: ransomedFromCaptorId,
        returnToPlayerId: actingPlayerId,
        stepsRemaining: 6,
      },
    };
    const fullSixMoves = getAvailableMovesForSteps(compState, ransomedFromCaptorId, 6, true);
    if (fullSixMoves.length > 0) {
      return compState;
    }
    const benefactor = nextPlayers.find((p) => p.id === ransomedFromCaptorId)!;
    const burnLog = makeLog(
      state.turnNumber,
      `У игрока ${formatPlayerLabel(benefactor)} нет фишки с полным ходом ровно на 6 клеток — 6 бонусных шагов сгорели.`,
      'burn',
      benefactor.color
    );
    nextState = {
      ...nextState,
      compensation: null,
      logs: [burnLog, ...nextState.logs].slice(0, 60),
    };
  }

  return finalizeOriginalPlayerTurnAfterMove(nextState, options?.deferTurnAdvance);
}

function finalizeOriginalPlayerTurnAfterMove(
  state: GameState,
  deferTurnAdvance = false
): GameState {
  if (state.diceUsed[0] && state.diceUsed[1]) {
    if (state.doublesStreak >= 3) {
      return tryActivateTripleDoubleOrAdvance(state, undefined, deferTurnAdvance);
    }
    if (state.doublesStreak > 0 && state.doublesStreak < 3) {
      const currentPlayer = state.players[state.currentPlayerIndex];
      return {
        ...state,
        phase: 'ROLL',
        dice: null,
        diceUsed: [false, false],
        selectedDieIndex: null,
        logs: [
          makeLog(
            state.turnNumber,
            `${formatPlayerLabel(currentPlayer)} использовал оба кубика дубля и получает дополнительный бросок!`,
            'info',
            currentPlayer.color
          ),
          ...state.logs,
        ].slice(0, 60),
      };
    }
    if (deferTurnAdvance) {
      return {
        ...state,
        selectedDieIndex: null,
      };
    }
    return advanceToNextTurn(state);
  }
  return {
    ...state,
    selectedDieIndex: getBestDefaultDieIndex(state),
  };
}
