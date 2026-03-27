// Benchmark suite for the connect-four-ai project.
//
// Runs four search variants on the same mid-game board position so we can
// directly compare nodes evaluated and wall-clock time. The goal is to
// produce the "Experimental Results" table for the final IEEE report.
//
// Variant 1 — Pure Minimax: visits every node in the tree (no pruning, no
//   caching, left-to-right column order). This is the theoretical baseline.
//
// Variant 2 — Alpha-Beta Pruning: skips branches that can't affect the
//   result. Left-to-right order still, no transposition table.
//
// Variant 3 — AB + Move Ordering: same as variant 2 but evaluates center
//   columns first ([3,2,4,1,5,0,6]). Better moves seen earlier → more cutoffs.
//
// Variant 4 — Full Stack: AB + Move Ordering + Transposition Table +
//   Iterative Deepening + Fork Detection. This is the production implementation.
//   Note: because of IDS, the node count at depth N includes all iterations
//   from depth 1 through N, which is why it appears higher than variant 3
//   at shallow depths but dominates at depth 5-6.

import { Player, ROWS, COLS, BoardState } from './types';
import { isValidMove, getNextOpenRow, dropPiece, checkWin } from './gameLogic';
import { getBestMove } from './ai';

// -----------------------------------------------------------------------
// Standard test position
// -----------------------------------------------------------------------
// 12 pieces placed — complex enough for the search to branch meaningfully
// but not so deep that the board is decided already.
// Row 0 = top, Row 5 = bottom. Y = AI (2), R = Human (1).
//
//   . . . . . . .
//   . . . . . . .
//   . . . Y . . .
//   . . R Y R . .
//   . . Y R Y R .
//   . R Y R Y R Y
export const TEST_POSITION: BoardState = [
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 2, 0, 0, 0],
  [0, 0, 1, 2, 1, 0, 0],
  [0, 0, 2, 1, 2, 1, 0],
  [0, 1, 2, 1, 2, 1, 2],
];

// -----------------------------------------------------------------------
// Shared helpers (kept separate from ai.ts so benchmarked variants are
// self-contained and don't accidentally benefit from each other's logic)
// -----------------------------------------------------------------------

const evaluateWindow = (w: Player[], player: Player): number => {
  const opp = player === Player.HUMAN ? Player.AI : Player.HUMAN;
  const pc = w.filter(p => p === player).length;
  const ec = w.filter(p => p === Player.NONE).length;
  const oc = w.filter(p => p === opp).length;
  let s = 0;
  if (pc === 4) s += 100;
  else if (pc === 3 && ec === 1) s += 5;
  else if (pc === 2 && ec === 2) s += 2;
  if (oc === 3 && ec === 1) s -= 4;
  return s;
};

const scoreBoard = (board: BoardState): number => {
  let score = board.map(r => r[3]).filter(p => p === Player.AI).length * 3;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS - 3; c++)
      score += evaluateWindow(board[r].slice(c, c + 4), Player.AI);
  for (let c = 0; c < COLS; c++) {
    const col = board.map(r => r[c]);
    for (let r = 0; r < ROWS - 3; r++)
      score += evaluateWindow(col.slice(r, r + 4), Player.AI);
  }
  for (let r = 0; r < ROWS - 3; r++)
    for (let c = 0; c < COLS - 3; c++) {
      score += evaluateWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], Player.AI);
      score += evaluateWindow([board[r+3][c], board[r+2][c+1], board[r+1][c+2], board[r][c+3]], Player.AI);
    }
  return score;
};

const isTerminal = (board: BoardState): boolean =>
  checkWin(board, Player.HUMAN).winner !== null ||
  checkWin(board, Player.AI).winner !== null ||
  board.every(r => r.every(c => c !== Player.NONE));

const WIN  =  100000000000000;
const LOSS = -100000000000000;

const terminalScore = (board: BoardState): number => {
  if (checkWin(board, Player.AI).winner === Player.AI)    return WIN;
  if (checkWin(board, Player.HUMAN).winner === Player.HUMAN) return LOSS;
  return 0;
};

// -----------------------------------------------------------------------
// Variant 1 — Pure Minimax (no pruning, left-to-right order)
// -----------------------------------------------------------------------
// This is O(b^d) where b ≈ 7 (valid columns) and d is the depth limit.
// Node count grows exponentially — this is what the other variants improve on.
const pureMinimax = (
  board: BoardState, depth: number, isMax: boolean,
  counter: { nodes: number }
): number => {
  counter.nodes++;
  if (depth === 0 || isTerminal(board))
    return isTerminal(board) ? terminalScore(board) : scoreBoard(board);
  const cols = [0, 1, 2, 3, 4, 5, 6].filter(c => isValidMove(board, c));
  if (isMax) {
    let v = -Infinity;
    for (const col of cols) {
      const row = getNextOpenRow(board, col);
      v = Math.max(v, pureMinimax(dropPiece(board, row, col, Player.AI), depth - 1, false, counter));
    }
    return v;
  } else {
    let v = Infinity;
    for (const col of cols) {
      const row = getNextOpenRow(board, col);
      v = Math.min(v, pureMinimax(dropPiece(board, row, col, Player.HUMAN), depth - 1, true, counter));
    }
    return v;
  }
};

// -----------------------------------------------------------------------
// Variant 2 — Alpha-Beta Pruning (no TT, left-to-right order)
// -----------------------------------------------------------------------
// Prunes branches guaranteed not to affect the result. Best case O(b^(d/2)),
// worst case still O(b^d) — order matters a lot for how often we prune.
const minimaxAB = (
  board: BoardState, depth: number, alpha: number, beta: number,
  isMax: boolean, counter: { nodes: number }
): number => {
  counter.nodes++;
  if (depth === 0 || isTerminal(board))
    return isTerminal(board) ? terminalScore(board) : scoreBoard(board);
  const cols = [0, 1, 2, 3, 4, 5, 6].filter(c => isValidMove(board, c));
  if (isMax) {
    let v = -Infinity;
    for (const col of cols) {
      const row = getNextOpenRow(board, col);
      v = Math.max(v, minimaxAB(dropPiece(board, row, col, Player.AI), depth-1, alpha, beta, false, counter));
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    return v;
  } else {
    let v = Infinity;
    for (const col of cols) {
      const row = getNextOpenRow(board, col);
      v = Math.min(v, minimaxAB(dropPiece(board, row, col, Player.HUMAN), depth-1, alpha, beta, true, counter));
      beta = Math.min(beta, v);
      if (alpha >= beta) break;
    }
    return v;
  }
};

// -----------------------------------------------------------------------
// Variant 3 — Alpha-Beta + Move Ordering (no TT)
// -----------------------------------------------------------------------
// Same as variant 2 but evaluates center columns first [3,2,4,1,5,0,6].
// Center columns tend to lead to stronger positions, so alpha-beta sees
// better moves earlier and prunes more branches.
const minimaxABOrder = (
  board: BoardState, depth: number, alpha: number, beta: number,
  isMax: boolean, counter: { nodes: number }
): number => {
  counter.nodes++;
  if (depth === 0 || isTerminal(board))
    return isTerminal(board) ? terminalScore(board) : scoreBoard(board);
  const cols = [3, 2, 4, 1, 5, 0, 6].filter(c => isValidMove(board, c));
  if (isMax) {
    let v = -Infinity;
    for (const col of cols) {
      const row = getNextOpenRow(board, col);
      v = Math.max(v, minimaxABOrder(dropPiece(board, row, col, Player.AI), depth-1, alpha, beta, false, counter));
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    return v;
  } else {
    let v = Infinity;
    for (const col of cols) {
      const row = getNextOpenRow(board, col);
      v = Math.min(v, minimaxABOrder(dropPiece(board, row, col, Player.HUMAN), depth-1, alpha, beta, true, counter));
      beta = Math.min(beta, v);
      if (alpha >= beta) break;
    }
    return v;
  }
};

// -----------------------------------------------------------------------
// Result types
// -----------------------------------------------------------------------
export interface DepthRow {
  depth: number;
  nodes: number;
  timeMs: number;
}

export interface VariantResult {
  config: string;
  note: string;
  rows: DepthRow[];
}

// -----------------------------------------------------------------------
// Main benchmark runner
// -----------------------------------------------------------------------
// Async so the caller can yield between variants and keep the UI responsive.
// Each `await tick()` lets React re-render with progress before the next
// (potentially expensive) synchronous search runs.
const tick = () => new Promise<void>(r => setTimeout(r, 0));

export const runBenchmark = async (
  board: BoardState,
  onProgress: (results: VariantResult[]) => void
): Promise<VariantResult[]> => {
  const results: VariantResult[] = [];

  // Pure Minimax — cap at depth 4 to keep wait time reasonable.
  // At depth 5 this already takes several seconds with no pruning.
  const pureRows: DepthRow[] = [];
  for (let d = 1; d <= 4; d++) {
    await tick();
    const counter = { nodes: 0 };
    const start = performance.now();
    pureMinimax(board, d, true, counter);
    pureRows.push({ depth: d, nodes: counter.nodes, timeMs: Math.round(performance.now() - start) });
  }
  results.push({
    config: 'Pure Minimax',
    note: 'No pruning, no TT, left-to-right order. Capped at depth 4.',
    rows: pureRows,
  });
  onProgress([...results]);

  // Alpha-Beta only
  const abRows: DepthRow[] = [];
  for (let d = 1; d <= 6; d++) {
    await tick();
    const counter = { nodes: 0 };
    const start = performance.now();
    minimaxAB(board, d, -Infinity, Infinity, true, counter);
    abRows.push({ depth: d, nodes: counter.nodes, timeMs: Math.round(performance.now() - start) });
  }
  results.push({
    config: 'Alpha-Beta Pruning',
    note: 'Pruning only. Left-to-right order, no TT.',
    rows: abRows,
  });
  onProgress([...results]);

  // Alpha-Beta + Move Ordering
  const abOrderRows: DepthRow[] = [];
  for (let d = 1; d <= 6; d++) {
    await tick();
    const counter = { nodes: 0 };
    const start = performance.now();
    minimaxABOrder(board, d, -Infinity, Infinity, true, counter);
    abOrderRows.push({ depth: d, nodes: counter.nodes, timeMs: Math.round(performance.now() - start) });
  }
  results.push({
    config: 'AB + Move Ordering',
    note: 'Center-out column order [3,2,4,1,5,0,6]. No TT.',
    rows: abOrderRows,
  });
  onProgress([...results]);

  // Full Stack — uses getBestMove which runs IDS internally.
  // Node count includes all iterations from depth 1..N (IDS overhead),
  // but the TT warmed by shallower passes offsets this at higher depths.
  const fullRows: DepthRow[] = [];
  for (let d = 1; d <= 6; d++) {
    await tick();
    const start = performance.now();
    const { nodesEvaluated } = getBestMove(board, d);
    fullRows.push({ depth: d, nodes: nodesEvaluated, timeMs: Math.round(performance.now() - start) });
  }
  results.push({
    config: 'Full Stack (AB + TT + IDS + Ordering + Fork Det.)',
    note: 'Production implementation. Node count includes all IDS iterations.',
    rows: fullRows,
  });
  onProgress([...results]);

  return results;
};
