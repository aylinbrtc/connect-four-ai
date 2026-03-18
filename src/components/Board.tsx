import React from 'react';
import { Player, ROWS, COLS, BoardState } from '../types';

interface BoardProps {
  board: BoardState;
  onColumnClick: (col: number) => void;
  winningCells: [number, number][] | null;
  disabled: boolean;
}

export const Board: React.FC<BoardProps> = ({ board, onColumnClick, winningCells, disabled }) => {

  // Quick lookup to check if a cell is part of the winning four.
  // We need this to style them differently (pulse + ring) once the game ends.
  const isWinningCell = (r: number, c: number) => {
    return winningCells?.some(([wr, wc]) => wr === r && wc === c) ?? false;
  };

  return (
    // The outer div is the blue board frame. Rounded corners and a heavy border
    // give it the physical "board" feel.
    <div className="relative bg-blue-700 p-4 rounded-2xl shadow-2xl border-4 border-blue-800">
      {/*
        Layout: 7 columns matching COLS. Each column is a flex container
        stacking cells from top to bottom (row 0 = top, row 5 = bottom).
        Clicking anywhere in a column fires onColumnClick with that column index.
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
                    ${cell === Player.NONE  ? 'bg-blue-900 shadow-inner' : ''}
                    ${cell === Player.HUMAN ? 'bg-red-500 shadow-lg'    : ''}
                    ${cell === Player.AI    ? 'bg-yellow-400 shadow-lg' : ''}
                    ${isWin ? 'ring-4 ring-white animate-pulse scale-110 z-10' : ''}
                  `}
                >
                  {/* Subtle hover highlight on empty cells so the player can
                      see where their piece will land before clicking. */}
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
