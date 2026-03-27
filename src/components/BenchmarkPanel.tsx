import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  runBenchmark, TEST_POSITION, VariantResult,
  runWinRateMatrix, WinRateRow,
  runPhaseComparison, PhaseEntry,
  runForkComparison, ForkResult,
} from '../benchmark';
import { BarChart2, X, Copy, Check, Loader } from 'lucide-react';

const VARIANT_COLORS = [
  'text-zinc-400',
  'text-blue-400',
  'text-purple-400',
  'text-yellow-400',
];
const VARIANT_BG = [
  'bg-zinc-800/40',
  'bg-blue-900/20',
  'bg-purple-900/20',
  'bg-yellow-900/20',
];

const PHASE_COLORS: Record<string, string> = {
  'Early game': 'text-green-400',
  'Mid game':   'text-yellow-400',
  'Late game':  'text-red-400',
};

const WIN_RATE_DEPTHS = [2, 4, 6];

type Tab = 'nodes' | 'winrate' | 'phase' | 'fork';

interface Props { onClose: () => void; }

export const BenchmarkPanel: React.FC<Props> = ({ onClose }) => {
  const [tab, setTab] = useState<Tab>('nodes');

  // Exp 1
  const [nodeResults, setNodeResults] = useState<VariantResult[]>([]);
  const [nodeRunning, setNodeRunning] = useState(false);
  const [nodeDone, setNodeDone] = useState(false);

  // Exp 2
  const [winRateRows, setWinRateRows] = useState<WinRateRow[]>([]);
  const [winRateRunning, setWinRateRunning] = useState(false);
  const [winRateDone, setWinRateDone] = useState(false);

  // Exp 3
  const [phaseEntries, setPhaseEntries] = useState<PhaseEntry[]>([]);
  const [phaseRunning, setPhaseRunning] = useState(false);
  const [phaseDone, setPhaseDone] = useState(false);

  // Exp 4
  const [forkResult, setForkResult] = useState<ForkResult | null>(null);
  const [forkRunning, setForkRunning] = useState(false);
  const [forkDone, setForkDone] = useState(false);

  const [copied, setCopied] = useState(false);

  // ---- runners ----

  const runNodes = async () => {
    setNodeResults([]); setNodeDone(false); setNodeRunning(true);
    const final = await runBenchmark(TEST_POSITION, p => setNodeResults([...p]));
    setNodeResults(final); setNodeRunning(false); setNodeDone(true);
  };

  const runWinRate = async () => {
    setWinRateRows([]); setWinRateDone(false); setWinRateRunning(true);
    const final = await runWinRateMatrix(WIN_RATE_DEPTHS, r => setWinRateRows([...r]));
    setWinRateRows(final); setWinRateRunning(false); setWinRateDone(true);
  };

  const runPhase = async () => {
    setPhaseEntries([]); setPhaseDone(false); setPhaseRunning(true);
    const final = await runPhaseComparison(e => setPhaseEntries([...e]));
    setPhaseEntries(final); setPhaseRunning(false); setPhaseDone(true);
  };

  const runFork = async () => {
    setForkResult(null); setForkDone(false); setForkRunning(true);
    const final = await runForkComparison(10, r => setForkResult({ ...r }));
    setForkResult(final); setForkRunning(false); setForkDone(true);
  };

  // ---- CSV export ----

  const copyCSV = () => {
    let text = '';
    if (tab === 'nodes' && nodeResults.length) {
      const header = 'Configuration,Depth,Nodes,Time (ms)';
      const lines = nodeResults.flatMap(v =>
        v.rows.map(r => `"${v.config}",${r.depth},${r.nodes},${r.timeMs}`)
      );
      text = [header, ...lines].join('\n');
    } else if (tab === 'winrate' && winRateRows.length) {
      const header = 'Red Depth,Yellow Depth,Red Wins,Draws,Yellow Wins,Games';
      const lines = winRateRows.map(r =>
        `${r.redDepth},${r.yellowDepth},${r.redWins},${r.draws},${r.yellowWins},${r.games}`
      );
      text = [header, ...lines].join('\n');
    } else if (tab === 'phase' && phaseEntries.length) {
      const header = 'Phase,Pieces,Depth,Nodes,Time (ms),TT Hit Rate (%)';
      const lines = phaseEntries.map(e =>
        `"${e.phase}",${e.pieces},${e.depth},${e.nodes},${e.timeMs},${e.ttHitRate}`
      );
      text = [header, ...lines].join('\n');
    } else if (tab === 'fork' && forkResult) {
      const header = 'With Fork Wins,Draws,No Fork Wins,Games';
      text = [header,
        `${forkResult.withForkWins},${forkResult.draws},${forkResult.noForkWins},${forkResult.games}`
      ].join('\n');
    }
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const canCopy = (
    (tab === 'nodes' && nodeDone) ||
    (tab === 'winrate' && winRateDone) ||
    (tab === 'phase' && phaseDone) ||
    (tab === 'fork' && forkDone)
  );

  // ---- helpers ----

  const pct = (wins: number, total: number) =>
    total > 0 ? Math.round(100 * wins / total) + '%' : '—';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'nodes',   label: '1. Node Count' },
    { id: 'winrate', label: '2. Win Rate' },
    { id: 'phase',   label: '3. Game Phase' },
    { id: 'fork',    label: '4. Fork Detection' },
  ];

  // Group phase entries by phase name
  const phaseGroups = ['Early game', 'Mid game', 'Late game'].map(p => ({
    phase: p,
    entries: phaseEntries.filter(e => e.phase === p),
  }));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <BarChart2 size={20} className="text-yellow-400" />
            <div>
              <h2 className="font-semibold text-zinc-100">Algorithm Benchmark</h2>
              <p className="text-xs text-zinc-500 mt-0.5">4 experiments — run each independently</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canCopy && (
              <button
                onClick={copyCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-all"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy CSV'}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-0 shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* ---- Experiment 1: Node Comparison ---- */}
          {tab === 'nodes' && (
            <>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-sm text-zinc-400">
                <p className="text-zinc-300 font-medium mb-1">Test Position — Mid-game (12 pieces)</p>
                <pre className="font-mono text-xs text-zinc-500 leading-relaxed">{`. . . . . . .
. . . . . . .
. . . Y . . .
. . R Y R . .
. . Y R Y R .
. R Y R Y R Y`}</pre>
                <p className="text-xs mt-2">Compares 4 configurations: Pure Minimax → +Alpha-Beta → +Move Ordering → +TT+IDS.</p>
              </div>

              {!nodeRunning && !nodeDone && (
                <button onClick={runNodes} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold rounded-xl transition-all active:scale-[0.99]">
                  Run Experiment
                </button>
              )}
              {nodeRunning && (
                <div className="flex items-center justify-center gap-3 py-4 text-zinc-400">
                  <Loader size={18} className="animate-spin" />
                  <span className="text-sm">Running… {nodeResults.length}/4 variants complete</span>
                </div>
              )}

              <AnimatePresence>
                {nodeResults.map((variant, vi) => (
                  <motion.div key={variant.config} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl overflow-hidden border border-zinc-800 ${VARIANT_BG[vi]}`}>
                    <div className="px-4 py-3 border-b border-zinc-800">
                      <p className={`font-semibold text-sm ${VARIANT_COLORS[vi]}`}>{variant.config}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{variant.note}</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                          <th className="text-left px-4 py-2">Depth</th>
                          <th className="text-right px-4 py-2">Nodes</th>
                          <th className="text-right px-4 py-2">Time (ms)</th>
                          <th className="text-right px-4 py-2">Nodes/ms</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variant.rows.map(row => (
                          <tr key={row.depth} className="border-b border-zinc-800/50 last:border-0">
                            <td className="px-4 py-2 font-mono text-zinc-300">{row.depth}</td>
                            <td className={`px-4 py-2 font-mono text-right ${VARIANT_COLORS[vi]}`}>{row.nodes.toLocaleString()}</td>
                            <td className="px-4 py-2 font-mono text-right text-zinc-400">{row.timeMs < 1 ? '<1' : row.timeMs}</td>
                            <td className="px-4 py-2 font-mono text-right text-zinc-500 text-xs">
                              {row.timeMs > 0 ? Math.round(row.nodes / row.timeMs).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                ))}
              </AnimatePresence>

              {nodeDone && nodeResults.length === 4 && (() => {
                const d4 = (vi: number) => nodeResults[vi].rows.find(r => r.depth === 4)?.nodes ?? 1;
                const base = d4(0);
                return (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-zinc-800/60 rounded-xl p-5">
                    <p className="text-sm font-semibold text-zinc-300 mb-3">Node Reduction at Depth 4 (vs. Pure Minimax)</p>
                    <div className="space-y-2">
                      {[1, 2, 3].map(vi => (
                        <div key={vi} className="flex justify-between items-center text-sm">
                          <span className={VARIANT_COLORS[vi]}>{nodeResults[vi].config}</span>
                          <span className="font-mono font-bold text-zinc-100">{(base / d4(vi)).toFixed(1)}× fewer nodes</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })()}

              {nodeDone && (
                <button onClick={runNodes} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-all">
                  Run Again
                </button>
              )}
            </>
          )}

          {/* ---- Experiment 2: Win Rate Matrix ---- */}
          {tab === 'winrate' && (
            <>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-sm text-zinc-400">
                <p className="text-zinc-300 font-medium mb-1">Win Rate Matrix — depths {WIN_RATE_DEPTHS.join(', ')}</p>
                <p className="text-xs">Each cell is Red (depth=row) vs Yellow (depth=col). Deterministic matchups (both ≥4) run once; others run 10 games.</p>
              </div>

              {!winRateRunning && !winRateDone && (
                <button onClick={runWinRate} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold rounded-xl transition-all active:scale-[0.99]">
                  Run Experiment
                </button>
              )}
              {winRateRunning && (
                <div className="flex items-center justify-center gap-3 py-4 text-zinc-400">
                  <Loader size={18} className="animate-spin" />
                  <span className="text-sm">Running… {winRateRows.length}/{WIN_RATE_DEPTHS.length ** 2} matchups complete</span>
                </div>
              )}

              {winRateRows.length > 0 && (() => {
                // Build a lookup: [redDepth][yellowDepth] → row
                const lookup: Record<string, WinRateRow> = {};
                for (const r of winRateRows) lookup[`${r.redDepth}_${r.yellowDepth}`] = r;

                return (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl overflow-hidden border border-zinc-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-800/60 text-zinc-500 text-xs uppercase tracking-wider">
                          <th className="text-left px-4 py-3">Red ↓ / Yellow →</th>
                          {WIN_RATE_DEPTHS.map(d => (
                            <th key={d} className="text-center px-3 py-3 text-yellow-400">d={d}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {WIN_RATE_DEPTHS.map(rd => (
                          <tr key={rd} className="border-t border-zinc-800">
                            <td className="px-4 py-3 font-mono text-red-400 font-medium text-xs">d={rd}</td>
                            {WIN_RATE_DEPTHS.map(yd => {
                              const r = lookup[`${rd}_${yd}`];
                              if (!r) return <td key={yd} className="px-3 py-3 text-center text-zinc-600 text-xs">—</td>;
                              return (
                                <td key={yd} className="px-3 py-3 text-center">
                                  <div className="text-xs font-mono space-y-0.5">
                                    <div className="text-red-400">{pct(r.redWins, r.games)} R</div>
                                    <div className="text-zinc-500">{pct(r.draws, r.games)} D</div>
                                    <div className="text-yellow-400">{pct(r.yellowWins, r.games)} Y</div>
                                    <div className="text-zinc-600 text-[10px]">n={r.games}</div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                );
              })()}

              {winRateDone && (
                <button onClick={runWinRate} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-all">
                  Run Again
                </button>
              )}
            </>
          )}

          {/* ---- Experiment 3: Game Phase Analysis ---- */}
          {tab === 'phase' && (
            <>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-sm text-zinc-400">
                <p className="text-zinc-300 font-medium mb-1">Game Phase Analysis</p>
                <p className="text-xs">How node count and TT hit rate change across early (6 pieces), mid (12), and late (28) game positions.</p>
              </div>

              {!phaseRunning && !phaseDone && (
                <button onClick={runPhase} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold rounded-xl transition-all active:scale-[0.99]">
                  Run Experiment
                </button>
              )}
              {phaseRunning && (
                <div className="flex items-center justify-center gap-3 py-4 text-zinc-400">
                  <Loader size={18} className="animate-spin" />
                  <span className="text-sm">Running… {phaseEntries.length}/18 data points complete</span>
                </div>
              )}

              <AnimatePresence>
                {phaseGroups.filter(g => g.entries.length > 0).map(g => (
                  <motion.div key={g.phase} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-800/30">
                    <div className="px-4 py-3 border-b border-zinc-800">
                      <p className={`font-semibold text-sm ${PHASE_COLORS[g.phase] ?? 'text-zinc-300'}`}>{g.phase}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{g.entries[0]?.pieces} pieces on board</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                          <th className="text-left px-4 py-2">Depth</th>
                          <th className="text-right px-4 py-2">Nodes</th>
                          <th className="text-right px-4 py-2">Time (ms)</th>
                          <th className="text-right px-4 py-2">TT Hit %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.entries.map(e => (
                          <tr key={e.depth} className="border-b border-zinc-800/50 last:border-0">
                            <td className="px-4 py-2 font-mono text-zinc-300">{e.depth}</td>
                            <td className={`px-4 py-2 font-mono text-right ${PHASE_COLORS[g.phase] ?? 'text-zinc-300'}`}>{e.nodes.toLocaleString()}</td>
                            <td className="px-4 py-2 font-mono text-right text-zinc-400">{e.timeMs < 1 ? '<1' : e.timeMs}</td>
                            <td className="px-4 py-2 font-mono text-right text-zinc-400">{e.ttHitRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                ))}
              </AnimatePresence>

              {phaseDone && (
                <button onClick={runPhase} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-all">
                  Run Again
                </button>
              )}
            </>
          )}

          {/* ---- Experiment 4: Fork Detection ---- */}
          {tab === 'fork' && (
            <>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-sm text-zinc-400">
                <p className="text-zinc-300 font-medium mb-1">Fork Detection Impact — 10 games, depth 4 each</p>
                <p className="text-xs">Both agents use the full search stack (AB + TT + IDS + move ordering). One keeps the +50/-50 fork bonus in its eval, the other doesn't. Sides alternate every game to neutralise first-move advantage.</p>
              </div>

              {!forkRunning && !forkDone && (
                <button onClick={runFork} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold rounded-xl transition-all active:scale-[0.99]">
                  Run Experiment
                </button>
              )}
              {forkRunning && forkResult && (
                <div className="flex items-center justify-center gap-3 py-4 text-zinc-400">
                  <Loader size={18} className="animate-spin" />
                  <span className="text-sm">Running… {forkResult.games}/10 games complete</span>
                </div>
              )}
              {forkRunning && !forkResult && (
                <div className="flex items-center justify-center gap-3 py-4 text-zinc-400">
                  <Loader size={18} className="animate-spin" />
                  <span className="text-sm">Starting…</span>
                </div>
              )}

              <AnimatePresence>
                {forkResult && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-800/30">
                    <div className="px-4 py-3 border-b border-zinc-800">
                      <p className="font-semibold text-sm text-zinc-300">Results after {forkResult.games} game{forkResult.games !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* Bar chart */}
                      {(() => {
                        const total = forkResult.games;
                        const wPct = total > 0 ? (forkResult.withForkWins / total) * 100 : 0;
                        const dPct = total > 0 ? (forkResult.draws / total) * 100 : 0;
                        const nPct = total > 0 ? (forkResult.noForkWins / total) * 100 : 0;
                        return (
                          <>
                            <div className="w-full h-5 rounded-full overflow-hidden flex">
                              {wPct > 0 && <div style={{ width: `${wPct}%` }} className="bg-green-500 transition-all duration-500" />}
                              {dPct > 0 && <div style={{ width: `${dPct}%` }} className="bg-zinc-600 transition-all duration-500" />}
                              {nPct > 0 && <div style={{ width: `${nPct}%` }} className="bg-red-500 transition-all duration-500" />}
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <p className="text-2xl font-bold font-mono text-green-400">{forkResult.withForkWins}</p>
                                <p className="text-xs text-zinc-500 mt-1">With Fork wins</p>
                                <p className="text-xs text-green-600">{pct(forkResult.withForkWins, total)}</p>
                              </div>
                              <div>
                                <p className="text-2xl font-bold font-mono text-zinc-400">{forkResult.draws}</p>
                                <p className="text-xs text-zinc-500 mt-1">Draws</p>
                                <p className="text-xs text-zinc-600">{pct(forkResult.draws, total)}</p>
                              </div>
                              <div>
                                <p className="text-2xl font-bold font-mono text-red-400">{forkResult.noForkWins}</p>
                                <p className="text-xs text-zinc-500 mt-1">No Fork wins</p>
                                <p className="text-xs text-red-600">{pct(forkResult.noForkWins, total)}</p>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {forkDone && (
                <button onClick={runFork} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-all">
                  Run Again
                </button>
              )}
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
};
