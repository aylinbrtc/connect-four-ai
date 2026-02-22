import { Player, ROWS, COLS, BoardState } from './types';
import { isValidMove, getNextOpenRow, dropPiece, checkWin } from './gameLogic';

/**
 * Global constant for the win condition length.
 */
const WINDOW_LENGTH = 4;

/**
 * Heuristic evaluation function for a specific window of 4 cells.
 * Assigns strategic weights to different board patterns.
 */
const evaluateWindow = (window: Player[], player: Player): number => {
  let score = 0;
  const opponent = player === Player.HUMAN ? Player.AI : Player.HUMAN;

  const playerCount = window.filter(p => p === player).length;
  const emptyCount = window.filter(p => p === Player.NONE).length;
  const opponentCount = window.filter(p => p === opponent).length;

  // Utility scoring logic
  if (playerCount === 4) {
    score += 100; // Winning move
  } else if (playerCount === 3 && emptyCount === 1) {
    score += 5;   // Potential win threat
  } else if (playerCount === 2 && emptyCount === 2) {
    score += 2;   // Strategic setup
  }

  if (opponentCount === 3 && emptyCount === 1) {
    score -= 4;   // Defensive block priority
  }

  return score;
};

/**
 * Positional scoring function to evaluate the entire board state.
 * Implements a heuristic search based on center control and directional patterns.
 */
const scorePosition = (board: BoardState, player: Player): number => {
  let score = 0;

  // Strategic Priority: Control the center column (Connect Four heuristic)
  const centerArray = board.map(row => row[Math.floor(COLS / 2)]);
  const centerCount = centerArray.filter(p => p === player).length;
  score += centerCount * 3;

  // Iterative Search: Horizontal
  for (let r = 0; r < ROWS; r++) {
    const rowArray = board[r];
    for (let c = 0; c < COLS - 3; c++) {
      const window = rowArray.slice(c, c + WINDOW_LENGTH);
      score += evaluateWindow(window, player);
    }
  }

  // Iterative Search: Vertical
  for (let c = 0; c < COLS; c++) {
    const colArray = board.map(row => row[c]);
    for (let r = 0; r < ROWS - 3; r++) {
      const window = colArray.slice(r, r + WINDOW_LENGTH);
      score += evaluateWindow(window, player);
    }
  }

  // Iterative Search: Positive Diagonal (slope +1)
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const window = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
      score += evaluateWindow(window, player);
    }
  }

  // Iterative Search: Negative Diagonal (slope -1)
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const window = [board[r + 3][c], board[r + 2][c + 1], board[r + 1][c + 2], board[r][c + 3]];
      score += evaluateWindow(window, player);
    }
  }

  return score;
};

/**
 * Checks if the current board state is a terminal node (Win/Draw/Full).
 */
const isTerminalNode = (board: BoardState): boolean => {
  return (
    checkWin(board, Player.HUMAN).winner !== null ||
    checkWin(board, Player.AI).winner !== null ||
    board.every(row => row.every(cell => cell !== Player.NONE))
  );
};

/**
 * Minimax Algorithm with Alpha-Beta Pruning.
 * Optimizes the state-space search by eliminating branches that cannot influence the final decision.
 * * @param board - Current state of the game
 * @param depth - Search depth limit for the recursive tree
 * @param alpha - Best score already found for the maximizing player
 * @param beta - Best score already found for the minimizing player
 * @param isMaximizingPlayer - Boolean flag for current turn type
 */
export const minimax = (
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean
): [number | null, number] => {
  const validLocations = Array.from({ length: COLS }, (_, i) => i).filter(c => isValidMove(board, c));
  const isTerminal = isTerminalNode(board);

  // Base Case: Terminal node or depth limit reached
  if (depth === 0 || isTerminal) {
    if (isTerminal) {
      if (checkWin(board, Player.AI).winner === Player.AI) {
        return [null, 100000000000000]; // Positive Infinity
      } else if (checkWin(board, Player.HUMAN).winner === Player.HUMAN) {
        return [null, -10000000000000]; // Negative Infinity
      } else {
        return [null, 0]; // Draw
      }
    } else {
      return [null, scorePosition(board, Player.AI)];
    }
  }

  if (isMaximizingPlayer) {
    let value = -Infinity;
    let column = validLocations[Math.floor(Math.random() * validLocations.length)];
    for (const col of validLocations) {
      const row = getNextOpenRow(board, col);
      const bCopy = dropPiece(board, row, col, Player.AI);
      const newScore = minimax(bCopy, depth - 1, alpha, beta, false)[1];
      if (newScore > value) {
        value = newScore;
        column = col;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) {
        break; // Alpha-Beta Pruning
      }
    }
    return [column, value];
  } else {
    let value = Infinity;
    let column = validLocations[Math.floor(Math.random() * validLocations.length)];
    for (const col of validLocations) {
      const row = getNextOpenRow(board, col);
      const bCopy = dropPiece(board, row, col, Player.HUMAN);
      const newScore = minimax(bCopy, depth - 1, alpha, beta, true)[1];
      if (newScore < value) {
        value = newScore;
        column = col;
      }
      beta = Math.min(beta, value);
      if (alpha >= beta) {
        break; // Alpha-Beta Pruning
      }
    }
    return [column, value];
  }
};