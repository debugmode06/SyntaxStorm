import React, { useState } from 'react';
import { Problem, Submission } from '../types';
import {
  FileText,
  Clock,
  Cpu,
  Award,
  Copy,
  Check,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface ProblemStatementProps {
  problem: Problem;
  submissions: Submission[];
}

export const ProblemStatement: React.FC<ProblemStatementProps> = ({
  problem,
  submissions
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDifficultyBadge = (diff: Problem['difficulty']) => {
    switch (diff) {
      case 'EASY':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'HARD':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200 overflow-hidden">
      {/* Problem Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-700 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
          <FileText className="w-3.5 h-3.5" />
          <span>Problem Statement</span>
        </div>

        {/* Difficulty & Points */}
        <div className="flex items-center space-x-2">
          <span
            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${getDifficultyBadge(
              problem.difficulty
            )}`}
          >
            {problem.difficulty}
          </span>
          <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
            <Award className="w-3 h-3" />
            <span>{problem.points} pts</span>
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-gray-800">
        <>
          {/* Title & Metadata Strip */}
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight mb-2">
              {problem.title}
            </h1>
            <div className="flex items-center space-x-4 text-xs text-gray-500 font-medium">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>Time Limit: {problem.timeLimitMs}ms</span>
              </span>
              <span className="flex items-center space-x-1">
                <Cpu className="w-3.5 h-3.5 text-gray-400" />
                <span>Memory Limit: {problem.memoryLimitMb}MB</span>
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3 leading-relaxed whitespace-pre-line text-gray-700">
            {problem.description}
          </div>

          {/* Input & Output Format */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Input Format
              </h3>
              <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-800 border border-gray-200 whitespace-pre-wrap">
                {problem.inputFormat}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Output Format
              </h3>
              <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-800 border border-gray-200 whitespace-pre-wrap">
                {problem.outputFormat}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Constraints
              </h3>
              <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-800 border border-gray-200 whitespace-pre-wrap">
                {problem.constraints}
              </div>
            </div>
          </div>

          {/* Sample Test Cases */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Sample Test Cases
            </h3>
            {problem.sampleTestCases.map((tc, idx) => (
              <div
                key={tc.id}
                className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3"
              >
                <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                  <span>Sample Case {idx + 1}</span>
                  <button
                    onClick={() => copyToClipboard(tc.input, tc.id)}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-[11px] font-semibold"
                  >
                    {copiedId === tc.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Input</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Input:
                  </span>
                  <pre className="bg-white p-2.5 rounded-lg border border-gray-200 text-xs font-mono text-gray-800 overflow-x-auto">
                    {tc.input}
                  </pre>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Expected Output:
                  </span>
                  <pre className="bg-white p-2.5 rounded-lg border border-gray-200 text-xs font-mono text-gray-800 overflow-x-auto">
                    {tc.expectedOutput}
                  </pre>
                </div>

                {tc.explanation && (
                  <div className="text-xs text-gray-600 italic bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                    <span className="font-semibold not-italic">Explanation: </span>
                    {tc.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      </div>
    </div>
  );
};
