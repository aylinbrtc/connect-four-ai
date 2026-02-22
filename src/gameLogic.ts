import { Player, ROWS, COLS, BoardState, GameResult } from './types';

/**
 * Initializes a null-state game board.
 * Returns a 2D array (Matrix) of size ROWS x COLS filled with Player.NONE.
 */
export const createEmptyBoard = (): BoardState => {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(Player.NONE));
};

/**
 * Validates if a move is permissible in a given column.
 * Checks the top-most row (index 0) to see if it's occupied.
 */
export const isValidMove = (board: BoardState, col: number): boolean => {
  return board[0][col] === Player.NONE;
};

/**
 * Finds the lowest available row index in a specific column.
 * Implements a bottom-to-top linear search.
 * @returns Row index or -1 if the column is full.
 */
export const getNextOpenRow = (board: BoardState, col: number): number => {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === Player.NONE) {
      return r;
    }
  }
  return -1;
};

/**
 * Executes a piece drop by creating a deep copy of the board.
 * Ensures immutability of the previous state for the Minimax recursion.
 */
export const dropPiece = (board: BoardState, row: number, col: number, player: Player): BoardState => {
  const newBoard = board.map(row => [...row]);
  newBoard[row][col] = player;
  return newBoard;
};

/**
 * Comprehensive Win-Condition Checker.
 * Performs a spatial analysis across four axes: Horizontal, Vertical, and two Diagonals.
 */
export const checkWin = (board: BoardState, player: Player): GameResult => {
  // --- Axis 1: Horizontal Check (---) ---
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (
        board[r][c] === player &&
        board[r][c + 1] === player &&
        board[r][c + 2] === player &&
        board[r][c + 3] === player
      ) {
        return { winner: player, winningCells: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]] };
      }
    }
  }

  // --- Axis 2: Vertical Check (|) ---
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS; c++) {
      if (
        board[r][c] === player &&
        board[r + 1][c] === player &&
        board[r + 2][c] === player &&
        board[r + 3][c] === player
      ) {
        return { winner: player, winningCells: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]] };
      }
    }
  }

  // --- Axis 3: Positive Diagonal Check (/) ---
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (
        board[r][c] === player &&
        board[r + 1][c + 1] === player &&
        board[r + 2][c + 2] === player &&
        board[r + 3][c + 3] === player
      ) {
        return { winner: player, winningCells: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]] };
      }
    }
  }

  // --- Axis 4: Negative Diagonal Check (\) ---
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (
        board[r][c] === player &&
        board[r - 1][c + 1] === player &&
        board[r - 2][c + 2] === player &&
        board[r - 3][c + 3] === player
      ) {
        return { winner: player, winningCells: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]] };
      }
    }
  }

  // --- Terminal State: Draw Check ---
  // If no winner is found and the board is saturated, it's a draw.
  const isDraw = board.every(row => row.every(cell => cell !== Player.NONE));
  if (isDraw) {
    return { winner: 'DRAW', winningCells: null };
  }

  return { winner: null, winningCells: null };
};