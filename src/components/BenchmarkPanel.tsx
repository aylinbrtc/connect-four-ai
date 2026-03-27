import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { runBenchmark, TEST_POSITION, VariantResult } from '../benchmark';
import { BarChart2, X, Copy, Check, Loader } from 'lucide-react';

// Colors for each variant row in the table — one color per configuration.
const VARIANT_COLORS = [
  'text-zinc-400',    // Pure Minimax — grey, the weakest baseline
  'text-blue-400',    // Alpha-Beta — blue, a big jump from baseline
  'text-purple-400',  // AB + Move Ordering — purple, incremental gain
  'text-yellow-400',  // Full Stack — yellow (AI color), the final result
];

const VARIANT_BG = [
  'bg-zinc-800/40',
  'bg-blue-900/20',
  'bg-purple-900/20',
  'bg-yellow-900/20',
];

interface Props {
  onClose: () => void;
}

export const BenchmarkPanel: React.FC<Props> = ({ onClose }) => {
  const [results, setResults] = useState<VariantResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const start = async () => {
    setResults([]);
    setDone(false);
    setRunning(true);
    const final = await runBenchmark(TEST_POSITION, (partial) => setResults([...partial]));
    setResults(final);
    setRunning(false);
    setDone(true);
  };

  // Generate a CSV string suitable for pasting into Excel or importing
  // into a LaTeX table generator.
  const copyCSV = () => {
    const header = 'Configuration,Depth,Nodes Evaluated,Time (ms)';
    const lines = results.flatMap(v =>
      v.rows.map(r => `"${v.config}",${r.depth},${r.nodes},${r.timeMs}`)
    );
    navigator.clipboard.writeText([header, ...lines].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    // Full-screen modal overlay
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <BarChart2 size={20} className="text-yellow-400" />
            <div>
              <h2 className="font-semibold text-zinc-100">Algorithm Benchmark</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Compares 4 search configurations on a fixed mid-game position
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {done && (
              <button
                onClick={copyCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-all"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy CSV'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Test position info */}
          <div className="bg-zinc-800/50 rounded-xl p-4 text-sm text-zinc-400 space-y-1">
            <p className="text-zinc-300 font-medium mb-1">Test Position — Mid-game (12 pieces placed)</p>
            <pre className="font-mono text-xs text-zinc-500 leading-relaxed">
{`. . . . . . .
. . . . . . .
. . . Y . . .
. . R Y R . .
. . Y R Y R .
. R Y R Y R Y`}
            </pre>
            <p className="text-xs mt-2">AI (Yellow) to move. Multiple threats from both sides.</p>
          </div>

          {/* Run button */}
          {!running && !done && (
            <button
              onClick={start}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold rounded-xl transition-all active:scale-[0.99]"
            >
              Run Benchmark
            </button>
          )}

          {running && !done && (
            <div className="flex items-center justify-center gap-3 py-4 text-zinc-400">
              <Loader size={18} className="animate-spin" />
              <span className="text-sm">
                Running… {results.length}/4 variants complete
              </span>
            </div>
          )}

          {/* Results table — shows each variant as it completes */}
          <AnimatePresence>
            {results.map((variant, vi) => (
              <motion.div
                key={variant.config}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl overflow-hidden border border-zinc-800 ${VARIANT_BG[vi]}`}
              >
                {/* Variant header */}
                <div className="px-4 py-3 border-b border-zinc-800">
                  <p className={`font-semibold text-sm ${VARIANT_COLORS[vi]}`}>{variant.config}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{variant.note}</p>
                </div>

                {/* Data table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-2">Depth</th>
                      <th className="text-right px-4 py-2">Nodes Evaluated</th>
                      <th className="text-right px-4 py-2">Time (ms)</th>
                      <th className="text-right px-4 py-2">Nodes/ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variant.rows.map((row) => (
                      <tr key={row.depth} className="border-b border-zinc-800/50 last:border-0">
                        <td className="px-4 py-2 font-mono text-zinc-300">{row.depth}</td>
                        <td className={`px-4 py-2 font-mono text-right ${VARIANT_COLORS[vi]}`}>
                          {row.nodes.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 font-mono text-right text-zinc-400">
                          {row.timeMs < 1 ? '<1' : row.timeMs}
                        </td>
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

          {/* Summary card — shows reduction ratios once all variants done */}
          {done && results.length === 4 && (() => {
            // Compare nodes at depth 4 (only depth that all 4 variants have)
            const d4 = (vi: number) => results[vi].rows.find(r => r.depth === 4)?.nodes ?? 1;
            const base = d4(0);
            const reductions = [1, 2, 3].map(vi => ({
              label: results[vi].config,
              factor: (base / d4(vi)).toFixed(1),
            }));
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-zinc-800/60 rounded-xl p-5"
              >
                <p className="text-sm font-semibold text-zinc-300 mb-3">
                  Node Reduction at Depth 4 (vs. Pure Minimax)
                </p>
                <div className="space-y-2">
                  {reductions.map((r, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className={`${VARIANT_COLORS[i + 1]}`}>{r.label}</span>
                      <span className="font-mono font-bold text-zinc-100">{r.factor}× fewer nodes</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })()}

          {done && (
            <button
              onClick={start}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-all"
            >
              Run Again
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
