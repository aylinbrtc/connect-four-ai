import { useState, useEffect, useCallback } from 'react';
import { Player, BoardState, GameResult } from './types';
import { createEmptyBoard, isValidMove, getNextOpenRow, dropPiece, checkWin } from './gameLogic';
import { minimax } from './ai';
import { Board } from './components/Board';
import { Trophy, RotateCcw, Cpu, User, Settings2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Main Application Component - Connect Four AI
 * Handles game state transitions, player turns, and AI agent execution.
 */
export default function App() {
  // --- State Management ---
  const [board, setBoard] = useState<BoardState>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(Player.HUMAN);
  const [gameResult, setGameResult] = useState<GameResult>({ winner: null, winningCells: null });
  const [difficulty, setDifficulty] = useState<number>(4); // Search Depth for Minimax
  const [isComputing, setIsComputing] = useState(false); // Refactored from isThinking
  const [showProjectDetails, setShowProjectDetails] = useState(false);

  /**
   * Resets the game state to initial values.
   */
  const resetGame = () => {
    setBoard(createEmptyBoard());
    setCurrentPlayer(Player.HUMAN);
    setGameResult({ winner: null, winningCells: null });
    setIsComputing(false);
  };

  /**
   * Orchestrates the human player's move.
   * Updates board state and triggers the AI agent.
   */
  const handleMove = useCallback((col: number) => {
    if (gameResult.winner || isComputing || !isValidMove(board, col)) return;

    const row = getNextOpenRow(board, col);
    const newBoard = dropPiece(board, row, col, Player.HUMAN);
    setBoard(newBoard);

    const result = checkWin(newBoard, Player.HUMAN);
    if (result.winner) {
      setGameResult(result);
    } else {
      setCurrentPlayer(Player.AI);
      setIsComputing(true);
    }
  }, [board, gameResult.winner, isComputing]);

  /**
   * Effect Hook: AI Agent Logic
   * Monitors 'currentPlayer' and executes Minimax search when it's the AI's turn.
   */
  useEffect(() => {
    if (currentPlayer === Player.AI && !gameResult.winner) {
      // Artificial delay to simulate processing time and improve UX
      const timer = setTimeout(() => {
        const [bestCol] = minimax(board, difficulty, -Infinity, Infinity, true);
        
        if (bestCol !== null) {
          const row = getNextOpenRow(board, bestCol);
          const newBoard = dropPiece(board, row, bestCol, Player.AI);
          setBoard(newBoard);

          const result = checkWin(newBoard, Player.AI);
          if (result.winner) {
            setGameResult(result);
          } else {
            setCurrentPlayer(Player.HUMAN);
          }
        }
        setIsComputing(false);
      }, 600); 
      
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, board, difficulty, gameResult.winner]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-red-500/30">
      {/* Navigation & Control Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/20">
              <span className="font-bold text-white">4</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Connect Four AI Agent</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowProjectDetails(!showProjectDetails)}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-100"
            >
              <Info size={20} />
            </button>
            <button
              onClick={resetGame}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all active:scale-95 text-sm font-medium"
            >
              <RotateCcw size={16} />
              Reset Game
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 grid lg:grid-cols-[1fr_320px] gap-12">
        {/* Game Implementation Section */}
        <section className="flex flex-col items-center gap-8">
          <div className="w-full flex justify-between items-center mb-4">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${currentPlayer === Player.HUMAN ? 'bg-red-500/10 ring-1 ring-red-500/50' : 'opacity-40'}`}>
              <User size={20} className="text-red-500" />
              <span className="font-medium">User (Human)</span>
            </div>
            
            <div className="flex flex-col items-center">
              {isComputing ? (
                <div className="flex items-center gap-2 text-zinc-400 text-sm animate-pulse">
                  <Cpu size={16} className="animate-spin" />
                  Agent is computing...
                </div>
              ) : gameResult.winner ? (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-2 text-yellow-500 font-bold"
                >
                  <Trophy size={20} />
                  {gameResult.winner === Player.HUMAN ? 'Human Victory' : gameResult.winner === Player.AI ? 'AI Victory' : "Stalemate (Draw)"}
                </motion.div>
              ) : (
                <div className="text-zinc-500 text-sm font-medium uppercase tracking-widest">
                  {currentPlayer === Player.HUMAN ? "Action Required" : "Computing Move"}
                </div>
              )}
            </div>

            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${currentPlayer === Player.AI ? 'bg-yellow-500/10 ring-1 ring-yellow-500/50' : 'opacity-40'}`}>
              <Cpu size={20} className="text-yellow-500" />
              <span className="font-medium">AI Agent (Minimax)</span>
            </div>
          </div>

          <Board 
            board={board} 
            onColumnClick={handleMove} 
            winningCells={gameResult.winningCells}
            disabled={currentPlayer === Player.AI || !!gameResult.winner}
          />
        </section>

        {/* Algorithm Configuration Sidebar */}
        <aside className="space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <Settings2 size={18} />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Search Parameters</h2>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-zinc-400 block mb-2">Tree Search Depth</span>
                <input 
                  type="range" 
                  min="2" 
                  max="6" 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <div className="flex justify-between text-xs text-zinc-500 mt-2">
                  <span>Linear (2)</span>
                  <span className="text-red-500 font-bold">{difficulty}</span>
                  <span>Deep (6)</span>
                </div>
              </label>

              <div className="pt-4 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  The depth parameter controls the recursive limit of the Minimax search tree. Increasing depth exponentially increases the state-space evaluation.
                </p>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showProjectDetails && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6"
              >
                <h3 className="text-red-500 font-semibold mb-2 flex items-center gap-2">
                  <Info size={16} />
                  Academic Context
                </h3>
                <div className="text-sm text-zinc-400 space-y-3">
                  <p><strong>Lead Developer:</strong> Aylin BARUTÇU</p>
                  <p><strong>Department:</strong> TOBB ETÜ Computer Engineering</p>
                  <p><strong>Implementation:</strong> Zero-sum game theory via Alpha-Beta Pruning.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-zinc-900 text-center">
        <p className="text-zinc-600 text-sm">
          Decision Support Systems Project &copy; 2026
        </p>
      </footer>
    </div>
  );
}