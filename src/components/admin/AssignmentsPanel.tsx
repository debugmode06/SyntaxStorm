import React, { useState, useEffect } from 'react';
import { QuestionAssignment, User } from '../../types';
import { api } from '../../api';
import { Layers, Lock, Shuffle, CheckCircle2 } from 'lucide-react';

export const AssignmentsPanel: React.FC = () => {
  const [assignments, setAssignments] = useState<(QuestionAssignment & { user: User | null })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.getAllAssignments()
      .then(res => setAssignments(res.assignments || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-6">
      <div>
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-black text-gray-900 tracking-tight">
            Question Sets & Candidate Permutations Matrix
          </h2>
        </div>
        <p className="text-xs text-gray-500">
          Each batch is divided into balanced sets (Set A, Set B, Set C) with per-candidate randomized problem orderings to prevent neighbor collusion.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Participant</th>
              <th className="px-4 py-3">Assigned Set</th>
              <th className="px-4 py-3">Problem Permutation Sequence</th>
              <th className="px-4 py-3 text-center">Lock Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium">
            {assignments.map((assign) => (
              <tr key={assign.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-4 py-3 font-bold text-gray-900">
                  {assign.user?.name || assign.userId}
                  <span className="block text-[10px] text-gray-400 font-normal">
                    {assign.user?.studentId || assign.userId}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                    {assign.setId}
                  </span>
                </td>

                <td className="px-4 py-3 font-mono text-[11px] text-gray-700">
                  {assign.problemIds.map((pid, idx) => (
                    <span key={pid} className="inline-block mr-2 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                      P{idx + 1}: {pid.replace('prob-', '')}
                    </span>
                  ))}
                </td>

                <td className="px-4 py-3 text-center">
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>LOCKED</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
