import React from 'react';
import { BookOpen, Shield, Cpu, Layers, Award, Terminal } from 'lucide-react';

export const DocumentationPanel: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-2xs space-y-8 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center space-x-2 mb-1">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            CodeArena Architecture & Operational Runbook
          </h2>
        </div>
        <p className="text-xs text-gray-500">
          Official engineering specification for contest organizers, technical juries, and systems administrators.
        </p>
      </div>

      {/* Section 1: Multi-Batch & Sandbox Isolation */}
      <section className="space-y-3">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>1. Multi-Batch & Question Permutation Engine</span>
        </h3>
        <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
          <p>
            To support simultaneous and staggered contestant cohorts, the portal partitions candidates into independent batches (Batch Alpha & Batch Beta).
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Dynamic Question Sets</strong>: Problem sets (Set A, Set B, Set C) distribute balanced problems across candidates.</li>
            <li><strong>Candidate Permutation Shuffle</strong>: Each candidate's question tab order is deterministically shuffled on assignment to prevent adjacent physical screen collusion.</li>
          </ul>
        </div>
      </section>

      {/* Section 2: 3-Switch Anti-Cheat Surveillance */}
      <section className="space-y-3">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center space-x-2">
          <Shield className="w-4 h-4 text-rose-600" />
          <span>2. 3-Switch Anti-Cheat Surveillance & Hard Lockdown</span>
        </h3>
        <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
          <p>
            The contestant arena enforces strict browser-level surveillance through event listeners:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Switch 1</strong>: Non-blocking warning modal with policy notification.</li>
            <li><strong>Switch 2</strong>: Elevated high-risk warning.</li>
            <li><strong>Switch 3</strong>: Immediate automated session termination and access revocation.</li>
            <li><strong>Administrative Overrides</strong>: Juries can review incident dossiers and approve audited unlocks with mandatory justification logs.</li>
          </ul>
        </div>
      </section>

      {/* Section 3: Asynchronous 4-Worker Judge Queue */}
      <section className="space-y-3">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-emerald-600" />
          <span>3. Asynchronous 4-Worker Judging Queue</span>
        </h3>
        <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
          <p>
            Solutions are dispatched to a non-blocking 4-worker isolate queue. Each submission undergoes sample and hidden test evaluation with CPU time limits, memory caps, and sandboxed isolate execution.
          </p>
        </div>
      </section>

      {/* Section 4: Round 1 Finalization & Championship Cutoff */}
      <section className="space-y-3">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center space-x-2">
          <Award className="w-4 h-4 text-purple-600" />
          <span>4. Automated Round 2 Qualification Pipeline</span>
        </h3>
        <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
          <p>
            When Round 1 finishes, the administrator executes the cutoff pipeline. The top 15 eligible non-disqualified candidates are promoted to Round 2 (Grand Championship) and automatically provisioned with advanced problem sets (Set D & Set E).
          </p>
        </div>
      </section>
    </div>
  );
};
