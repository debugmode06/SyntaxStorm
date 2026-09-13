import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Users,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Shuffle,
  FileCode,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowUp,
  ArrowDown,
  Sliders,
  ShieldCheck,
  Award,
  HelpCircle,
  FolderOpen,
  Save,
  CheckCheck,
  AlertCircle
} from 'lucide-react';
import { QuestionSet, Problem, ProblemDifficulty } from '../../types';
import { api } from '../../api';
import { ChallengeSelectorModal } from './ChallengeSelectorModal';
import { ChallengePreviewModal } from './ChallengePreviewModal';

interface QuestionSetsPanelProps {
  currentRoundId?: string;
  onRefreshStats?: () => void;
}

interface SetBuilderState {
  id?: string;
  name: string;
  problemIds: string[]; // ordered array of problem IDs
  isExpanded?: boolean;
}

export const QuestionSetsPanel: React.FC<QuestionSetsPanelProps> = ({
  currentRoundId = 'round-1',
  onRefreshStats
}) => {
  const [selectedRound, setSelectedRound] = useState<string>(currentRoundId);
  const [availableProblems, setAvailableProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Set Builder Configuration
  const [setCount, setSetCount] = useState<number>(3);
  const [questionsPerSet, setQuestionsPerSet] = useState<number>(3);
  const [difficultyPattern, setDifficultyPattern] = useState<ProblemDifficulty[]>([
    'EASY',
    'MEDIUM',
    'HARD'
  ]);
  const [assignmentMode, setAssignmentMode] = useState<'MANUAL' | 'RANDOMIZED'>('MANUAL');
  const [strictDifficulty, setStrictDifficulty] = useState<boolean>(true);
  const [allowCrossSetDuplicates, setAllowCrossSetDuplicates] = useState<boolean>(false);

  // Active Sets in Builder
  const [builderSets, setBuilderSets] = useState<SetBuilderState[]>([]);
  const [assignedParticipantsMap, setAssignedParticipantsMap] = useState<Record<string, number>>({});

  // Active Selector Modal state
  const [selectorState, setSelectorState] = useState<{
    isOpen: boolean;
    setIndex: number;
    setName: string;
    slotIndex: number;
    requiredDifficulty?: ProblemDifficulty;
    currentAssignedId?: string;
  } | null>(null);

  // Preview Modal state
  const [previewProblem, setPreviewProblem] = useState<Problem | null>(null);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Validation Report Modal state
  const [validationReport, setValidationReport] = useState<{
    isOpen: boolean;
    report: any;
  } | null>(null);

  // Auto-sync difficulty pattern length when questionsPerSet changes
  useEffect(() => {
    setDifficultyPattern(prev => {
      const updated = [...prev];
      if (questionsPerSet > updated.length) {
        for (let i = updated.length; i < questionsPerSet; i++) {
          // cycle easy -> medium -> hard -> easy
          updated.push(i % 3 === 0 ? 'EASY' : i % 3 === 1 ? 'MEDIUM' : 'HARD');
        }
      } else if (questionsPerSet < updated.length) {
        return updated.slice(0, questionsPerSet);
      }
      return updated;
    });
  }, [questionsPerSet]);

  // Load question sets & problems for selected round
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [setsRes, probsRes] = await Promise.all([
        api.getQuestionSets(selectedRound),
        api.getProblems(selectedRound)
      ]);

      const sets: QuestionSet[] = setsRes.sets || [];
      const probs: Problem[] = probsRes.problems || [];

      setAvailableProblems(probs);

      // Build participants map
      const pMap: Record<string, number> = {};
      sets.forEach(s => {
        pMap[s.name] = s.assignedParticipantsCount || 0;
      });
      setAssignedParticipantsMap(pMap);

      if (sets.length > 0) {
        setSetCount(sets.length);
        const maxQ = Math.max(...sets.map(s => s.problemIds.length), 3);
        setQuestionsPerSet(maxQ);

        setBuilderSets(
          sets.map(s => ({
            id: s.id,
            name: s.name,
            problemIds: [...s.problemIds],
            isExpanded: true
          }))
        );
      } else {
        // Initialize default empty sets
        initializeDefaultSets(3, 3);
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to load question sets' });
    } finally {
      setLoading(false);
    }
  }, [selectedRound]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const initializeDefaultSets = (count: number, qCount: number) => {
    const newSets: SetBuilderState[] = [];
    for (let i = 0; i < count; i++) {
      const char = String.fromCharCode(65 + i);
      newSets.push({
        id: `set-${selectedRound}-${char.toLowerCase()}`,
        name: `Set ${char}`,
        problemIds: [],
        isExpanded: true
      });
    }
    setBuilderSets(newSets);
  };

  // Map of problems assigned per set name for duplicate checks
  const allSetsProblemsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    builderSets.forEach(s => {
      map[s.name] = s.problemIds;
    });
    return map;
  }, [builderSets]);

  // Unique problems across all sets
  const totalUniqueChallenges = useMemo(() => {
    const set = new Set<string>();
    builderSets.forEach(s => {
      s.problemIds.forEach(id => set.add(id));
    });
    return set.size;
  }, [builderSets]);

  // Total assignments count across all sets
  const totalAssignmentsCount = useMemo(() => {
    return builderSets.reduce((acc, s) => acc + s.problemIds.length, 0);
  }, [builderSets]);

  const getProblemById = (id: string): Problem | undefined => {
    return availableProblems.find(p => p.id === id);
  };

  // Auto-Save sets to backend
  const handleSaveSets = async (showNotification = true) => {
    setSaveStatus('saving');
    try {
      const payload = builderSets.map(s => ({
        id: s.id,
        name: s.name,
        problemIds: s.problemIds
      }));

      await api.saveAllQuestionSets(selectedRound, payload);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);

      if (showNotification) {
        setNotification({ type: 'success', message: 'Question sets successfully saved to contest database!' });
      }
      onRefreshStats?.();
    } catch (e: any) {
      setSaveStatus('idle');
      setNotification({ type: 'error', message: e.message || 'Failed to save question sets' });
    }
  };

  // Re-configure / Generate Sets button
  const handleGenerateSetsClick = () => {
    const hasAssignments = builderSets.some(s => s.problemIds.length > 0);

    const proceed = () => {
      if (assignmentMode === 'RANDOMIZED') {
        handleRandomizeSets();
      } else {
        const newSets: SetBuilderState[] = [];
        for (let i = 0; i < setCount; i++) {
          const char = String.fromCharCode(65 + i);
          const existing = builderSets[i];
          newSets.push({
            id: existing?.id || `set-${selectedRound}-${char.toLowerCase()}`,
            name: existing?.name || `Set ${char}`,
            problemIds: existing ? existing.problemIds.slice(0, questionsPerSet) : [],
            isExpanded: true
          });
        }
        setBuilderSets(newSets);
        setNotification({
          type: 'success',
          message: `Configured ${newSets.length} sets with ${questionsPerSet} question slots each.`
        });
      }
    };

    if (hasAssignments) {
      setConfirmModal({
        title: 'Re-generate Question Sets?',
        message:
          'Modifying set structure will preserve existing slots up to the new count. Are you sure you want to proceed?',
        confirmLabel: 'Re-generate Sets',
        onConfirm: proceed
      });
    } else {
      proceed();
    }
  };

  // Randomized Assignment from Pool
  const handleRandomizeSets = async () => {
    const publishedProblems = availableProblems.filter(p => (p.status || 'PUBLISHED') === 'PUBLISHED');
    if (publishedProblems.length === 0) {
      setNotification({
        type: 'error',
        message: 'No published challenges available in problem bank. Please create challenges first.'
      });
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.randomizeQuestionSets({
        roundId: selectedRound,
        setCount,
        questionsPerSet,
        difficultyPattern,
        allowCrossSetDuplicates
      });

      const randomizedSets = (res.sets || []).map(s => ({
        id: s.id,
        name: s.name,
        problemIds: [...s.problemIds],
        isExpanded: true
      }));

      setBuilderSets(randomizedSets);
      setNotification({
        type: 'success',
        message: `Randomized ${randomizedSets.length} sets with ${questionsPerSet} questions matching difficulty distribution!`
      });
      onRefreshStats?.();
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to randomize question sets' });
    } finally {
      setActionLoading(false);
    }
  };

  // Validation Check
  const handleValidateConfiguration = async () => {
    setActionLoading(true);
    try {
      const res = await api.validateQuestionSetsConfig({
        roundId: selectedRound,
        setCount: builderSets.length,
        questionsPerSet,
        difficultyPattern,
        allowCrossSetDuplicates
      });

      setValidationReport({
        isOpen: true,
        report: res.report
      });
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Validation request failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Distribute Sets to Roster
  const handleDistributeToRoster = async () => {
    if (builderSets.length === 0 || builderSets.every(s => s.problemIds.length === 0)) {
      setNotification({
        type: 'error',
        message: 'Please assign questions to the sets before distributing to participants.'
      });
      return;
    }

    // Save first to ensure backend has latest mappings
    await handleSaveSets(false);

    setActionLoading(true);
    try {
      const res = await api.distributeQuestionSets(selectedRound);
      setNotification({
        type: 'success',
        message: res.message || 'Question sets successfully distributed to participant roster!'
      });
      loadData();
      onRefreshStats?.();
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to distribute question sets' });
    } finally {
      setActionLoading(false);
    }
  };

  // Assign problem to specific slot in a set
  const handleAssignProblemToSlot = (setIdx: number, slotIdx: number, problem: Problem) => {
    setBuilderSets(prev => {
      const updated = [...prev];
      const targetSet = { ...updated[setIdx] };
      const newProblemIds = [...targetSet.problemIds];

      // Expand array if needed
      while (newProblemIds.length < slotIdx) {
        newProblemIds.push('');
      }

      newProblemIds[slotIdx] = problem.id;
      // Filter out any trailing empty slots if not needed, but keep length up to slotIdx + 1
      targetSet.problemIds = newProblemIds.filter(Boolean);

      updated[setIdx] = targetSet;
      return updated;
    });

    setNotification({
      type: 'success',
      message: `Assigned "${problem.title}" to ${builderSets[setIdx]?.name} (Slot Q${slotIdx + 1}).`
    });
  };

  // Remove problem from set
  const handleRemoveProblemFromSlot = (setIdx: number, slotIdx: number) => {
    const setName = builderSets[setIdx]?.name;
    const probId = builderSets[setIdx]?.problemIds[slotIdx];
    const prob = probId ? getProblemById(probId) : null;
    const title = prob ? `"${prob.title}"` : 'this question';

    setConfirmModal({
      title: `Remove Question from ${setName}?`,
      message: `Are you sure you want to remove ${title} from Slot Q${slotIdx + 1}?`,
      confirmLabel: 'Remove Question',
      isDestructive: true,
      onConfirm: () => {
        setBuilderSets(prev => {
          const updated = [...prev];
          const targetSet = { ...updated[setIdx] };
          targetSet.problemIds = targetSet.problemIds.filter((_, idx) => idx !== slotIdx);
          updated[setIdx] = targetSet;
          return updated;
        });
      }
    });
  };

  // Move Question Up/Down inside a set
  const handleMoveQuestion = (setIdx: number, slotIdx: number, direction: 'UP' | 'DOWN') => {
    setBuilderSets(prev => {
      const updated = [...prev];
      const targetSet = { ...updated[setIdx] };
      const ids = [...targetSet.problemIds];

      const targetSlot = direction === 'UP' ? slotIdx - 1 : slotIdx + 1;
      if (targetSlot < 0 || targetSlot >= ids.length) return prev;

      const temp = ids[slotIdx];
      ids[slotIdx] = ids[targetSlot];
      ids[targetSlot] = temp;

      targetSet.problemIds = ids;
      updated[setIdx] = targetSet;
      return updated;
    });
  };

  // Duplicate Set
  const handleDuplicateSet = (setIdx: number) => {
    const sourceSet = builderSets[setIdx];
    const newChar = String.fromCharCode(65 + builderSets.length);
    const newName = `Set ${newChar} (Copy of ${sourceSet.name})`;

    setBuilderSets(prev => [
      ...prev,
      {
        id: `set-${selectedRound}-${newChar.toLowerCase()}-${Date.now()}`,
        name: newName,
        problemIds: [...sourceSet.problemIds],
        isExpanded: true
      }
    ]);
    setSetCount(prev => prev + 1);

    setNotification({
      type: 'success',
      message: `Duplicated ${sourceSet.name} as ${newName}.`
    });
  };

  // Clear Set
  const handleClearSet = (setIdx: number) => {
    const setName = builderSets[setIdx]?.name;
    setConfirmModal({
      title: `Clear all questions from ${setName}?`,
      message: `This will remove all assigned questions from ${setName}. The set itself will remain empty.`,
      confirmLabel: 'Clear Set',
      isDestructive: true,
      onConfirm: () => {
        setBuilderSets(prev => {
          const updated = [...prev];
          updated[setIdx] = { ...updated[setIdx], problemIds: [] };
          return updated;
        });
      }
    });
  };

  // Delete Set
  const handleDeleteSet = (setIdx: number) => {
    const setName = builderSets[setIdx]?.name;
    setConfirmModal({
      title: `Delete ${setName}?`,
      message: `Are you sure you want to delete ${setName}? This action cannot be undone.`,
      confirmLabel: 'Delete Set',
      isDestructive: true,
      onConfirm: () => {
        setBuilderSets(prev => prev.filter((_, idx) => idx !== setIdx));
        setSetCount(prev => Math.max(1, prev - 1));
      }
    });
  };

  // Rename Set
  const handleRenameSet = (setIdx: number, newName: string) => {
    setBuilderSets(prev => {
      const updated = [...prev];
      updated[setIdx] = { ...updated[setIdx], name: newName };
      return updated;
    });
  };

  // Toggle Set expand/collapse
  const toggleSetExpanded = (setIdx: number) => {
    setBuilderSets(prev => {
      const updated = [...prev];
      updated[setIdx] = { ...updated[setIdx], isExpanded: !updated[setIdx].isExpanded };
      return updated;
    });
  };

  // Expand or Collapse All
  const setAllExpanded = (expanded: boolean) => {
    setBuilderSets(prev => prev.map(s => ({ ...s, isExpanded: expanded })));
  };

  // Set difficulty for a specific pattern slot
  const handleSlotDifficultyChange = (slotIdx: number, diff: ProblemDifficulty) => {
    setDifficultyPattern(prev => {
      const updated = [...prev];
      updated[slotIdx] = diff;
      return updated;
    });
  };

  return (
    <div className="space-y-6" id="question-sets-builder-panel">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Challenge Set Builder & Problem Allocations</h2>
          </div>
          <p className="text-xs text-gray-500 max-w-2xl">
            Design multi-set challenge distributions (e.g. Set A, Set B, Set C) with configurable difficulty rules, cross-set duplicate prevention, and automated candidate assignment.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Save Sets Action */}
          <button
            onClick={() => handleSaveSets(true)}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {saveStatus === 'saving' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-300" />
            ) : saveStatus === 'saved' ? (
              <CheckCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Draft'}
          </button>

          {/* Validate Button */}
          <button
            onClick={handleValidateConfiguration}
            disabled={actionLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Validate Sets
          </button>

          {/* Distribute to Roster */}
          <button
            onClick={handleDistributeToRoster}
            disabled={actionLoading || builderSets.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Distribute sets evenly across participant batches"
          >
            <Shuffle className="w-4 h-4" />
            Distribute to Roster
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`flex items-center justify-between p-4 rounded-2xl border animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : notification.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs font-bold">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Challenge Configuration / Builder Control Panel */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
          <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            Set Generator & Difficulty Distribution Rules
          </h3>
          <span className="text-[11px] font-semibold text-gray-500">
            Problem Bank: <strong>{availableProblems.length}</strong> available challenges
          </span>
        </div>

        {/* Grid of generator parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Number of Sets */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 block">
              Number of Sets
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="10"
                value={setCount}
                onChange={e => setSetCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSetCount(num)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      setCount === num
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-gray-400">Creates Set A, Set B, Set C...</span>
          </div>

          {/* Questions per Set */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 block">
              Questions per Set
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="10"
                value={questionsPerSet}
                onChange={e => setQuestionsPerSet(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-1">
                {[2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuestionsPerSet(num)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      questionsPerSet === num
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-gray-400">Number of slots inside each set</span>
          </div>

          {/* Assignment Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 block">
              Assignment Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAssignmentMode('MANUAL')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                  assignmentMode === 'MANUAL'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-xs'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Manual Slot
              </button>
              <button
                type="button"
                onClick={() => setAssignmentMode('RANDOMIZED')}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                  assignmentMode === 'RANDOMIZED'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-xs'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Randomized Pool
              </button>
            </div>
            <span className="text-[10px] text-gray-400">
              {assignmentMode === 'MANUAL' ? 'Pick challenges per slot' : 'Auto-distribute from library'}
            </span>
          </div>

          {/* Action Trigger Button */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <button
              onClick={handleGenerateSetsClick}
              disabled={actionLoading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {assignmentMode === 'RANDOMIZED' ? 'Randomize Sets' : 'Generate / Update Slots'}
            </button>
            <span className="text-[10px] text-center text-gray-400">
              Applies structure to active builder sets
            </span>
          </div>
        </div>

        {/* Difficulty Pattern Slots Bar */}
        <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs font-extrabold text-gray-800 block">
                Slot Difficulty Blueprint (Applies to all sets)
              </span>
              <span className="text-[10px] text-gray-500">
                Click a slot badge to change its required difficulty.
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] font-semibold text-gray-500">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setQuestionsPerSet(3);
                  setDifficultyPattern(['EASY', 'MEDIUM', 'HARD']);
                }}
                className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Standard (E / M / H)
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuestionsPerSet(4);
                  setDifficultyPattern(['EASY', 'MEDIUM', 'HARD', 'EASY']);
                }}
                className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                4 Questions (E / M / H / E)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDifficultyPattern(prev => prev.map(() => 'MEDIUM'));
                }}
                className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                All Medium
              </button>
            </div>
          </div>

          {/* Interactive slot pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {difficultyPattern.map((diff, slotIdx) => (
              <div
                key={slotIdx}
                className="flex items-center bg-white border border-gray-200 rounded-xl p-1.5 shadow-2xs gap-2"
              >
                <span className="text-[11px] font-black text-gray-500 pl-1">
                  Q{slotIdx + 1}
                </span>
                <div className="flex gap-1">
                  {(['EASY', 'MEDIUM', 'HARD'] as ProblemDifficulty[]).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleSlotDifficultyChange(slotIdx, d)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                        diff === d
                          ? d === 'EASY'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : d === 'MEDIUM'
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-rose-600 text-white shadow-2xs'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Rules & Duplicate toggles */}
          <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-gray-200 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={strictDifficulty}
                onChange={e => setStrictDifficulty(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-bold text-gray-800">
                Strict Difficulty Enforcement (Warn if problem difficulty does not match slot)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowCrossSetDuplicates}
                onChange={e => setAllowCrossSetDuplicates(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-bold text-gray-800">
                Allow Cross-Set Duplicates (Same challenge can appear in Set A and Set B)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Contest-Level Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block">Total Sets</span>
          <h4 className="text-xl font-black text-gray-900 mt-1">{builderSets.length} Sets</h4>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block">Questions / Set</span>
          <h4 className="text-xl font-black text-gray-900 mt-1">{questionsPerSet} Questions</h4>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block">Total Assignments</span>
          <h4 className="text-xl font-black text-indigo-600 mt-1">
            {totalAssignmentsCount} / {builderSets.length * questionsPerSet} Slots
          </h4>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block">Unique Challenges</span>
          <h4 className="text-xl font-black text-gray-900 mt-1">{totalUniqueChallenges} Challenges</h4>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block">Roster Distribution</span>
          <h4 className="text-xl font-black text-emerald-600 mt-1">
            {Object.values(assignedParticipantsMap).reduce((a, b) => a + b, 0)} Students
          </h4>
        </div>
      </div>

      {/* Set Controls (Expand / Collapse all, Add Set) */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAllExpanded(true)}
            className="px-3 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-lg transition cursor-pointer"
          >
            Expand All
          </button>
          <button
            onClick={() => setAllExpanded(false)}
            className="px-3 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-lg transition cursor-pointer"
          >
            Collapse All
          </button>
        </div>

        <button
          onClick={() => {
            const char = String.fromCharCode(65 + builderSets.length);
            setBuilderSets(prev => [
              ...prev,
              {
                id: `set-${selectedRound}-${char.toLowerCase()}-${Date.now()}`,
                name: `Set ${char}`,
                problemIds: [],
                isExpanded: true
              }
            ]);
            setSetCount(prev => prev + 1);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Another Set
        </button>
      </div>

      {/* Sets List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-xs font-semibold">Loading challenge sets...</span>
        </div>
      ) : builderSets.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-12 text-center shadow-xs">
          <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900">No Question Sets Configured</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Configure sets (e.g. Set A, Set B, Set C) using the controls above to start assigning problems.
          </p>
          <button
            onClick={() => initializeDefaultSets(3, 3)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Initialize 3 Default Sets
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {builderSets.map((set, setIdx) => {
            const assignedCount = set.problemIds.length;
            const isComplete = assignedCount >= questionsPerSet;

            // Calculate difficulty counts & marks
            let easyCount = 0;
            let medCount = 0;
            let hardCount = 0;
            let totalMarks = 0;

            set.problemIds.forEach(pid => {
              const prob = getProblemById(pid);
              if (prob) {
                if (prob.difficulty === 'EASY') easyCount++;
                else if (prob.difficulty === 'MEDIUM') medCount++;
                else if (prob.difficulty === 'HARD') hardCount++;
                totalMarks += prob.points || 100;
              }
            });

            const participantCount = assignedParticipantsMap[set.name] || 0;

            return (
              <div
                key={set.id || setIdx}
                className={`bg-white border rounded-3xl overflow-hidden transition-all shadow-xs ${
                  isComplete ? 'border-gray-200' : 'border-amber-200'
                }`}
              >
                {/* Set Header */}
                <div className="p-5 bg-gradient-to-r from-gray-50/80 to-indigo-50/20 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                      {set.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'S'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={set.name}
                          onChange={e => handleRenameSet(setIdx, e.target.value)}
                          className="text-base font-extrabold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 rounded"
                        />
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                            isComplete
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {isComplete ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-700" />
                              READY ({assignedCount}/{questionsPerSet})
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              INCOMPLETE ({assignedCount}/{questionsPerSet})
                            </>
                          )}
                        </span>
                      </div>

                      {/* Difficulty breakdown & Total marks badges */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 text-[11px]">
                          Easy: {easyCount}
                        </span>
                        <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 text-[11px]">
                          Medium: {medCount}
                        </span>
                        <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 text-[11px]">
                          Hard: {hardCount}
                        </span>
                        <span className="font-bold text-gray-700">
                          Total Marks: <strong>{totalMarks} pts</strong>
                        </span>
                        <span className="text-gray-400 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {participantCount} Students Allocated
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Set Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDuplicateSet(setIdx)}
                      className="p-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Duplicate Set"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="hidden sm:inline">Duplicate</span>
                    </button>

                    <button
                      onClick={() => handleClearSet(setIdx)}
                      className="p-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 transition text-xs font-bold cursor-pointer shadow-2xs"
                      title="Clear Questions from Set"
                    >
                      Clear
                    </button>

                    <button
                      onClick={() => handleDeleteSet(setIdx)}
                      className="p-2 bg-white hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl border border-gray-200 transition cursor-pointer shadow-2xs"
                      title="Delete Set"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => toggleSetExpanded(setIdx)}
                      className="p-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 transition cursor-pointer shadow-2xs"
                      title={set.isExpanded ? 'Collapse Set' : 'Expand Set'}
                    >
                      {set.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Set Body: Ordered Question Slots */}
                {set.isExpanded && (
                  <div className="p-6 space-y-4 bg-gray-50/30">
                    <div className="grid grid-cols-1 gap-3">
                      {Array.from({ length: questionsPerSet }).map((_, slotIdx) => {
                        const probId = set.problemIds[slotIdx];
                        const prob = probId ? getProblemById(probId) : null;
                        const reqDiff = difficultyPattern[slotIdx] || 'MEDIUM';

                        const isMismatch = prob && strictDifficulty && prob.difficulty !== reqDiff;

                        return (
                          <div
                            key={slotIdx}
                            className={`bg-white border rounded-2xl p-4 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs ${
                              prob
                                ? 'border-gray-200'
                                : 'border-dashed border-gray-300 bg-gray-50/50 hover:bg-indigo-50/20 hover:border-indigo-300'
                            }`}
                          >
                            {/* Slot Indicator & Problem Info */}
                            <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
                              {/* Slot Tag */}
                              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 shrink-0">
                                <span className="text-[10px] font-black text-gray-500 uppercase">SLOT</span>
                                <span className="text-sm font-black text-gray-900">Q{slotIdx + 1}</span>
                              </div>

                              {prob ? (
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-md font-mono text-[10px] font-bold text-gray-700">
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

                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[10px] font-bold">
                                      {prob.points || 100} pts
                                    </span>

                                    {prob.tags && prob.tags.length > 0 && (
                                      <span className="text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                        {prob.tags[0]}
                                      </span>
                                    )}

                                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-bold">
                                      {prob.status || 'PUBLISHED'}
                                    </span>

                                    {isMismatch && (
                                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Slot expects {reqDiff}
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="text-sm font-black text-gray-900 truncate">{prob.title}</h4>
                                  <p className="text-[11px] text-gray-500 line-clamp-1">
                                    {prob.description?.replace(/<[^>]*>?/gm, '') || 'Problem statement.'}
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        reqDiff === 'EASY'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : reqDiff === 'MEDIUM'
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                                      }`}
                                    >
                                      Required: ● {reqDiff}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-400">Empty Slot</span>
                                  </div>
                                  <p className="text-[11px] text-gray-400">
                                    No challenge selected for this slot.
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Slot Actions */}
                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                              {prob ? (
                                <>
                                  {/* Reorder Up/Down */}
                                  <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
                                    <button
                                      onClick={() => handleMoveQuestion(setIdx, slotIdx, 'UP')}
                                      disabled={slotIdx === 0}
                                      className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveQuestion(setIdx, slotIdx, 'DOWN')}
                                      disabled={slotIdx === set.problemIds.length - 1}
                                      className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {/* Preview */}
                                  <button
                                    onClick={() => setPreviewProblem(prob)}
                                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    title="Preview Challenge Statement"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Preview</span>
                                  </button>

                                  {/* Change Question */}
                                  <button
                                    onClick={() =>
                                      setSelectorState({
                                        isOpen: true,
                                        setIndex: setIdx,
                                        setName: set.name,
                                        slotIndex: slotIdx,
                                        requiredDifficulty: reqDiff,
                                        currentAssignedId: prob.id
                                      })
                                    }
                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition text-xs font-bold border border-indigo-200 cursor-pointer"
                                  >
                                    Change
                                  </button>

                                  {/* Remove */}
                                  <button
                                    onClick={() => handleRemoveProblemFromSlot(setIdx, slotIdx)}
                                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                                    title="Remove Question"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() =>
                                    setSelectorState({
                                      isOpen: true,
                                      setIndex: setIdx,
                                      setName: set.name,
                                      slotIndex: slotIdx,
                                      requiredDifficulty: reqDiff
                                    })
                                  }
                                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                                >
                                  <Plus className="w-4 h-4" />
                                  Select Challenge...
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Challenge Selector Modal */}
      {selectorState && (
        <ChallengeSelectorModal
          isOpen={selectorState.isOpen}
          onClose={() => setSelectorState(null)}
          onSelect={problem => {
            handleAssignProblemToSlot(selectorState.setIndex, selectorState.slotIndex, problem);
          }}
          availableProblems={availableProblems}
          setName={selectorState.setName}
          slotIndex={selectorState.slotIndex}
          requiredDifficulty={selectorState.requiredDifficulty}
          currentAssignedId={selectorState.currentAssignedId}
          allSetsProblems={allSetsProblemsMap}
          strictDifficulty={strictDifficulty}
          allowCrossSetDuplicates={allowCrossSetDuplicates}
        />
      )}

      {/* Challenge Preview Modal */}
      {previewProblem && (
        <ChallengePreviewModal
          problem={previewProblem}
          onClose={() => setPreviewProblem(null)}
        />
      )}

      {/* Generic Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-gray-900">
              <div
                className={`p-3 rounded-2xl ${
                  confirmModal.isDestructive ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                {confirmModal.isDestructive ? <AlertTriangle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <h3 className="text-base font-extrabold">{confirmModal.title}</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">{confirmModal.message}</p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer shadow-xs text-white ${
                  confirmModal.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Report Modal */}
      {validationReport?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck
                  className={`w-6 h-6 ${
                    validationReport.report?.isValid ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                />
                <div>
                  <h3 className="text-lg font-black text-gray-900">Set Builder Validation Report</h3>
                  <span className="text-xs text-gray-500">
                    Contest validation check before locking or publishing
                  </span>
                </div>
              </div>

              <button
                onClick={() => setValidationReport(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Overall status banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center gap-3 ${
                  validationReport.report?.isValid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {validationReport.report?.isValid ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
                )}
                <div>
                  <h4 className="text-sm font-extrabold">
                    {validationReport.report?.isValid
                      ? 'All Question Sets are Complete & Validated!'
                      : 'Validation Issues Detected'}
                  </h4>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    {validationReport.report?.isValid
                      ? 'Every set meets difficulty constraints, question counts, and published problem requirements.'
                      : 'Please review and address the checklist items below before locking or launching the contest.'}
                  </p>
                </div>
              </div>

              {/* Errors list */}
              {validationReport.report?.errors?.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-extrabold text-rose-900 uppercase text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Errors ({validationReport.report.errors.length})
                  </h5>
                  <ul className="space-y-1.5 pl-2">
                    {validationReport.report.errors.map((err: string, idx: number) => (
                      <li key={idx} className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 text-rose-800">
                        • {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings list */}
              {validationReport.report?.warnings?.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-extrabold text-amber-900 uppercase text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Warnings ({validationReport.report.warnings.length})
                  </h5>
                  <ul className="space-y-1.5 pl-2">
                    {validationReport.report.warnings.map((warn: string, idx: number) => (
                      <li key={idx} className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100 text-amber-800">
                        • {warn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Set-by-Set Reports */}
              {validationReport.report?.setReports && (
                <div className="space-y-2 pt-2">
                  <h5 className="font-extrabold text-gray-900 uppercase text-[11px]">
                    Individual Set Status
                  </h5>
                  <div className="space-y-2">
                    {validationReport.report.setReports.map((sr: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          sr.isReady
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-amber-50/50 border-amber-200'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-gray-900">{sr.name}</span>
                          <span className="text-gray-500 ml-2">
                            ({sr.questionCount}/{sr.expectedCount} questions • {sr.totalMarks} pts)
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            sr.isReady
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sr.isReady ? '✓ Ready' : 'Incomplete'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setValidationReport(null)}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
