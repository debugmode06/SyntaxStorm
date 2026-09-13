import React, { useState } from 'react';
import { TestCaseResult, Submission } from '../types';
import {
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  AlertTriangle,
  Layers,
  Sparkles,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TestcaseConsoleProps {
  testCaseResults: TestCaseResult[];
  lastSubmission: Submission | null;
  isRunning: boolean;
  isSubmitting: boolean;
  executionError?: string;
  onClose?: () => void;
}

export const TestcaseConsole: React.FC<TestcaseConsoleProps> = ({
  testCaseResults,
  lastSubmission,
  isRunning,
  isSubmitting,
  executionError
}) => {
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);

  // Reset selected case to Case 1 whenever new test case results arrive
  React.useEffect(() => {
    setSelectedCaseIdx(0);
  }, [testCaseResults]);

  // Trigger celebration confetti if submission is accepted
  React.useEffect(() => {
    if (lastSubmission?.status === 'ACCEPTED') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.85 }
      });
    }
  }, [lastSubmission?.status]);

  const activeResult = testCaseResults[selectedCaseIdx];

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100 font-mono text-xs overflow-hidden border-t border-gray-800">
      {/* Console Status Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-950 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-bold text-gray-300 tracking-wide uppercase text-[11px]">
            Execution Engine Console
          </span>

          {isRunning && (
            <span className="flex items-center space-x-1 text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md text-[10px]">
              <Clock className="w-3 h-3 animate-spin" />
              <span>Running Samples...</span>
            </span>
          )}

          {isSubmitting && (
            <span className="flex items-center space-x-1 text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded-md text-[10px]">
              <Clock className="w-3 h-3 animate-spin" />
              <span>Evaluating in Worker Queue...</span>
            </span>
          )}
        </div>

        {/* Evaluation Summary Badge */}
        {lastSubmission && !isSubmitting && (
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase flex items-center space-x-1 ${
                lastSubmission.status === 'ACCEPTED'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                  : 'bg-rose-950 text-rose-300 border border-rose-700'
              }`}
            >
              {lastSubmission.status === 'ACCEPTED' ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Accepted ({lastSubmission.score}/{lastSubmission.maxScore} pts)</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 text-rose-400" />
                  <span>{lastSubmission.status} ({lastSubmission.passedTests}/{lastSubmission.totalTests} Passed)</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Main Console Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Test Case Tabs */}
        {testCaseResults.length > 0 ? (
          <div className="w-48 bg-gray-950/40 border-r border-gray-800 p-2 space-y-1 overflow-y-auto">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-2 py-1">
              Test Cases ({testCaseResults.length})
            </div>
            {testCaseResults.map((tc, idx) => (
              <button
                key={tc.testCaseId || idx}
                onClick={() => setSelectedCaseIdx(idx)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-all ${
                  selectedCaseIdx === idx
                    ? 'bg-gray-800 text-white font-bold border border-gray-700'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                }`}
              >
                <span className="flex items-center space-x-1.5 truncate">
                  {tc.status === 'ACCEPTED' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span>Case {idx + 1} {tc.isHidden && '(Hidden)'}</span>
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {tc.executionTimeMs}ms
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Right: Output & Diff Inspector */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-900/90">
          {executionError && (
            <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-3 text-rose-300 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Execution Exception:</span>
              </div>
              <pre className="text-[11px] whitespace-pre-wrap font-mono">
                {executionError}
              </pre>
            </div>
          )}

          {activeResult ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-gray-200">
                    Test Case #{selectedCaseIdx + 1}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      activeResult.status === 'ACCEPTED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {activeResult.status}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-[11px] text-gray-400">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span>{activeResult.executionTimeMs}ms</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Cpu className="w-3 h-3 text-gray-500" />
                    <span>{activeResult.memoryUsedMb}MB</span>
                  </span>
                </div>
              </div>

              {/* Side-by-side or stacked Expected vs Actual */}
              {activeResult.isHidden ? (
                <div className="bg-black/60 p-4 rounded-xl border border-gray-800 text-gray-400 text-xs font-mono">
                  <div className="flex items-center space-x-2 text-indigo-400 font-bold mb-1">
                    <Lock className="w-4 h-4" />
                    <span>Hidden Test Case</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    This is a hidden evaluation test case. Inputs and expected outputs are hidden to maintain contest integrity.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                      Actual Output:
                    </div>
                    <pre className="bg-black/60 p-3 rounded-xl border border-gray-800 text-gray-200 text-xs font-mono min-h-[70px] overflow-x-auto whitespace-pre-wrap">
                      {activeResult.actualOutput || (activeResult.error ? `Error: ${activeResult.error}` : '(No output generated)')}
                    </pre>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                      Expected Output:
                    </div>
                    <pre className="bg-black/60 p-3 rounded-xl border border-gray-800 text-emerald-400 text-xs font-mono min-h-[70px] overflow-x-auto whitespace-pre-wrap">
                      {activeResult.expectedOutput || '(Hidden specification)'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : !isRunning && !isSubmitting && !executionError ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 py-6">
              <Terminal className="w-8 h-8 text-gray-600 mb-2" />
              <p className="text-xs font-medium">
                Click "Run Code" to test against sample cases, or "Submit Solution" to dispatch to the judging queue.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
