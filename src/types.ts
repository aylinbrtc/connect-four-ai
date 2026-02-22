/**
 * Player Enumeration
 * Defines the participants in the zero-sum game environment.
 */
export enum Player {
  NONE = 0,   // Empty cell
  HUMAN = 1,  // Human player (Maximizing/Minimizing based on perspective)
  AI = 2,     // AI Agent (Minimax-driven)
}

/**
 * Type alias for the game board representation.
 * 2D Matrix where each element is a Player state.
 */
export type BoardState = Player[][];

/**
 * Board Dimensions - Connect Four Standard (6 rows x 7 columns)
 */
export const ROWS = 6;
export const COLS = 7;

/**
 * Interface representing the final state of a game iteration.
 */
export interface GameResult {
  winner: Player | 'DRAW' | null;
  winningCells: [number, number][] | null; // Coordinates of the winning sequence
}