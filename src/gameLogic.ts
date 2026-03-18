import { Player, ROWS, COLS, BoardState, GameResult } from './types';

// Start every game with a completely empty 6x7 grid.
export const createEmptyBoard = (): BoardState => {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(Player.NONE));
};

// A column is full when row 0 is already occupied — pieces stack from the
// bottom, so the top cell is the last one available.
export const isValidMove = (board: BoardState, col: number): boolean => {
  return board[0][col] === Player.NONE;
};

// Scan from the bottom up to find the first empty row in a column.
// Returns -1 if the column is somehow full (shouldn't happen if you
// call isValidMove first, but good to be safe).
export const getNextOpenRow = (board: BoardState, col: number): number => {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === Player.NONE) {
      return r;
    }
  }
  return -1;
};

// Place a piece and return the new board. We make a fresh copy each time
// instead of mutating in place — minimax depends on this to explore
// different branches without them interfering with each other.
export const dropPiece = (board: BoardState, row: number, col: number, player: Player): BoardState => {
  const newBoard = board.map(row => [...row]);
  newBoard[row][col] = player;
  return newBoard;
};

// Check all four directions a winning sequence can run: horizontal,
// vertical, diagonal going down-right, and diagonal going up-right.
// Returns the winner and the four winning cell coordinates, or null
// if the game is still ongoing. Falls through to a draw check at the end.
export const checkWin = (board: BoardState, player: Player): GameResult => {
  // Horizontal ---
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

  // Vertical |
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

  // Diagonal /
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

  // Diagonal \
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

  // No winner yet — if every cell is filled it's a draw, otherwise the game continues.
  const isDraw = board.every(row => row.every(cell => cell !== Player.NONE));
  if (isDraw) {
    return { winner: 'DRAW', winningCells: null };
  }

  return { winner: null, winningCells: null };
};
