import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  Check,
  Eye,
  Layers,
  Filter,
  AlertCircle,
  AlertTriangle,
  Award,
  Clock,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { Problem, ProblemDifficulty } from '../../types';
import { ChallengePreviewModal } from './ChallengePreviewModal';

interface ChallengeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (problem: Problem) => void;
  availableProblems: Problem[];
  setName: string;
  slotIndex: number;
  requiredDifficulty?: ProblemDifficulty;
  currentAssignedId?: string;
  allSetsProblems: Record<string, string[]>; // { 'Set A': ['CH001', 'CH002'], 'Set B': [...] }
  strictDifficulty?: boolean;
  allowCrossSetDuplicates?: boolean;
}

export const ChallengeSelectorModal: React.FC<ChallengeSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  availableProblems,
  setName,
  slotIndex,
  requiredDifficulty,
  currentAssignedId,
  allSetsProblems,
  strictDifficulty = true,
  allowCrossSetDuplicates = false
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>(
    requiredDifficulty || 'ALL'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [companyTagFilter, setCompanyTagFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED'>('PUBLISHED');
  const [previewProblem, setPreviewProblem] = useState<Problem | null>(null);

  // Sync default filter when slot changes
  useEffect(() => {
    if (requiredDifficulty) {
      setDifficultyFilter(requiredDifficulty);
    } else {
      setDifficultyFilter('ALL');
    }
    setSearchTerm('');
  }, [requiredDifficulty, slotIndex, setName]);

  // Extract categories / tags
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    availableProblems.forEach(p => {
      if (p.tags) p.tags.forEach(t => set.add(t));
      if (p.concepts) p.concepts.forEach(c => set.add(c));
      if (p.category) set.add(p.category);
      if (p.sourcePlatform) set.add(p.sourcePlatform);
    });
    return Array.from(set).sort();
  }, [availableProblems]);

  // Extract company tags
  const allCompanyTags = useMemo(() => {
    const set = new Set<string>();
    availableProblems.forEach(p => {
      if (p.companyTags) p.companyTags.forEach(ct => set.add(ct));
    });
    return Array.from(set).sort();
  }, [availableProblems]);

  // Filter problems
  const filteredProblems = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    return availableProblems.filter(p => {
      // Status filter
      if (statusFilter === 'PUBLISHED' && (p.status || 'PUBLISHED') !== 'PUBLISHED') {
        return false;
      }

      // Difficulty filter
      if (difficultyFilter !== 'ALL' && p.difficulty !== difficultyFilter) {
        return false;
      }

      // Category / Concept filter
      if (categoryFilter !== 'ALL') {
        const matchesTag = p.tags?.some(t => t.toLowerCase() === categoryFilter.toLowerCase());
        const matchesConcept = p.concepts?.some(c => c.toLowerCase() === categoryFilter.toLowerCase());
        const matchesCategory = p.category?.toLowerCase() === categoryFilter.toLowerCase();
        const matchesPlatform = p.sourcePlatform?.toLowerCase() === categoryFilter.toLowerCase();
        if (!matchesTag && !matchesConcept && !matchesCategory && !matchesPlatform) return false;
      }

      // Company Tag filter
      if (companyTagFilter !== 'ALL') {
        const matchesCompany = p.companyTags?.some(ct => ct.toLowerCase() === companyTagFilter.toLowerCase());
        if (!matchesCompany) return false;
      }

      // Search query (Title, ID, slug, category tags, concepts, company tags, description)
      if (query) {
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesId = p.id.toLowerCase().includes(query);
        const matchesSlug = p.slug?.toLowerCase().includes(query);
        const matchesTag = p.tags?.some(t => t.toLowerCase().includes(query));
        const matchesConcept = p.concepts?.some(c => c.toLowerCase().includes(query));
        const matchesCompany = p.companyTags?.some(ct => ct.toLowerCase().includes(query));
        const matchesDesc = p.description?.toLowerCase().includes(query);
        return matchesTitle || matchesId || matchesSlug || matchesTag || matchesConcept || matchesCompany || matchesDesc;
      }

      return true;
    });
  }, [availableProblems, searchTerm, difficultyFilter, categoryFilter, companyTagFilter, statusFilter]);

  if (!isOpen) return null;

  // Determine usage status across sets
  const getProblemAssignmentState = (problem: Problem) => {
    const currentSetProblems = allSetsProblems[setName] || [];
    const isAssignedInThisSet = currentSetProblems.includes(problem.id) && problem.id !== currentAssignedId;

    // Check if used in other sets
    const otherSetsWithProblem: string[] = [];
    Object.entries(allSetsProblems).forEach(([otherSetName, probIds]) => {
      if (otherSetName !== setName && probIds.includes(problem.id)) {
        otherSetsWithProblem.push(otherSetName);
      }
    });

    const isDifficultyMismatch = strictDifficulty && requiredDifficulty && problem.difficulty !== requiredDifficulty;
    const isCrossSetBlocked = !allowCrossSetDuplicates && otherSetsWithProblem.length > 0;
    const isUnpublished = (problem.status || 'PUBLISHED') !== 'PUBLISHED';

    const isSelectable = !isAssignedInThisSet && (!isCrossSetBlocked || allowCrossSetDuplicates) && (!isDifficultyMismatch || !strictDifficulty) && !isUnpublished;

    return {
      isAssignedInThisSet,
      otherSetsWithProblem,
      isCrossSetBlocked,
      isDifficultyMismatch,
      isUnpublished,
      isSelectable
    };
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
          {/* Header */}
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-indigo-50/20">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white font-extrabold text-xs">
                    {setName} • Slot Q{slotIndex + 1}
                  </span>
                  {requiredDifficulty && (
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                        requiredDifficulty === 'EASY'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : requiredDifficulty === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      Requires: ● {requiredDifficulty}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-extrabold text-gray-900">Select Challenge from Problem Bank</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Search by challenge name, ID, category tags, or filter by difficulty.
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search challenges (e.g. 'Two Sum', 'CH001', 'Graph', 'Dynamic Programming')..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                  className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs placeholder-gray-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Difficulty tabs */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                  <button
                    onClick={() => setDifficultyFilter('ALL')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      difficultyFilter === 'ALL'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All Difficulties
                  </button>
                  <button
                    onClick={() => setDifficultyFilter('EASY')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      difficultyFilter === 'EASY'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                    Easy
                  </button>
                  <button
                    onClick={() => setDifficultyFilter('MEDIUM')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      difficultyFilter === 'MEDIUM'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
                    Medium
                  </button>
                  <button
                    onClick={() => setDifficultyFilter('HARD')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      difficultyFilter === 'HARD'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-300"></span>
                    Hard
                  </button>
                </div>

                {/* Category & Status Filter dropdowns */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
                    <Filter className="w-3.5 h-3.5 text-gray-500" />
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="bg-transparent font-bold text-gray-700 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Concepts / Categories</option>
                      {allCategories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
                    <span className="text-gray-500 font-medium">Company:</span>
                    <select
                      value={companyTagFilter}
                      onChange={e => setCompanyTagFilter(e.target.value)}
                      className="bg-transparent font-bold text-gray-700 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Companies</option>
                      {allCompanyTags.map(ct => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
                    <span className="text-gray-500 font-medium">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}
                      className="bg-transparent font-bold text-gray-700 focus:outline-none cursor-pointer"
                    >
                      <option value="PUBLISHED">Published Only</option>
                      <option value="ALL">All Statuses</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-gray-50/40">
            {filteredProblems.length === 0 ? (
              <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl p-8">
                <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-gray-800">No matching challenges found</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Try adjusting your search query, clearing category filters, or selecting "All Difficulties".
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setDifficultyFilter('ALL');
                    setCategoryFilter('ALL');
                  }}
                  className="mt-3 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              filteredProblems.map(prob => {
                const {
                  isAssignedInThisSet,
                  otherSetsWithProblem,
                  isCrossSetBlocked,
                  isDifficultyMismatch,
                  isUnpublished,
                  isSelectable
                } = getProblemAssignmentState(prob);

                const isCurrent = prob.id === currentAssignedId;

                return (
                  <div
                    key={prob.id}
                    className={`bg-white border rounded-2xl p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs ${
                      isCurrent
                        ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500'
                        : isSelectable
                        ? 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                        : 'border-gray-200/70 opacity-75 bg-gray-50/50'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 font-mono text-[10px] font-bold text-gray-700">
                          {prob.id}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                            prob.difficulty === 'EASY'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : prob.difficulty === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          ● {prob.difficulty}
                        </span>

                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold">
                          {prob.points || 100} pts
                        </span>

                        {prob.tags && prob.tags.length > 0 && (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">
                            {prob.tags[0]}
                          </span>
                        )}

                        {prob.companyTags && prob.companyTags.length > 0 && (
                          <div className="flex items-center gap-1">
                            {prob.companyTags.map(ct => (
                              <span key={ct} className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                {ct}
                              </span>
                            ))}
                          </div>
                        )}

                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(prob.timeLimitMs || 1000) / 1000}s
                        </span>
                      </div>

                      <h4 className="text-sm font-extrabold text-gray-900 truncate">{prob.title}</h4>

                      <p className="text-[11px] text-gray-500 line-clamp-1">
                        {prob.description?.replace(/<[^>]*>?/gm, '') || 'Algorithmic problem specification.'}
                      </p>

                      {/* Warnings / Badges */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                            Currently Assigned to this Slot
                          </span>
                        )}

                        {isAssignedInThisSet && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Already used in {setName}
                          </span>
                        )}

                        {isCrossSetBlocked && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Used in {otherSetsWithProblem.join(', ')} (Cross-Set Disabled)
                          </span>
                        )}

                        {isDifficultyMismatch && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Slot requires {requiredDifficulty}
                          </span>
                        )}

                        {isUnpublished && (
                          <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            Status: {prob.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0 sm:self-center">
                      <button
                        onClick={() => setPreviewProblem(prob)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                        title="Preview Problem Statement"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>

                      <button
                        onClick={() => {
                          if (isSelectable) {
                            onSelect(prob);
                            onClose();
                          }
                        }}
                        disabled={!isSelectable}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-indigo-600 text-white cursor-default'
                            : isSelectable
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isCurrent ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Showing <strong>{filteredProblems.length}</strong> of <strong>{availableProblems.length}</strong> problems in library
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Challenge Preview Modal */}
      {previewProblem && (
        <ChallengePreviewModal
          problem={previewProblem}
          onClose={() => setPreviewProblem(null)}
          onSelect={prob => {
            onSelect(prob);
            setPreviewProblem(null);
            onClose();
          }}
        />
      )}
    </>
  );
};
