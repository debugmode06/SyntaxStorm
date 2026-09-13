import React from 'react';
import {
  X,
  FileCode,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Award,
  BookOpen,
  Code2
} from 'lucide-react';
import { Problem } from '../../types';

interface ChallengePreviewModalProps {
  problem: Problem | null;
  onClose: () => void;
  onSelect?: (problem: Problem) => void;
}

export const ChallengePreviewModal: React.FC<ChallengePreviewModalProps> = ({
  problem,
  onClose,
  onSelect
}) => {
  if (!problem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-xs font-bold">
                {problem.id}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                  problem.difficulty === 'EASY'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : problem.difficulty === 'MEDIUM'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                ● {problem.difficulty}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-bold">
                {problem.points || 100} Points
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                {problem.status || 'PUBLISHED'}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900">{problem.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-gray-700">
          {/* Metadata badges bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Time Limit</span>
                <span className="font-bold text-gray-900">{(problem.timeLimitMs || 1000) / 1000}s</span>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Memory Limit</span>
                <span className="font-bold text-gray-900">{problem.memoryLimitMb || 256} MB</span>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Category / Tags</span>
                <span className="font-bold text-gray-900 truncate max-w-[100px] block">
                  {problem.tags?.join(', ') || 'Algorithms'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2.5">
              <Award className="w-4 h-4 text-indigo-600" />
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Sample Cases</span>
                <span className="font-bold text-gray-900">{problem.sampleTestCases?.length || 0} Testcases</span>
              </div>
            </div>
          </div>

          {/* Description / Problem Statement */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              Problem Statement
            </h4>
            <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-2xl leading-relaxed whitespace-pre-wrap font-sans text-gray-800">
              {problem.description || 'No description provided.'}
            </div>
          </div>

          {/* Input & Output Format */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 mb-1.5">
                Input Format
              </h4>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px] text-gray-800 whitespace-pre-wrap">
                {problem.inputFormat || 'Standard input format.'}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 mb-1.5">
                Output Format
              </h4>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px] text-gray-800 whitespace-pre-wrap">
                {problem.outputFormat || 'Standard output format.'}
              </div>
            </div>
          </div>

          {/* Constraints */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 mb-1.5">
              Constraints
            </h4>
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl font-mono text-[11px] text-amber-900">
              {problem.constraints || '1 <= N <= 10^5'}
            </div>
          </div>

          {/* Sample Test Cases (Public Only) */}
          {problem.sampleTestCases && problem.sampleTestCases.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                Sample Test Cases ({problem.sampleTestCases.length})
              </h4>
              {problem.sampleTestCases.map((tc, idx) => (
                <div key={tc.id || idx} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-indigo-700">Sample #{idx + 1}</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Input:</span>
                      <pre className="p-2.5 bg-white border border-gray-200 rounded-lg text-gray-800 overflow-x-auto whitespace-pre-wrap">
                        {tc.input}
                      </pre>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Expected Output:</span>
                      <pre className="p-2.5 bg-white border border-gray-200 rounded-lg text-gray-800 overflow-x-auto whitespace-pre-wrap">
                        {tc.expectedOutput}
                      </pre>
                    </div>
                  </div>
                  {tc.explanation && (
                    <div className="text-[11px] text-gray-600 bg-white/70 p-2.5 rounded-lg border border-gray-100">
                      <strong>Explanation:</strong> {tc.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Supported Languages */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 mb-1.5">
              Supported Environments
            </h4>
            <div className="flex flex-wrap gap-2">
              {(problem.languages || ['python', 'javascript', 'cpp', 'java']).map(lang => (
                <span key={lang} className="px-2.5 py-1 bg-gray-100 rounded-lg text-[11px] font-semibold text-gray-700 capitalize">
                  {lang === 'cpp' ? 'C++ 20' : lang === 'python' ? 'Python 3.11' : lang === 'javascript' ? 'JavaScript (Node 20)' : lang === 'java' ? 'Java 21' : lang}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-t border-gray-200">
          <span className="text-[11px] text-gray-500">
            Confidential contest preview. Hidden sandboxes & test cases are securely isolated.
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Close
            </button>
            {onSelect && (
              <button
                onClick={() => {
                  onSelect(problem);
                  onClose();
                }}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Select this Challenge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
