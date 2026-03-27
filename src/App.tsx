import { useState, useEffect, useCallback } from 'react';
import { Player, BoardState, GameResult } from './types';
import { createEmptyBoard, isValidMove, getNextOpenRow, dropPiece, checkWin } from './gameLogic';
import { getBestMove, SearchStats } from './ai';
import { Board } from './components/Board';
import { BenchmarkPanel } from './components/BenchmarkPanel';
import { Trophy, RotateCcw, Cpu, User, Settings2, Info, Activity, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Two modes: the usual human-vs-AI, and an AI-vs-AI spectator mode where
// two agents at configurable depths play each other. The second mode is
// useful for comparing depth settings and demonstrating the algorithm's
// decisiveness at higher depths.
type GameMode = 'human-vs-ai' | 'ai-vs-ai';

export default function App() {
  const [board, setBoard] = useState<BoardState>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>(Player.HUMAN);
  const [gameResult, setGameResult] = useState<GameResult>({ winner: null, winningCells: null });
  const [difficulty, setDifficulty] = useState<number>(4);    // Yellow AI max depth
  const [redDepth, setRedDepth] = useState<number>(2);         // Red AI max depth (AI vs AI only)
  const [gameMode, setGameMode] = useState<GameMode>('human-vs-ai');
  const [isComputing, setIsComputing] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [lastStats, setLastStats] = useState<SearchStats | null>(null);

  const resetGame = (newMode?: GameMode) => {
    setBoard(createEmptyBoard());
    setCurrentPlayer(Player.HUMAN);
    setGameResult({ winner: null, winningCells: null });
    setIsComputing(false);
    if (newMode) setGameMode(newMode);
  };

  // Human move handler — only active in human-vs-ai mode.
  const handleMove = useCallback((col: number) => {
    if (gameMode !== 'human-vs-ai') return;
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
  }, [board, gameResult.winner, isComputing, gameMode]);

  // Watch for any computer turn (Player.AI in both modes, and Player.HUMAN
  // when AI vs AI is active). The 600 ms delay on AI turns and 900 ms
  // on AI-vs-AI turns are intentional — the UI needs time to paint the
  // previous move before the next one computes.
  useEffect(() => {
    const isAITurn =
      (currentPlayer === Player.AI ||
       (gameMode === 'ai-vs-ai' && currentPlayer === Player.HUMAN)) &&
      !gameResult.winner;

    if (!isAITurn) return;

    // In AI-vs-AI both sides need the computing flag set, but no human
    // click triggered it, so we set it here.
    if (gameMode === 'ai-vs-ai') setIsComputing(true);

    const currentDepth = currentPlayer === Player.AI ? difficulty : redDepth;
    const delay = gameMode === 'ai-vs-ai' ? 900 : 600;

    const timer = setTimeout(() => {
      const { col: bestCol, depthReached, ttSize, nodesEvaluated, ttHitRate } = getBestMove(board, currentDepth);
      setLastStats({ depthReached, ttSize, nodesEvaluated, ttHitRate });

      if (bestCol !== null) {
        const row = getNextOpenRow(board, bestCol);
        const newBoard = dropPiece(board, row, bestCol, currentPlayer);
        setBoard(newBoard);

        const result = checkWin(newBoard, currentPlayer);
        if (result.winner) {
          setGameResult(result);
          setIsComputing(false);
        } else {
          // In AI vs AI, keep isComputing true — the other agent moves immediately.
          if (gameMode !== 'ai-vs-ai') setIsComputing(false);
          setCurrentPlayer(prev => prev === Player.HUMAN ? Player.AI : Player.HUMAN);
        }
      } else {
        setIsComputing(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [currentPlayer, board, difficulty, redDepth, gameResult.winner, gameMode]);

  // Human label changes when AI vs AI is active
  const leftLabel  = gameMode === 'ai-vs-ai' ? `Red Agent (d=${redDepth})`    : 'User (Human)';
  const rightLabel = gameMode === 'ai-vs-ai' ? `Yellow Agent (d=${difficulty})` : 'AI Agent (Minimax)';

  const getWinnerLabel = () => {
    if (gameResult.winner === 'DRAW') return 'Stalemate (Draw)';
    if (gameResult.winner === Player.HUMAN)
      return gameMode === 'ai-vs-ai' ? 'Red Agent Wins' : 'Human Victory';
    if (gameResult.winner === Player.AI)
      return gameMode === 'ai-vs-ai' ? 'Yellow Agent Wins' : 'AI Victory';
    return '';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-red-500/30">
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
              onClick={() => setShowBenchmark(true)}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-100"
              title="Run algorithm benchmark"
            >
              <BarChart2 size={20} />
            </button>
            <button
              onClick={() => setShowProjectDetails(!showProjectDetails)}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-100"
            >
              <Info size={20} />
            </button>
            <button
              onClick={() => resetGame()}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all active:scale-95 text-sm font-medium"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 grid lg:grid-cols-[1fr_320px] gap-12">
        <section className="flex flex-col items-center gap-8">
          {/* Player indicators */}
          <div className="w-full flex justify-between items-center mb-4">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${currentPlayer === Player.HUMAN ? 'bg-red-500/10 ring-1 ring-red-500/50' : 'opacity-40'}`}>
              {gameMode === 'ai-vs-ai' ? <Cpu size={20} className="text-red-500" /> : <User size={20} className="text-red-500" />}
              <span className="font-medium">{leftLabel}</span>
            </div>

            <div className="flex flex-col items-center">
              {isComputing ? (
                <div className="flex items-center gap-2 text-zinc-400 text-sm animate-pulse">
                  <Cpu size={16} className="animate-spin" />
                  {gameMode === 'ai-vs-ai'
                    ? (currentPlayer === Player.HUMAN ? 'Red Agent thinking…' : 'Yellow Agent thinking…')
                    : 'Agent is computing…'}
                </div>
              ) : gameResult.winner ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-2 text-yellow-500 font-bold"
                >
                  <Trophy size={20} />
                  {getWinnerLabel()}
                </motion.div>
              ) : (
                <div className="text-zinc-500 text-sm font-medium uppercase tracking-widest">
                  {currentPlayer === Player.HUMAN
                    ? (gameMode === 'ai-vs-ai' ? 'Red Agent\'s turn' : 'Your turn')
                    : 'Computing Move'}
                </div>
              )}
            </div>

            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${currentPlayer === Player.AI ? 'bg-yellow-500/10 ring-1 ring-yellow-500/50' : 'opacity-40'}`}>
              <Cpu size={20} className="text-yellow-500" />
              <span className="font-medium">{rightLabel}</span>
            </div>
          </div>

          <Board
            board={board}
            onColumnClick={handleMove}
            winningCells={gameResult.winningCells}
            disabled={
              gameMode === 'ai-vs-ai' ||
              currentPlayer === Player.AI ||
              !!gameResult.winner
            }
          />
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Game mode toggle */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => resetGame('human-vs-ai')}
                className={`py-2 rounded-lg text-sm font-medium transition-all ${
                  gameMode === 'human-vs-ai'
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Human vs AI
              </button>
              <button
                onClick={() => resetGame('ai-vs-ai')}
                className={`py-2 rounded-lg text-sm font-medium transition-all ${
                  gameMode === 'ai-vs-ai'
                    ? 'bg-yellow-500 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                AI vs AI
              </button>
            </div>
          </div>

          {/* Depth sliders */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
              <Settings2 size={18} />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Search Parameters</h2>
            </div>

            {/* Yellow AI depth — always visible */}
            <label className="block">
              <span className="text-sm text-zinc-400 block mb-2">
                {gameMode === 'ai-vs-ai' ? 'Yellow Agent — Max Depth' : 'AI Max Search Depth'}
              </span>
              <input
                type="range" min="2" max="6" value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-2">
                <span>Easy (2)</span>
                <span className="text-yellow-400 font-bold">{difficulty}</span>
                <span>Hard (6)</span>
              </div>
            </label>

            {/* Red AI depth — only in AI vs AI mode */}
            <AnimatePresence>
              {gameMode === 'ai-vs-ai' && (
                <motion.label
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="block overflow-hidden"
                >
                  <span className="text-sm text-zinc-400 block mb-2">Red Agent — Max Depth</span>
                  <input
                    type="range" min="2" max="6" value={redDepth}
                    onChange={(e) => setRedDepth(parseInt(e.target.value))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <div className="flex justify-between text-xs text-zinc-500 mt-2">
                    <span>Easy (2)</span>
                    <span className="text-red-400 font-bold">{redDepth}</span>
                    <span>Hard (6)</span>
                  </div>
                </motion.label>
              )}
            </AnimatePresence>

            <div className="pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 leading-relaxed">
                {gameMode === 'ai-vs-ai'
                  ? 'Both agents use Iterative Deepening Search with a shared Transposition Table per move. Try different depth combinations to compare strength.'
                  : 'Iterative Deepening Search from depth 1 up to the limit. The Transposition Table is warmed by shallower passes, so deeper iterations prune more aggressively.'}
              </p>
            </div>
          </div>

          {/* Last search stats — visible after first AI move */}
          <AnimatePresence>
            {lastStats && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 text-zinc-400 mb-4">
                  <Activity size={18} />
                  <h2 className="text-sm font-semibold uppercase tracking-wider">Last Search Stats</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Depth Reached</span>
                    <span className="text-sm font-mono font-medium text-red-400">
                      {lastStats.depthReached} / {difficulty}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Nodes Evaluated</span>
                    <span className="text-sm font-mono font-medium text-blue-400">
                      {lastStats.nodesEvaluated.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">TT States Cached</span>
                    <span className="text-sm font-mono font-medium text-yellow-400">
                      {lastStats.ttSize.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">TT Hit Rate</span>
                    <span className="text-sm font-mono font-medium text-purple-400">
                      {lastStats.ttHitRate}%
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Academic context panel */}
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
                  <p><strong>Developer:</strong> Aylin BARUTÇU — 211101031</p>
                  <p><strong>Department:</strong> TOBB ETÜ Computer Engineering</p>
                  <p><strong>Course:</strong> YAP 441 / BİL 541 — Decision Support Systems, Spring 2025–26</p>
                  <p><strong>Algorithm:</strong> Minimax · Alpha-Beta Pruning · Iterative Deepening · Zobrist Hashing · Transposition Table · Fork Detection</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-zinc-900 text-center">
        <p className="text-zinc-600 text-sm">Decision Support Systems Project &copy; 2026</p>
      </footer>

      {/* Benchmark modal — renders on top of everything else */}
      <AnimatePresence>
        {showBenchmark && (
          <BenchmarkPanel onClose={() => setShowBenchmark(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
