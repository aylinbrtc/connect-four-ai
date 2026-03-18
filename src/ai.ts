import { Player, ROWS, COLS, BoardState } from './types';
import { isValidMove, getNextOpenRow, dropPiece, checkWin } from './gameLogic';

const WINDOW_LENGTH = 4;

// -----------------------------------------------------------------------
// Zobrist Hashing
// -----------------------------------------------------------------------
// The idea: assign a random 32-bit number to every possible (row, col, player)
// combination at startup. A board's hash is just the XOR of all those numbers
// for every occupied cell. When a piece is placed, you XOR in exactly one new
// value — O(1) instead of rehashing the whole board every time.
// This is what makes the transposition table fast enough to be worth using.
const zobristTable: number[][][] = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () =>
    Array.from({ length: 3 }, () => (Math.random() * 0xFFFFFFFF) | 0)
  )
);

// Compute the hash for an existing board state from scratch.
// Only needed once at the start of a search; after that we update incrementally.
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
// Standard alpha-beta stores one of three result types per node:
//   EXACT      — we searched the full window and this is the real score.
//   LOWERBOUND — a beta cutoff happened, so the true score is >= this value.
//   UPPERBOUND — we never beat alpha, so the true score is <= this value.
// On a lookup, LOWERBOUND raises alpha, UPPERBOUND lowers beta; if they
// cross we can cut off without searching at all.
type TTFlag = 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND';

interface TTEntry {
  score: number;
  depth: number;
  flag: TTFlag;
  move: number | null; // best move found at this node, useful for move ordering later
}

// -----------------------------------------------------------------------
// Heuristic scoring
// -----------------------------------------------------------------------

// Score a single window of 4 cells from the AI's perspective.
// The weights are pretty standard for Connect Four: a 3-in-a-row threat
// is worth 5, a 2-in-a-row setup is worth 2, and a nearly-complete
// opponent threat costs 4 (slightly less than our own 3-threat so the AI
// prefers to build rather than just block when it can do both).
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

// Add up scores for every possible 4-cell window on the board.
// The center column gets a flat +3 per piece because Connect Four
// theory (James Allis, 1988) shows center control dominates long-term strategy
// — more windows pass through the middle than any other column.
const scorePosition = (board: BoardState, player: Player): number => {
  let score = 0;

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

  // Diagonal windows (both directions handled in the same loop)
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      score += evaluateWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], player);
      score += evaluateWindow([board[r+3][c], board[r+2][c+1], board[r+1][c+2], board[r][c+3]], player);
    }
  }

  return score;
};

// The search bottoms out when someone has won, it's a draw, or we've hit
// the depth limit. Checking both players here covers the case where the
// last move was made by either side.
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
// Alpha-beta cuts branches we know won't affect the result:
//   alpha = best score the maximizer (AI) has found so far
//   beta  = best score the minimizer (Human) has found so far
// If at any point alpha >= beta, the opponent already has a better option
// elsewhere in the tree, so we skip the rest of this branch.
//
// The transposition table stores results we've already computed so we don't
// redo the work if the same board state appears via a different move order.
// Hash updates are O(1) thanks to Zobrist — just XOR in the new piece.
const minimaxWithTT = (
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean,
  hash: number,
  tt: Map<number, TTEntry>
): [number | null, number] => {
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

  const validLocations = Array.from({ length: COLS }, (_, i) => i).filter(c => isValidMove(board, c));
  const isTerminal = isTerminalNode(board);

  // Base case: game over or depth limit reached — return a static evaluation
  if (depth === 0 || isTerminal) {
    if (isTerminal) {
      if (checkWin(board, Player.AI).winner === Player.AI) return [null, 100000000000000];
      if (checkWin(board, Player.HUMAN).winner === Player.HUMAN) return [null, -10000000000000];
      return [null, 0]; // draw
    }
    return [null, scorePosition(board, Player.AI)];
  }

  // Start with a random column as fallback in case all moves score equally
  let value: number;
  let column = validLocations[Math.floor(Math.random() * validLocations.length)];

  if (isMaximizingPlayer) {
    value = -Infinity;
    for (const col of validLocations) {
      const row = getNextOpenRow(board, col);
      const bCopy = dropPiece(board, row, col, Player.AI);
      // XOR in the new piece for an O(1) hash update
      const newHash = (hash ^ zobristTable[row][col][Player.AI]) >>> 0;
      const newScore = minimaxWithTT(bCopy, depth - 1, alpha, beta, false, newHash, tt)[1];
      if (newScore > value) { value = newScore; column = col; }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break; // beta cutoff — opponent won't allow this
    }
  } else {
    value = Infinity;
    for (const col of validLocations) {
      const row = getNextOpenRow(board, col);
      const bCopy = dropPiece(board, row, col, Player.HUMAN);
      const newHash = (hash ^ zobristTable[row][col][Player.HUMAN]) >>> 0;
      const newScore = minimaxWithTT(bCopy, depth - 1, alpha, beta, true, newHash, tt)[1];
      if (newScore < value) { value = newScore; column = col; }
      beta = Math.min(beta, value);
      if (alpha >= beta) break; // alpha cutoff — AI already has a better option
    }
  }

  // Store the result in the TT with the appropriate bound flag
  const flag: TTFlag =
    value <= alphaOrig ? 'UPPERBOUND' :
    value >= betaOrig  ? 'LOWERBOUND' :
    'EXACT';
  tt.set(hash, { score: value, depth, flag, move: column });

  return [column, value];
};

// -----------------------------------------------------------------------
// Public search stats type
// -----------------------------------------------------------------------
export interface SearchStats {
  depthReached: number; // how deep the last completed iteration got
  ttSize: number;       // how many positions were cached
}

// -----------------------------------------------------------------------
// Main entry point: Iterative Deepening Search
// -----------------------------------------------------------------------
// Instead of jumping straight to the target depth, we run depth 1, then 2,
// then 3, and so on. Each iteration populates the TT, so by the time we
// reach depth N the cache is already warm and pruning is much more effective.
// If we're running close to the time limit, we return whatever the last
// fully completed iteration found rather than an incomplete result.
//
// At low difficulty levels the AI also makes deliberate mistakes — this is
// what makes the easier settings actually beatable.
export const getBestMove = (board: BoardState, maxDepth: number): { col: number | null } & SearchStats => {
  const tt = new Map<number, TTEntry>();
  const initialHash = computeHash(board);
  let bestCol: number | null = null;
  let depthReached = 0;
  const startTime = Date.now();
  const TIME_LIMIT_MS = 3000; // hard cap so the UI never locks up

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() - startTime >= TIME_LIMIT_MS) break;
    const [col] = minimaxWithTT(board, depth, -Infinity, Infinity, true, initialHash, tt);
    if (col !== null) bestCol = col;
    depthReached = depth;
  }

  // Difficulty-based errors: at depth 2 the AI plays randomly ~45% of the time,
  // at depth 3 ~20%. Depth 4 and above always play optimally.
  if (maxDepth <= 3) {
    const errorRate = maxDepth === 2 ? 0.45 : 0.2;
    if (Math.random() < errorRate) {
      const validCols = Array.from({ length: COLS }, (_, i) => i).filter(c => isValidMove(board, c));
      bestCol = validCols[Math.floor(Math.random() * validCols.length)];
    }
  }

  return { col: bestCol, depthReached, ttSize: tt.size };
};
