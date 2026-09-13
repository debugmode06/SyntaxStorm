import React, { useState, useEffect } from 'react';
import { PlagiarismComparison } from '../../types';
import { api } from '../../api';
import { FileSearch, AlertTriangle, CheckCircle2, Sliders } from 'lucide-react';

export const PlagiarismPanel: React.FC = () => {
  const [comparisons, setComparisons] = useState<PlagiarismComparison[]>([]);
  const [threshold, setThreshold] = useState<number>(60);
  const [selectedPair, setSelectedPair] = useState<PlagiarismComparison | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPlagiarism = async () => {
    setLoading(true);
    try {
      const res = await api.getPlagiarismReport();
      setComparisons(res.comparisons || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlagiarism();
  }, []);

  const filtered = comparisons.filter(c => c.similarityScore >= threshold);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileSearch className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-black text-gray-900 tracking-tight">
              Cross-Candidate Plagiarism & Code Similarity Scanner
            </h2>
          </div>
          <p className="text-xs text-gray-500">
            Multi-dimensional evaluation across AST Structure, Token Sequences, and N-gram overlap.
          </p>
        </div>

        {/* Threshold Slider */}
        <div className="flex items-center space-x-3 bg-gray-50 p-2.5 rounded-2xl border border-gray-200">
          <Sliders className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-bold text-gray-700">Sensitivity Threshold:</span>
          <input
            type="range"
            min={30}
            max={90}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-28 accent-blue-600 cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-blue-600 w-8">{threshold}%</span>
        </div>
      </div>

      {/* Comparisons Table */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
          Similarity Comparisons (&ge; {threshold}%)
        </h3>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-xs font-medium">
            No solution pairs exceed the {threshold}% similarity threshold.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Problem</th>
                  <th className="px-4 py-3">Candidate A</th>
                  <th className="px-4 py-3">Candidate B</th>
                  <th className="px-4 py-3 text-center">AST Overlap</th>
                  <th className="px-4 py-3 text-center">Token Overlap</th>
                  <th className="px-4 py-3 text-center">Composite Score</th>
                  <th className="px-4 py-3 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filtered.map(pair => (
                  <tr key={pair.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900">
                      {pair.problemTitle}
                    </td>

                    <td className="px-4 py-3 text-gray-800">
                      {pair.userA.name}
                    </td>

                    <td className="px-4 py-3 text-gray-800">
                      {pair.userB.name}
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-gray-600">
                      {pair.astSimilarity}%
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-gray-600">
                      {pair.tokenSimilarity}%
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full font-mono ${
                          pair.similarityScore >= 80
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pair.similarityScore}% MATCH
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedPair(pair)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Side-by-Side Diff
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side-by-side Diff Modal */}
      {selectedPair && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 space-y-4 border border-gray-200 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900">
                  Side-by-Side Code Diff: {selectedPair.problemTitle}
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  Calculated Similarity: {selectedPair.similarityScore}% (AST: {selectedPair.astSimilarity}%, Token: {selectedPair.tokenSimilarity}%)
                </p>
              </div>
              <button
                onClick={() => setSelectedPair(null)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
              <div className="flex flex-col">
                <div className="text-xs font-bold text-gray-800 mb-1">
                  Candidate A: {selectedPair.userA.name}
                </div>
                <pre className="flex-1 bg-gray-900 text-gray-200 p-3.5 rounded-2xl text-xs font-mono overflow-auto border border-gray-800">
                  {selectedPair.codeA}
                </pre>
              </div>

              <div className="flex flex-col">
                <div className="text-xs font-bold text-gray-800 mb-1">
                  Candidate B: {selectedPair.userB.name}
                </div>
                <pre className="flex-1 bg-gray-900 text-gray-200 p-3.5 rounded-2xl text-xs font-mono overflow-auto border border-gray-800">
                  {selectedPair.codeB}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
