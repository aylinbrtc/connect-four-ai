// Who's who on the board. NONE = empty cell, HUMAN = red, AI = yellow.
export enum Player {
  NONE = 0,
  HUMAN = 1,
  AI = 2,
}

// The board is just a 2D array of Player values. Each cell either
// belongs to a player or is empty.
export type BoardState = Player[][];

// Standard Connect Four dimensions — 6 rows, 7 columns.
export const ROWS = 6;
export const COLS = 7;

// Returned after every move check. winningCells holds the four coordinates
// so the UI can highlight them; it's null until someone actually wins.
export interface GameResult {
  winner: Player | 'DRAW' | null;
  winningCells: [number, number][] | null;
}
