import React from 'react';
import { Player, ROWS, COLS, BoardState } from '../types';

/**
 * Interface for Board component props.
 * Defines the necessary data and handlers for rendering the Connect Four grid.
 */
interface BoardProps {
  board: BoardState;
  onColumnClick: (col: number) => void;
  winningCells: [number, number][] | null;
  disabled: boolean;
}

/**
 * Board Component: Renders the physical 6x7 grid for the game.
 * Uses CSS Grid for layout and dynamic styling based on player moves.
 * * Developed for TOBB ETÜ - Computer Engineering Project.
 */
export const Board: React.FC<BoardProps> = ({ board, onColumnClick, winningCells, disabled }) => {
  
  /**
   * Checks if a specific cell coordinate belongs to the winning sequence.
   * @param r - Row index
   * @param c - Column index
   */
  const isWinningCell = (r: number, c: number) => {
    return winningCells?.some(([wr, wc]) => wr === r && wc === c) ?? false;
  };

  return (
    <div className="relative bg-blue-700 p-4 rounded-2xl shadow-2xl border-4 border-blue-800">
      {/* Grid layout setup: 7 columns for Connect Four standard.
          Responsive gap adjustments for mobile/desktop.
      */}
      <div className="grid grid-cols-7 gap-2 md:gap-4">
        {Array.from({ length: COLS }).map((_, colIndex) => (
          <div
            key={colIndex}
            className={`flex flex-col gap-2 md:gap-4 cursor-pointer group ${disabled ? 'cursor-not-allowed' : ''}`}
            onClick={() => !disabled && onColumnClick(colIndex)}
          >
            {Array.from({ length: ROWS }).map((_, rowIndex) => {
              const cell = board[rowIndex][colIndex];
              const isWin = isWinningCell(rowIndex, colIndex);
              
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    w-10 h-10 md:w-16 md:h-16 rounded-full flex items-center justify-center
                    transition-all duration-300 relative
                    ${cell === Player.NONE ? 'bg-blue-900 shadow-inner' : ''}
                    ${cell === Player.HUMAN ? 'bg-red-500 shadow-lg' : ''}
                    ${cell === Player.AI ? 'bg-yellow-400 shadow-lg' : ''}
                    ${isWin ? 'ring-4 ring-white animate-pulse scale-110 z-10' : ''}
                  `}
                >
                  {/* Hover effect to indicate where the piece will land (only if column is clickable) */}
                  {cell === Player.NONE && !disabled && (
                    <div className="w-full h-full rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};