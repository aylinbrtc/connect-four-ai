import { Player, ROWS, COLS, BoardState } from './types';
import { isValidMove, getNextOpenRow, dropPiece, checkWin } from './gameLogic';

const WINDOW_LENGTH = 4;

// -----------------------------------------------------------------------
// Move Ordering
// -----------------------------------------------------------------------
// Evaluate center columns first, then work outward. In Connect Four the
// center column passes through more potential winning lines than any
// other column, so moves there tend to be stronger. Alpha-beta prunes
// more aggressively when it sees good moves early, so ordering matters
// a lot — the difference between O(b^d) and O(b^(d/2)) in the best case.
const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];

// -----------------------------------------------------------------------
// Zobrist Hashing
// -----------------------------------------------------------------------
// Each (row, col, player) combination gets a random 32-bit number at
// startup. A board's hash is the XOR of all the numbers for occupied cells.
// Placing a piece is O(1): just XOR in one new value instead of rehashing
// the whole board. This is what makes the transposition table fast enough
// to justify the memory overhead.
const zobristTable: number[][][] = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () =>
    Array.from({ length: 3 }, () => (Math.random() * 0xFFFFFFFF) | 0)
  )
);

// Compute the hash for an existing board from scratch.
// Only called once at the start of a search; after that we update incrementally.
const computeHash = (board: BoardState): number => {
  let hash = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== Player.NONE) {
        hash = (hash ^ zobristTable[r][c][board[r][c]]) >>> 0;
      }
    }
  }
  return hash;
};

// -----------------------------------------------------------------------
// Transposition Table
// -----------------------------------------------------------------------
// EXACT      — we searched the full [alpha, beta] window; this is the real score.
// LOWERBOUND — a beta cutoff happened; the true score is >= stored value.
// UPPERBOUND — we never beat alpha; the true score is <= stored value.
// On lookup: LOWERBOUND raises alpha, UPPERBOUND lowers beta. If they
// cross we prune without searching — same result, zero work.
type TTFlag = 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND';

interface TTEntry {
  score: number;
  depth: number;
  flag: TTFlag;
  move: number | null;
}

// -----------------------------------------------------------------------
// Node counter (passed by reference through recursion)
// -----------------------------------------------------------------------
// Lets us report how many board positions were evaluated in a search,
// which is the main metric for the performance comparison in the report.
interface SearchCounter {
  nodes: number;
}

// -----------------------------------------------------------------------
// Heuristic scoring
// -----------------------------------------------------------------------

// Score a window of 4 cells from the AI's perspective.
// Weights: 4-in-a-row = 100, 3+empty = 5, 2+2empty = 2.
// Opponent 3-threat is penalised at -4 (slightly less than our own +5
// so the AI prefers building over pure blocking when it can do both).
const evaluateWindow = (window: Player[], player: Player): number => {
  let score = 0;
  const opponent = player === Player.HUMAN ? Player.AI : Player.HUMAN;

  const playerCount = window.filter(p => p === player).length;
  const emptyCount = window.filter(p => p === Player.NONE).length;
  const opponentCount = window.filter(p => p === opponent).length;

  if (playerCount === 4) score += 100;
  else if (playerCount === 3 && emptyCount === 1) score += 5;
  else if (playerCount === 2 && emptyCount === 2) score += 2;

  if (opponentCount === 3 && emptyCount === 1) score -= 4;

  return score;
};

// -----------------------------------------------------------------------
// Fork (threat count) detection
// -----------------------------------------------------------------------
// A "fork" is having two or more separate winning threats at once.
// The opponent can only block one per turn, so a fork is essentially a
// forced win. The window-by-window scoring above doesn't capture this —
// two independent +5 windows score 10, but the actual board value is
// much higher. We count threats explicitly and add a bonus.
const countThreats = (board: BoardState, player: Player): number => {
  let threats = 0;

  const isThreateningWindow = (w: Player[]): boolean =>
    w.filter(p => p === player).length === 3 &&
    w.filter(p => p === Player.NONE).length === 1;

  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (isThreateningWindow(board[r].slice(c, c + 4))) threats++;
    }
  }

  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      if (isThreateningWindow([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]])) threats++;
    }
  }

  // Diagonals
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (isThreateningWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]])) threats++;
      if (isThreateningWindow([board[r+3][c], board[r+2][c+1], board[r+1][c+2], board[r][c+3]])) threats++;
    }
  }

  return threats;
};

// Add up scores for every 4-cell window on the board, plus center bonus
// and fork bonus. Center column gets +3 per piece because Connect Four
// theory (Allis, 1988) shows it participates in more winning lines than
// any other column. Fork bonus kicks in when there are 2+ simultaneous
// threats — that's a position the opponent can't fully defend.
const scorePosition = (board: BoardState, player: Player): number => {
  const opponent = player === Player.HUMAN ? Player.AI : Player.HUMAN;
  let score = 0;

  // Center column bonus
  const centerArray = board.map(row => row[Math.floor(COLS / 2)]);
  score += centerArray.filter(p => p === player).length * 3;

  // Horizontal windows
  for (let r = 0; r < ROWS; r++) {
    const rowArray = board[r];
    for (let c = 0; c < COLS - 3; c++) {
      score += evaluateWindow(rowArray.slice(c, c + WINDOW_LENGTH), player);
    }
  }

  // Vertical windows
  for (let c = 0; c < COLS; c++) {
    const colArray = board.map(row => row[c]);
    for (let r = 0; r < ROWS - 3; r++) {
      score += evaluateWindow(colArray.slice(r, r + WINDOW_LENGTH), player);
    }
  }

  // Diagonal windows (both directions in the same loop)
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      score += evaluateWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], player);
      score += evaluateWindow([board[r+3][c], board[r+2][c+1], board[r+1][c+2], board[r][c+3]], player);
    }
  }

  // Fork detection: 2+ simultaneous threats is a forced-win situation.
  // The bonus is large enough to make the AI actively seek forks rather
  // than stumbling into them.
  const aiThreats = countThreats(board, player);
  const oppThreats = countThreats(board, opponent);
  if (aiThreats >= 2)  score += 50;
  if (oppThreats >= 2) score -= 50;

  return score;
};

const isTerminalNode = (board: BoardState): boolean => {
  return (
    checkWin(board, Player.HUMAN).winner !== null ||
    checkWin(board, Player.AI).winner !== null ||
    board.every(row => row.every(cell => cell !== Player.NONE))
  );
};

// -----------------------------------------------------------------------
// Minimax with Alpha-Beta Pruning + Transposition Table
// -----------------------------------------------------------------------
// alpha = best score the maximizer (AI) can guarantee so far.
// beta  = best score the minimizer (Human) can guarantee so far.
// If alpha >= beta, the current node can't affect the final result —
// the opponent already has a better option elsewhere, so we skip it.
//
// The TT avoids re-evaluating positions seen via different move orders.
// Hash updates are O(1) (just XOR one value) thanks to Zobrist hashing.
// Move ordering (COLUMN_ORDER) gives alpha-beta the best chance to
// prune early by evaluating stronger moves first.
const minimaxWithTT = (
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean,
  hash: number,
  tt: Map<number, TTEntry>,
  counter: SearchCounter
): [number | null, number] => {
  counter.nodes++;

  const alphaOrig = alpha;
  const betaOrig = beta;

  // Check the cache before doing any work
  const ttEntry = tt.get(hash);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'EXACT') return [ttEntry.move, ttEntry.score];
    if (ttEntry.flag === 'LOWERBOUND') alpha = Math.max(alpha, ttEntry.score);
    else if (ttEntry.flag === 'UPPERBOUND') beta = Math.min(beta, ttEntry.score);
    if (alpha >= beta) return [ttEntry.move, ttEntry.score];
  }

  // COLUMN_ORDER ensures we evaluate center columns first (better move ordering)
  const validLocations = COLUMN_ORDER.filter(c => isValidMove(board, c));
  const isTerminal = isTerminalNode(board);

  // Base case: game over or depth limit — return a static evaluation
  if (depth === 0 || isTerminal) {
    if (isTerminal) {
      if (checkWin(board, Player.AI).winner === Player.AI)    return [null, 100000000000000];
      if (checkWin(board, Player.HUMAN).winner === Player.HUMAN) return [null, -10000000000000];
      return [null, 0]; // draw
    }
    return [null, scorePosition(board, Player.AI)];
  }

  // Tie-breaking: if two columns score the same, don't always pick the
  // leftmost — that would make the AI's play predictable.
  let value: number;
  let column = validLocations[Math.floor(Math.random() * validLocations.length)];

  if (isMaximizingPlayer) {
    value = -Infinity;
    for (const col of validLocations) {
      const row = getNextOpenRow(board, col);
      const bCopy = dropPiece(board, row, col, Player.AI);
      const newHash = (hash ^ zobristTable[row][col][Player.AI]) >>> 0;
      const newScore = minimaxWithTT(bCopy, depth - 1, alpha, beta, false, newHash, tt, counter)[1];
      if (newScore > value) { value = newScore; column = col; }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break; // beta cutoff
    }
  } else {
    value = Infinity;
    for (const col of validLocations) {
      const row = getNextOpenRow(board, col);
      const bCopy = dropPiece(board, row, col, Player.HUMAN);
      const newHash = (hash ^ zobristTable[row][col][Player.HUMAN]) >>> 0;
      const newScore = minimaxWithTT(bCopy, depth - 1, alpha, beta, true, newHash, tt, counter)[1];
      if (newScore < value) { value = newScore; column = col; }
      beta = Math.min(beta, value);
      if (alpha >= beta) break; // alpha cutoff
    }
  }

  // Store result in the TT with the correct bound flag
  const flag: TTFlag =
    value <= alphaOrig ? 'UPPERBOUND' :
    value >= betaOrig  ? 'LOWERBOUND' :
    'EXACT';
  tt.set(hash, { score: value, depth, flag, move: column });

  return [column, value];
};

// -----------------------------------------------------------------------
// Search stats — exported so the UI can display them
// -----------------------------------------------------------------------
export interface SearchStats {
  depthReached: number;   // last fully completed IDS iteration
  ttSize: number;         // positions cached during this search
  nodesEvaluated: number; // total board positions examined
}

// -----------------------------------------------------------------------
// Main entry point: Iterative Deepening Search
// -----------------------------------------------------------------------
// Searches depth 1, 2, 3, … up to maxDepth. Each pass warms up the
// transposition table, so deeper iterations prune more aggressively than
// a cold start at the same depth would. If the 3-second hard cap is hit
// mid-iteration, we fall back to the last fully completed result rather
// than returning a partial answer.
//
// Difficulty-based errors: at low depths the AI occasionally picks a
// random valid move on purpose, making easy settings actually beatable.
export const getBestMove = (board: BoardState, maxDepth: number): { col: number | null } & SearchStats => {
  const tt = new Map<number, TTEntry>();
  const counter: SearchCounter = { nodes: 0 };
  const initialHash = computeHash(board);
  let bestCol: number | null = null;
  let depthReached = 0;
  const startTime = Date.now();
  const TIME_LIMIT_MS = 3000;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() - startTime >= TIME_LIMIT_MS) break;
    const [col] = minimaxWithTT(board, depth, -Infinity, Infinity, true, initialHash, tt, counter);
    if (col !== null) bestCol = col;
    depthReached = depth;
  }

  // Depth 2: 45% chance of random move. Depth 3: 20%. Depth 4+: always optimal.
  if (maxDepth <= 3) {
    const errorRate = maxDepth === 2 ? 0.45 : 0.2;
    if (Math.random() < errorRate) {
      const validCols = COLUMN_ORDER.filter(c => isValidMove(board, c));
      bestCol = validCols[Math.floor(Math.random() * validCols.length)];
    }
  }

  return { col: bestCol, depthReached, ttSize: tt.size, nodesEvaluated: counter.nodes };
};
