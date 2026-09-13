import React, { useState, useEffect } from 'react';
import { Contest, Problem } from '../../types';
import { api } from '../../api';
import { convertToUTCISOString, formatInAsiaKolkata, parseLocalDateTime } from '../../utils/timezone';
import { ChallengeSelectorModal } from './ChallengeSelectorModal';
import {
  Trophy,
  Plus,
  Calendar,
  Clock,
  Building,
  CheckCircle2,
  AlertCircle,
  Copy,
  Archive,
  Edit2,
  Trash2,
  Search,
  Filter,
  X,
  Play,
  Loader2,
  Eye,
  Sparkles,
  ArrowLeft,
  Globe,
  Layers
} from 'lucide-react';

interface ContestManagementPanelProps {
  contest: Contest | null;
  onRefresh: () => void;
}

export const ContestManagementPanel: React.FC<ContestManagementPanelProps> = ({
  contest,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'PUBLISHED' | 'LIVE' | 'ENDED' | 'ARCHIVED'>('ALL');
  const [contestsList, setContestsList] = useState<any[]>([]);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [selectedContest, setSelectedContest] = useState<any | null>(null);
  const [activeSection, setActiveSection] = useState<'details' | 'challenges'>('details');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    title: '',
    startDate: '',
    startTime: '10:00',
    endDate: '',
    endTime: '13:00',
    organizationType: 'University',
    organizationName: 'National Institute of Technology',
    timezone: 'Asia/Kolkata / IST',
    batchId: ''
  });

  // Create Contest Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endDate: new Date().toISOString().split('T')[0],
    endTime: '12:00',
    organizationType: 'University',
    organizationName: 'National Institute of Technology',
    timezone: 'Asia/Kolkata / IST',
    batchId: ''
  });

  // Question Set Generator State
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [numSets, setNumSets] = useState(3);
  const [questionsPerSet, setQuestionsPerSet] = useState(3);
  const [setsData, setSetsData] = useState<{ [setId: string]: { name: string; questions: Problem[] } }>({
    'set-a': { name: 'Set A', questions: [] },
    'set-b': { name: 'Set B', questions: [] },
    'set-c': { name: 'Set C', questions: [] }
  });

  // Add Question Selector Modal
  const [addQuestionModalSetId, setAddQuestionModalSetId] = useState<string | null>(null);
  const [availableProblems, setAvailableProblems] = useState<Problem[]>([]);
  const [probSearch, setProbSearch] = useState('');
  const [probDiffFilter, setProbDiffFilter] = useState('');
  const [probCategoryFilter, setProbCategoryFilter] = useState('');

  // Publish Confirmation & Success Modal State
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishSuccessData, setPublishSuccessData] = useState<{ distributedCount: number; message: string } | null>(null);

  // Robust Date Formatters (Guarantees 'Invalid Date' never renders, uses Asia/Kolkata IST)
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'Needs Configuration';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Needs Configuration';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  };

  const formatTime = (dateStr?: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  };

  // Fetch Contests & Global Problems Library
  const loadData = async () => {
    try {
      setLoading(true);
      const [cRes, pRes, bRes] = await Promise.all([
        api.getContests(),
        api.getAdminProblems(),
        api.getBatches()
      ]);

      const loadedContests = cRes.contests || [];
      setContestsList(loadedContests);
      const loadedProblems = pRes.problems || [];
      setAvailableProblems(loadedProblems);
      setBatchesList(bRes.batches || []);

      if (selectedContest) {
        const refreshedSelected = loadedContests.find((c: any) => c.id === selectedContest.id);
        if (refreshedSelected) setSelectedContest(refreshedSelected);
        
        // Load sets for this contest
        try {
          const setsRes = await api.getContestSets(selectedContest.id);
          if (setsRes.sets && setsRes.sets.length > 0) {
            const newSetsData: { [setId: string]: { name: string; questions: Problem[] } } = {};
            setsRes.sets.forEach((s: any) => {
              newSetsData[s.id] = {
                name: s.name || s.setId || 'Unnamed Set',
                questions: (s.problemIds || []).map((pid: string) => loadedProblems.find((p: any) => p.id === pid)).filter(Boolean)
              };
            });
            setSetsData(newSetsData);
            setNumSets(setsRes.sets.length);
          } else {
            setSetsData({});
            setNumSets(0);
          }
        } catch (e) {
          console.error("Failed to load sets", e);
        }
      }
    } catch (err: any) {
      console.error('Failed to load contest data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update Edit Form when Selected Contest Changes
  useEffect(() => {
    if (selectedContest) {
      const startIso = selectedContest.startTime || selectedContest.date;
      const endIso = selectedContest.endTime || selectedContest.startTime;

      const { startDate, startTime } = formatInAsiaKolkata(startIso);
      const { startDate: endDate, startTime: endTime } = formatInAsiaKolkata(endIso);

      setEditForm({
        title: selectedContest.title || '',
        startDate,
        startTime,
        endDate,
        endTime,
        organizationType: selectedContest.organizationType || 'University',
        organizationName: selectedContest.organizationName || 'National Institute of Technology',
        timezone: selectedContest.timezone || 'Asia/Kolkata / IST',
        batchId: selectedContest.batchId || ''
      });

      if (selectedContest.questionsPerSet) {
        setQuestionsPerSet(selectedContest.questionsPerSet);
      }
      
      // Fetch sets
      api.getContestSets(selectedContest.id).then(setsRes => {
         if (setsRes.sets && setsRes.sets.length > 0) {
            const newSetsData: { [setId: string]: { name: string; questions: Problem[] } } = {};
            setsRes.sets.forEach((s: any) => {
              newSetsData[s.id] = {
                name: s.name || s.setId || 'Unnamed Set',
                questions: (s.problemIds || []).map((pid: string) => availableProblems.find((p: any) => p.id === pid)).filter(Boolean)
              };
            });
            setSetsData(newSetsData);
            setNumSets(setsRes.sets.length);
          } else {
            setSetsData({});
            setNumSets(0);
          }
      }).catch(console.error);
    }
  }, [selectedContest]);

  // Handle Create Contest Form Submission
  const handleCreateContest = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    setActionError(null);

    if (!createForm.title.trim()) {
      setActionError('Contest Name is required.');
      return;
    }

    const startDateObj = parseLocalDateTime(createForm.startDate, createForm.startTime, 'Asia/Kolkata');
    let endDateObj = parseLocalDateTime(createForm.endDate, createForm.endTime, 'Asia/Kolkata');

    if (!startDateObj || !endDateObj) {
      setActionError('Please provide valid start and end dates and times.');
      return;
    }

    if (endDateObj.getTime() <= startDateObj.getTime() && createForm.startDate === createForm.endDate) {
      const reparsedEnd = parseLocalDateTime(createForm.endDate, createForm.endTime, 'Asia/Kolkata', true);
      if (reparsedEnd && reparsedEnd.getTime() > startDateObj.getTime()) {
        endDateObj = reparsedEnd;
      }
    }

    if (endDateObj.getTime() <= startDateObj.getTime()) {
      setActionError('End date and time must be later than start date and time.');
      return;
    }

    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    try {
      setLoading(true);
      const payload = {
        title: createForm.title.trim(),
        description: `Official coding contest held by ${createForm.organizationName}.`,
        date: createForm.startDate,
        startTime: startIso,
        endTime: endIso,
        status: isDraft ? 'DRAFT' : 'DRAFT', // Creates initially as draft
        organizationType: createForm.organizationType,
        organizationName: createForm.organizationName,
        timezone: createForm.timezone,
        batchId: createForm.batchId || undefined,
        setCount: 3,
        questionsPerSet: 3
      };

      const res = await api.createContest(payload as any);
      const created = res.contest;

      setContestsList((prev) => [created, ...prev]);
      setSelectedContest(created);
      setCreateModalOpen(false);
      setActionSuccess(`Contest "${created.title}" created as Draft successfully!`);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create contest.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Update Contest Details Form Submission
  const handleUpdateContestDetails = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!selectedContest) return;
    setActionError(null);

    if (!editForm.title.trim()) {
      setActionError('Contest Name is required.');
      return;
    }

    const startDateObj = parseLocalDateTime(editForm.startDate, editForm.startTime, 'Asia/Kolkata');
    let endDateObj = parseLocalDateTime(editForm.endDate, editForm.endTime, 'Asia/Kolkata');

    if (!startDateObj || !endDateObj) {
      setActionError('Please provide valid start and end dates and times.');
      return;
    }

    if (endDateObj.getTime() <= startDateObj.getTime() && editForm.startDate === editForm.endDate) {
      const reparsedEnd = parseLocalDateTime(editForm.endDate, editForm.endTime, 'Asia/Kolkata', true);
      if (reparsedEnd && reparsedEnd.getTime() > startDateObj.getTime()) {
        endDateObj = reparsedEnd;
      }
    }

    if (endDateObj.getTime() <= startDateObj.getTime()) {
      setActionError('End date and time must be later than start date and time.');
      return;
    }

    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    try {
      setLoading(true);
      await syncSetsDataToBackend(setsData);
      
      const updates = {
        title: editForm.title.trim(),
        date: editForm.startDate,
        startTime: startIso,
        endTime: endIso,
        organizationType: editForm.organizationType,
        organizationName: editForm.organizationName,
        timezone: editForm.timezone,
        batchId: editForm.batchId || undefined,
        questionsPerSet: questionsPerSet,
        status: isDraft ? 'DRAFT' : (selectedContest.status || 'DRAFT')
      };

      const res = await api.saveContestDraft(selectedContest.id, updates as any);
      const updated = res.contest;

      setSelectedContest(updated);
      setContestsList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setActionSuccess(`Contest details saved successfully!`);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update contest.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Duplicating Contest
  const handleDuplicateContest = async (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      setActionError(null);
      const res = await api.duplicateContest(c.id);
      const duplicated = res.contest;
      setContestsList((prev) => [duplicated, ...prev]);
      setSelectedContest(duplicated);
      setActionSuccess(`Duplicated contest "${c.title}" as Draft!`);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to duplicate contest.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Deleting / Archiving Contest
  const handleDeleteContest = async (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove contest "${c.title}"?`)) return;

    try {
      setLoading(true);
      setActionError(null);
      await api.deleteContest(c.id);
      setContestsList((prev) => prev.filter((item) => item.id !== c.id));
      if (selectedContest?.id === c.id) {
        setSelectedContest(null);
      }
      setActionSuccess(`Contest removed successfully.`);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete contest.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Generating Sets
  const handleGenerateSets = async () => {
    const newSets = { ...setsData };
    const currentSetKeys = Object.keys(newSets).sort();
    
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    // If numSets is less than current sets, remove excess
    if (numSets < currentSetKeys.length) {
      const keysToRemove = currentSetKeys.slice(numSets);
      keysToRemove.forEach(k => delete newSets[k]);
    } 
    // If numSets is more, add new sets
    else if (numSets > currentSetKeys.length) {
      for (let i = currentSetKeys.length; i < numSets; i++) {
        const char = alphabet[i] || `${i + 1}`;
        const setId = `set-${char.toLowerCase()}`;
        newSets[setId] = {
          name: `Set ${char}`,
          questions: []
        };
      }
    }

    setSetsData(newSets);
    await syncSetsDataToBackend(newSets);
    setGenerateModalOpen(false);
    setActionSuccess(`Configured ${numSets} sets (${questionsPerSet} questions per set).`);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Handle Add Question to Set Validation
  const handleAddQuestionToSet = async (setId: string, problem: Problem) => {
    const setObj = setsData[setId];
    if (!setObj) return;

    const currentQuestions = setObj.questions || [];

    // 1. Check duplicate in current set
    if (currentQuestions.some((q) => q.id === problem.id)) {
      setActionError(`Problem "${problem.title}" is already in ${setObj.name}.`);
      setAddQuestionModalSetId(null);
      return;
    }

    // 2. Check max limit
    if (currentQuestions.length >= questionsPerSet) {
      setActionError(`${setObj.name} already has the maximum limit of ${questionsPerSet} questions.`);
      setAddQuestionModalSetId(null);
      return;
    }

    const updatedSet = {
      ...setObj,
      questions: [...currentQuestions, problem]
    };
    const updatedSets = {
      ...setsData,
      [setId]: updatedSet
    };

    setSetsData(updatedSets);
    await syncSetsDataToBackend(updatedSets);

    setActionSuccess(`Added "${problem.title}" to ${setObj.name}.`);
    setTimeout(() => setActionSuccess(null), 3000);
    setAddQuestionModalSetId(null);
  };

  const handleRemoveQuestionFromSet = async (setId: string, problemId: string) => {
    const setObj = setsData[setId];
    if (!setObj) return;

    const updatedSets = {
      ...setsData,
      [setId]: {
        ...setObj,
        questions: (setObj.questions || []).filter((q) => q.id !== problemId)
      }
    };

    setSetsData(updatedSets);
    await syncSetsDataToBackend(updatedSets);
  };

  // Set Validation Logic
  const isSetValid = (setId: string) => {
    const questions = setsData[setId]?.questions || [];
    return questions.length === questionsPerSet;
  };

  const isContestPublishReady = () => {
    const setKeys = Object.keys(setsData);
    if (setKeys.length === 0) return false;
    return setKeys.every((key) => isSetValid(key));
  };

  const handlePublishClick = () => {
    if (!selectedContest) return;
    if (!isContestPublishReady()) {
      setActionError(`Cannot publish contest: All question sets must contain exactly ${questionsPerSet} problems.`);
      return;
    }
    setPublishConfirmOpen(true);
  };

  const syncSetsDataToBackend = async (updatedSets: typeof setsData) => {
    if (!selectedContest) return;
    try {
      const payloadSets = Object.keys(updatedSets).map((setId) => ({
        id: setId,
        name: updatedSets[setId].name,
        problemIds: (updatedSets[setId].questions || []).map((q: any) => q.id)
      }));
      await api.saveContestSets(selectedContest.id, payloadSets as any);
      setSelectedContest((prev: any) => ({ ...prev, questionSets: payloadSets }));
    } catch (err: any) {
      console.error('Failed to sync sets:', err);
    }
  };

  const handleConfirmPublishContest = async () => {
    if (!selectedContest) return;
    setPublishConfirmOpen(false);

    try {
      setLoading(true);
      // Sync sets to backend before publishing so validation uses the latest frontend state
      await syncSetsDataToBackend(setsData);
      
      const res = await api.publishContest(selectedContest.id);
      setSelectedContest((prev: any) => ({ ...prev, status: 'PUBLISHED', isLive: true }));
      setContestsList((prev) =>
        prev.map((c) => (c.id === selectedContest.id ? { ...c, status: 'PUBLISHED', isLive: true } : c))
      );
      setPublishSuccessData({
        distributedCount: res.distributedCount || 0,
        message: res.message || `Contest "${selectedContest.title}" published successfully.`
      });
      setActionSuccess(`Contest "${selectedContest.title}" is now PUBLISHED!`);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Publishing failed.');
    } finally {
      setLoading(false);
    }
  };

  const filteredContests = contestsList.filter((c) => {
    if (activeTab === 'ALL') return true;
    return (c.status || 'DRAFT') === activeTab;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification Messages */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header & Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight">Contest Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure and manage your coding contests.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Contest</span>
        </button>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {(['ALL', 'DRAFT', 'PUBLISHED', 'LIVE', 'ENDED', 'ARCHIVED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab === 'ALL' ? 'All Contests' : tab}
          </button>
        ))}
      </div>

      {/* CLEAN EMPTY STATE IF NO CONTESTS */}
      {filteredContests.length === 0 && !loading && (
        <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center shadow-xs space-y-4 my-6">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900">No contests yet</h3>
            <p className="text-xs text-gray-500 mt-1">Create your first coding contest.</p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Contest</span>
          </button>
        </div>
      )}

      {/* Contests Grid */}
      {filteredContests.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContests.map((c) => {
            const isSelected = selectedContest?.id === c.id;
            const isDraft = (c.status || 'DRAFT') === 'DRAFT';
            const isLive = c.status === 'LIVE' || c.isLive;
            const isPublished = c.status === 'PUBLISHED';

            return (
              <div
                key={c.id}
                onClick={() => setSelectedContest(c)}
                className={`bg-white border rounded-2xl p-5 transition cursor-pointer shadow-2xs relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono font-bold text-gray-400">{c.id}</span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                        isLive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isPublished
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : isDraft
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {c.status || 'DRAFT'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm text-gray-900 mb-2 line-clamp-1">{c.title}</h3>

                  <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{formatDate(c.startTime || c.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>
                        {formatTime(c.startTime) || 'Needs Config'} - {formatTime(c.endTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <Building className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{c.organizationName || 'National Institute of Technology'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-600">
                    {c.setsCount || 3} Sets • {c.questionsCount || 9} Questions
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDuplicateContest(c, e)}
                      title="Duplicate Contest"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteContest(c, e)}
                      title="Remove / Archive Contest"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSelectedContest(c)}
                      className="flex items-center gap-1 text-[11px] text-indigo-600 font-extrabold hover:underline ml-1"
                    >
                      View <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Contest Workspace View */}
      {selectedContest && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-indigo-600 font-bold">{selectedContest.id}</span>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-gray-500 font-bold">{selectedContest.organizationName || 'NIT Academic Council'}</span>
                <span className="text-gray-300">•</span>
                <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  {selectedContest.status || 'DRAFT'}
                </span>
              </div>
              <h2 className="text-xl font-black text-gray-900">{selectedContest.title}</h2>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSection('details')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeSection === 'details'
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Contest Details
              </button>
              <button
                onClick={() => setActiveSection('challenges')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeSection === 'challenges'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                Question Sets & Challenges
              </button>
            </div>
          </div>

          {/* SUB-TAB 1: CONTEST DETAILS FORM */}
          {activeSection === 'details' && (
            <div className="space-y-6">
              <form onSubmit={(e) => handleUpdateContestDetails(e, false)} className="space-y-4 max-w-3xl">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Contest Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3.5 py-2.5"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={editForm.startTime}
                      onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3.5 py-2.5"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      End Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={editForm.endTime}
                      onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3.5 py-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Timezone
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={editForm.timezone}
                      className="w-full bg-gray-100 border border-gray-200 text-xs font-bold text-gray-600 rounded-xl px-3.5 py-2.5 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Organization Type *
                    </label>
                    <select
                      value={editForm.organizationType}
                      onChange={(e) => setEditForm({ ...editForm, organizationType: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3.5 py-2.5"
                    >
                      <option value="University">University</option>
                      <option value="College">College</option>
                      <option value="Enterprise">Enterprise</option>
                      <option value="Community">Community</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.organizationName}
                      onChange={(e) => setEditForm({ ...editForm, organizationName: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3.5 py-2.5"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Restrict to Batch (Optional)
                    </label>
                    <select
                      value={editForm.batchId || ''}
                      onChange={(e) => setEditForm({ ...editForm, batchId: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3.5 py-2.5"
                    >
                      <option value="">No restriction (All participants)</option>
                      {batchesList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleUpdateContestDetails(e, true)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Save as Draft
                  </button>
                </div>
              </form>

              {/* Contest Readiness & Publish Bar */}
              <div className="p-5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-black text-sm text-gray-900">Contest Readiness Check</h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Requires all question sets to contain exactly {questionsPerSet} problems before publishing.
                  </p>
                </div>

                <button
                  onClick={handlePublishClick}
                  disabled={!isContestPublishReady() || loading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-black shadow-xs transition shrink-0 flex items-center gap-2 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>Publish Contest</span>
                </button>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: QUESTION SETS & CHALLENGES */}
          {activeSection === 'challenges' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-gray-900">Question Sets Blueprint</h3>
                  <p className="text-xs text-gray-500">
                    Define randomized set variations assigned across candidates upon exam start.
                  </p>
                </div>

                <button
                  onClick={() => setGenerateModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>+ Create Sets</span>
                </button>
              </div>

              {/* Question Sets Display Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(setsData).map(([setId, setObj]) => {
                  const valid = isSetValid(setId);
                  const questions = setObj.questions || [];
                  const diffs = questions.map((q) => (q.difficulty || '').toUpperCase());
                  const easyCount = diffs.filter((d) => d === 'EASY').length;
                  const medCount = diffs.filter((d) => d === 'MEDIUM').length;
                  const hardCount = diffs.filter((d) => d === 'HARD').length;

                  return (
                    <div key={setId} className="bg-gray-50/70 border border-gray-200 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-200/80 pb-3">
                        <div>
                          <h4 className="font-black text-sm text-gray-900">{setObj.name}</h4>
                          <span className="text-[11px] font-semibold text-gray-500">
                            {questions.length} / {questionsPerSet} Questions
                          </span>
                        </div>

                        {valid ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Set Ready
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-md border border-amber-200">
                            Incomplete
                          </span>
                        )}
                      </div>

                      {/* Difficulty Distribution */}
                      <div className="flex items-center justify-between text-[11px] font-bold px-3 py-2 bg-white border border-gray-200 rounded-xl">
                        <span className={easyCount > 0 ? 'text-indigo-600' : 'text-gray-400'}>
                          Easy: {easyCount}
                        </span>
                        <span className={medCount > 0 ? 'text-indigo-600' : 'text-gray-400'}>
                          Medium: {medCount}
                        </span>
                        <span className={hardCount > 0 ? 'text-indigo-600' : 'text-gray-400'}>
                          Hard: {hardCount}
                        </span>
                      </div>

                      {/* Selected Problems List */}
                      <div className="space-y-2">
                        {questions.map((prob) => {
                          const normDiff = (prob.difficulty || '').toUpperCase();
                          return (
                            <div
                              key={prob.id}
                              className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between text-xs"
                            >
                              <div className="truncate max-w-[170px]">
                                <p className="font-bold text-gray-900 truncate">{prob.title}</p>
                                <span
                                  className={`text-[9px] font-extrabold uppercase ${
                                    normDiff === 'EASY'
                                      ? 'text-emerald-600'
                                      : normDiff === 'MEDIUM'
                                      ? 'text-amber-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {normDiff}
                                </span>
                              </div>

                              <button
                                onClick={() => handleRemoveQuestionFromSet(setId, prob.id)}
                                className="text-gray-400 hover:text-red-600 p-1 rounded-md cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {questions.length < questionsPerSet && (
                        <button
                          onClick={() => setAddQuestionModalSetId(setId)}
                          className="w-full py-2 bg-white hover:bg-gray-100 border border-dashed border-gray-300 text-indigo-600 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Question</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE CONTEST MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">Create New Contest</h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Contest Name *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. Apex Coding Championship 2026"
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Organization Type *
                  </label>
                  <select
                    value={createForm.organizationType}
                    onChange={(e) => setCreateForm({ ...createForm, organizationType: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2"
                  >
                    <option value="University">University</option>
                    <option value="College">College</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Community">Community</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.organizationName}
                    onChange={(e) => setCreateForm({ ...createForm, organizationName: e.target.value })}
                    placeholder="e.g. NIT Trichy"
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Restrict to Batch (Optional)
                </label>
                <select
                  value={createForm.batchId || ''}
                  onChange={(e) => setCreateForm({ ...createForm, batchId: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2"
                >
                  <option value="">No restriction (All participants)</option>
                  {batchesList.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons: Save as Draft and Create (NO Create & Publish) */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={(e) => handleCreateContest(e, true)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCreateContest(e, false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE SETS MODAL */}
      {generateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">Generate Question Sets</h3>
              <button onClick={() => setGenerateModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Number of Sets
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numSets}
                  onChange={(e) => setNumSets(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 font-bold rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Number of Questions in Each Set
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={questionsPerSet}
                  onChange={(e) => setQuestionsPerSet(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 font-bold rounded-xl px-3 py-2"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGenerateModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateSets}
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Generate Sets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD QUESTION SELECTOR MODAL (Pulls from Global Problem Library in MongoDB) */}
      {addQuestionModalSetId && (
        <ChallengeSelectorModal
          isOpen={!!addQuestionModalSetId}
          onClose={() => setAddQuestionModalSetId(null)}
          onSelect={(prob) => handleAddQuestionToSet(addQuestionModalSetId, prob)}
          availableProblems={availableProblems}
          setName={setsData[addQuestionModalSetId]?.name || 'Question Set'}
          slotIndex={setsData[addQuestionModalSetId]?.questions?.length || 0}
          allSetsProblems={Object.fromEntries(
            Object.entries(setsData).map(([sKey, sObj]) => [
              sObj.name || sKey,
              (sObj.questions || []).map((q) => q.id)
            ])
          )}
          strictDifficulty={false}
          allowCrossSetDuplicates={true}
        />
      )}

      {/* PUBLISH CONFIRMATION MODAL */}
      {publishConfirmOpen && selectedContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-base font-black text-gray-900">Publish Contest Confirmation</h3>
              </div>
              <button onClick={() => setPublishConfirmOpen(false)} className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600">
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
                <div className="font-extrabold text-sm text-indigo-900">{selectedContest.title}</div>
                <div className="text-[11px] text-indigo-700 font-medium">ID: {selectedContest.id}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-gray-400 uppercase tracking-wider text-[9px] block">Sets Ready</span>
                  <span className="text-emerald-600">{Object.keys(setsData).length} Balanced Sets</span>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-gray-400 uppercase tracking-wider text-[9px] block">Questions / Set</span>
                  <span className="text-indigo-600">{questionsPerSet} Questions Configured</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] font-medium leading-relaxed">
                <strong>Notice:</strong> Publishing will lock the question set definitions and make this contest available to eligible students upon scheduled exam time.
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPublishConfirmOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublishContest}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Confirm & Publish Live</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH SUCCESS MODAL */}
      {publishSuccessData && selectedContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-900">Contest Published Successfully!</h3>
              <p className="text-xs text-gray-500 mt-1">{publishSuccessData.message}</p>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs space-y-2 text-left font-medium">
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="font-extrabold text-emerald-600 uppercase">PUBLISHED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Question Sets:</span>
                <span className="font-bold text-gray-900">{Object.keys(setsData).length} Sets Ready</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Anti-Cheat Surveillance:</span>
                <span className="font-bold text-indigo-600">Active (3 Tab Limit)</span>
              </div>
            </div>

            <button
              onClick={() => setPublishSuccessData(null)}
              className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
