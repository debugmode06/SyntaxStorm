import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, Contest, Batch } from '../../types';
import { api } from '../../api';
import {
  Trophy,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  X,
  ShieldAlert,
  Award,
  Layers,
  Sparkles,
  ChevronRight,
  Clock
} from 'lucide-react';

export const LeaderboardPanel: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  const [contestFilter, setContestFilter] = useState<string>('');
  const [roundFilter, setRoundFilter] = useState<string>('round-1');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contestsRes, batchesRes] = await Promise.all([
          api.getContests(),
          api.getAdminBatches()
        ]);
        setContests(contestsRes.contests || []);
        setBatches(batchesRes.batches || []);
        if (contestsRes.contests?.length > 0) {
          setContestFilter(contestsRes.contests[0].id);
          if (contestsRes.contests[0].batchId) {
             setBatchFilter(contestsRes.contests[0].batchId);
          }
        }
      } catch (err) {
        console.error('Error fetching contests/batches:', err);
      }
    };
    fetchData();
  }, []);

  const fetchLeaderboard = async () => {
    if (!contestFilter) return;
    try {
      const res = await api.getAdminLeaderboard(
        contestFilter,
        roundFilter,
        batchFilter === 'all' ? undefined : batchFilter
      );
      setLeaderboard(res.leaderboard || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setLeaderboard([]);
    fetchLeaderboard();
    const timer = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(timer);
  }, [contestFilter, roundFilter, batchFilter]);

  const exportCSV = () => {
    const headers = [
      'Rank',
      'Student Name',
      'Student ID',
      'College',
      'Batch',
      'Easy Score',
      'Easy Max',
      'Medium Score',
      'Medium Max',
      'Hard Score',
      'Hard Max',
      'Total Score',
      'Total Max',
      'Security Status',
      'Attempt Status',
      'Submitted At'
    ];

    const rows = leaderboard.map(l => [
      l.rank,
      `"${l.name || l.studentName}"`,
      `"${l.studentId || l.email}"`,
      `"${l.college || 'N/A'}"`,
      `"${l.batch || l.batchId || 'Alpha'}"`,
      l.easyScore ?? 0,
      l.easyMax || 10,
      l.mediumScore ?? 0,
      l.mediumMax || 15,
      l.hardScore ?? 0,
      l.hardMax || 25,
      l.totalScore ?? 0,
      l.totalMax || 50,
      `"${l.securityStatus || (l.isDisqualified ? 'TERMINATED' : 'CLEAR')}"`,
      `"${l.attemptStatus || 'IN_PROGRESS'}"`,
      `"${l.submittedAt || 'N/A'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `contest_leaderboard_${roundFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = leaderboard.filter(e => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (e.name || e.studentName || '').toLowerCase().includes(q) ||
      (e.studentId || '').toLowerCase().includes(q) ||
      (e.college || '').toLowerCase().includes(q) ||
      (e.batch || e.batchId || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-black text-gray-900 tracking-tight">
              Live Tournament Leaderboard
            </h2>
          </div>
          <p className="text-xs text-gray-500">
            Real-time standings computed using cumulative scores, difficulty-wise marks, and anti-cheat status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Contest Filter */}
          <select
            id="leaderboard-contest-select"
            aria-label="Filter Leaderboard by Contest"
            value={contestFilter}
            onChange={e => setContestFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2 text-gray-700"
          >
            {contests.map(c => (
              <option key={c.id} value={c.id}>{c.title || c.id}</option>
            ))}
          </select>

          {/* Batch Filter */}
          <select
            id="leaderboard-batch-select"
            aria-label="Filter Leaderboard by Batch"
            value={batchFilter}
            onChange={e => setBatchFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2 text-gray-700"
          >
            <option value="all">All Batches</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Export CSV */}
          <button
            id="leaderboard-export-csv-btn"
            onClick={exportCSV}
            className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search by participant name, student ID, or college/university..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="px-3 py-3">RANK</th>
              <th className="px-3 py-3">PARTICIPANT & COLLEGE</th>
              <th className="px-3 py-3">BATCH</th>
              <th className="px-3 py-3 text-center">EASY</th>
              <th className="px-3 py-3 text-center">MEDIUM</th>
              <th className="px-3 py-3 text-center">HARD</th>
              <th className="px-3 py-3 text-center">TOTAL</th>
              <th className="px-3 py-3 text-center">SECURITY STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 font-medium">
                  No students are assigned to this batch.
                </td>
              </tr>
            ) : (
              filtered.map((entry) => {
                const name = entry.name || entry.studentName || 'Participant';
                const studentId = entry.studentId || entry.email || 'N/A';
                const college = entry.college || 'Engineering';
                const batch = entry.batchName || (entry.batch && entry.batch !== 'undefined' ? entry.batch : '') || (entry.batchId && entry.batchId !== 'undefined' ? entry.batchId : 'Unassigned');
                const secStatus = entry.securityStatus || (entry.isDisqualified ? 'TERMINATED' : entry.securityRiskScore > 30 ? 'WARNING' : 'CLEAR');

                return (
                  <tr
                    key={entry.userId}
                    onClick={() => setSelectedEntry(entry)}
                    className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${
                      secStatus === 'TERMINATED' ? 'bg-rose-50/40 opacity-75' : ''
                    }`}
                  >
                    <td className="px-3 py-3.5 font-mono">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                          entry.rank === 1
                            ? 'bg-amber-100 text-amber-800'
                            : entry.rank === 2
                            ? 'bg-slate-200 text-slate-800'
                            : entry.rank === 3
                            ? 'bg-amber-700/20 text-amber-900'
                            : 'text-gray-500'
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>

                    <td className="px-3 py-3.5">
                      <div className="font-bold text-gray-900 flex items-center space-x-2">
                        <span>{name}</span>
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-blue-200">
                          {entry.assignedSetId || 'Set A'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500">{studentId} • {college}</p>
                    </td>

                    <td className="px-3 py-3.5 font-bold text-gray-700">
                      <span className="bg-gray-100 px-2 py-1 rounded-lg text-xs">{batch}</span>
                    </td>

                    <td className="px-3 py-3.5 text-center font-bold text-gray-700 font-mono">
                      <span className={entry.easyScore === (entry.easyMax || 10) ? 'text-emerald-600 font-extrabold' : ''}>
                        {entry.easyScore ?? 0}
                      </span> / {entry.easyMax || 10}
                    </td>

                    <td className="px-3 py-3.5 text-center font-bold text-gray-700 font-mono">
                      <span className={entry.mediumScore === (entry.mediumMax || 15) ? 'text-emerald-600 font-extrabold' : ''}>
                        {entry.mediumScore ?? 0}
                      </span> / {entry.mediumMax || 15}
                    </td>

                    <td className="px-3 py-3.5 text-center font-bold text-gray-700 font-mono">
                      <span className={entry.hardScore === (entry.hardMax || 25) ? 'text-emerald-600 font-extrabold' : ''}>
                        {entry.hardScore ?? 0}
                      </span> / {entry.hardMax || 25}
                    </td>

                    <td className="px-3 py-3.5 text-center font-black text-sm text-gray-900 font-mono">
                      <span className="text-blue-600 font-black">{entry.totalScore ?? 0}</span> / {entry.totalMax || 50}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {secStatus === 'TERMINATED' ? (
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center space-x-1">
                          <XCircle className="w-3 h-3" />
                          <span>TERMINATED</span>
                        </span>
                      ) : secStatus === 'WARNING' ? (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>WARNING</span>
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>CLEAR</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Admin Student Detail Scorecard Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 my-8">
            <button
              onClick={() => setSelectedEntry(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start space-x-3 border-b border-gray-100 pb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-black text-gray-900">
                    {selectedEntry.name || selectedEntry.studentName}
                  </h3>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                    Rank #{selectedEntry.rank}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  {selectedEntry.studentId || selectedEntry.email} • {selectedEntry.college || 'Engineering'} • Batch {selectedEntry.batch || selectedEntry.batchId || 'Alpha'}
                </p>
              </div>
            </div>

            {/* Scorecard Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Easy (10 Max)</span>
                <span className="text-lg font-black text-blue-900 font-mono">{selectedEntry.easyScore ?? 0} / 10</span>
              </div>
              <div className="bg-indigo-50/60 border border-indigo-200 p-3 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-indigo-700 uppercase block">Medium (15 Max)</span>
                <span className="text-lg font-black text-indigo-900 font-mono">{selectedEntry.mediumScore ?? 0} / 15</span>
              </div>
              <div className="bg-purple-50/60 border border-purple-200 p-3 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-purple-700 uppercase block">Hard (25 Max)</span>
                <span className="text-lg font-black text-purple-900 font-mono">{selectedEntry.hardScore ?? 0} / 25</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Total Score</span>
                <span className="text-lg font-black text-emerald-900 font-mono">{selectedEntry.totalScore ?? 0} / 50</span>
              </div>
            </div>

            {/* Test Case Breakdown per Question */}
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              <h4 className="text-xs font-black uppercase text-gray-500 tracking-wider">
                Detailed Test Case Breakdown
              </h4>

              {(!selectedEntry.problemsSolved || selectedEntry.problemsSolved.length === 0) ? (
                <div className="p-4 bg-gray-50 rounded-2xl text-center text-xs text-gray-500 font-medium">
                  No evaluation submissions recorded yet for this round.
                </div>
              ) : (
                selectedEntry.problemsSolved.map(prob => {
                  const diff = (prob.difficulty || 'MEDIUM').toUpperCase();
                  const marksPerCase = diff === 'EASY' ? 2 : diff === 'HARD' ? 5 : 3;
                  const maxMarks = diff === 'EASY' ? 10 : diff === 'HARD' ? 25 : 15;
                  const passedCases = prob.passedTests || 0;
                  const score = prob.score ?? (passedCases * marksPerCase);

                  const testResults = prob.testCaseResults && prob.testCaseResults.length > 0
                    ? prob.testCaseResults.slice(0, 5)
                    : Array.from({ length: 5 }, (_, i) => ({
                        id: `case-${i + 1}`,
                        passed: i < passedCases,
                        status: i < passedCases ? 'ACCEPTED' : 'WRONG_ANSWER'
                      }));

                  return (
                    <div key={prob.problemId} className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50/50">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <div>
                          <span className="text-xs font-bold text-gray-900 block">
                            {prob.title || prob.problemId}
                          </span>
                          <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            {diff} — {maxMarks} MARKS
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-xs font-black text-emerald-600 block">
                            Score: {score} / {maxMarks}
                          </span>
                          <span className="text-[10px] text-gray-500 font-semibold">
                            Tests Passed: {passedCases} / 5
                          </span>
                        </div>
                      </div>

                      {/* 5 Test Cases List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {testResults.map((tc: any, idx) => {
                          const isPassed = tc.status === 'ACCEPTED' || tc.passed === true;
                          const earned = isPassed ? marksPerCase : 0;

                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded-xl flex items-center justify-between border ${
                                isPassed
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                  : 'bg-rose-50/70 border-rose-200 text-rose-900'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5">
                                {isPassed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                )}
                                <span className="font-bold">Case {idx + 1}</span>
                              </div>
                              <div className="font-extrabold text-[11px]">
                                {isPassed ? `Passed — ${earned}/${marksPerCase}` : `Failed — 0/${marksPerCase}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

