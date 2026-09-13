import React, { useState, useEffect, useRef } from 'react';
import {
  Code,
  Plus,
  Trash2,
  Edit3,
  Upload,
  Download,
  FileArchive,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  RefreshCw,
  Search,
  Check,
  X,
  Clock,
  HardDrive,
  Copy,
  Tag,
  Building2,
  LayoutGrid,
  List,
  Sparkles,
  ShieldAlert,
  Info,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Problem, TestCase, ProblemDifficulty } from '../../types';
import { api } from '../../api';
import {
  parseTestCasesFromZip,
  parseBulkProblemsZip,
  generateSampleTestCaseZip,
  ParsedZipResult,
  BulkZipImportResult
} from '../../utils/zipParser';

interface ProblemManagerPanelProps {
  onRefreshStats?: () => void;
}

export const ProblemManagerPanel: React.FC<ProblemManagerPanelProps> = ({
  onRefreshStats
}) => {
  // Primary State
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // View Mode: 'card' or 'list'
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');
  const [selectedConcept, setSelectedConcept] = useState<string>('ALL');
  const [selectedCompanyTag, setSelectedCompanyTag] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals & Active Problem
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [activeTabInEditor, setActiveTabInEditor] = useState<'basic' | 'statement' | 'testcases' | 'starter'>('basic');
  const [previewProblem, setPreviewProblem] = useState<Problem | null>(null);

  // Bulk ZIP Import State
  const [bulkZipModalOpen, setBulkZipModalOpen] = useState<boolean>(false);
  const [bulkZipParsing, setBulkZipParsing] = useState<boolean>(false);
  const [bulkZipResult, setBulkZipResult] = useState<BulkZipImportResult | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Single Test Cases ZIP Import State (Inside Problem Editor)
  const [testCaseZipModalOpen, setTestCaseZipModalOpen] = useState<boolean>(false);
  const [testCaseZipParsing, setTestCaseZipParsing] = useState<boolean>(false);
  const [testCaseZipResult, setTestCaseZipResult] = useState<ParsedZipResult | null>(null);
  const testCaseFileInputRef = useRef<HTMLInputElement>(null);

  // Load all global problems
  const loadProblems = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminProblems();
      setProblems(data.problems || []);
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to load problems from library.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProblems();
  }, []);

  // Filtered problems computation
  const filteredProblems = problems.filter((p) => {
    // Search query check across Title, Slug, ID, Description, Category, Concepts, CompanyTags
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchSlug = p.slug.toLowerCase().includes(q);
      const matchId = p.id.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q) || p.problemStatement?.toLowerCase().includes(q);
      const matchCategory = p.category?.toLowerCase().includes(q);
      const matchConcepts = p.concepts?.some((c) => c.toLowerCase().includes(q)) || p.tags?.some((t) => t.toLowerCase().includes(q));
      const matchCompany = p.companyTags?.some((ct) => ct.toLowerCase().includes(q));
      if (!matchTitle && !matchSlug && !matchId && !matchDesc && !matchCategory && !matchConcepts && !matchCompany) {
        return false;
      }
    }

    // Difficulty filter
    if (selectedDifficulty !== 'ALL' && p.difficulty.toUpperCase() !== selectedDifficulty) {
      return false;
    }

    // Concept filter
    if (selectedConcept !== 'ALL') {
      const matchConcept = p.concepts?.some((c) => c.toLowerCase() === selectedConcept.toLowerCase()) ||
        p.tags?.some((t) => t.toLowerCase() === selectedConcept.toLowerCase());
      if (!matchConcept) return false;
    }

    // Company Tag filter
    if (selectedCompanyTag !== 'ALL') {
      const matchCompany = p.companyTags?.some((ct) => ct.toLowerCase() === selectedCompanyTag.toLowerCase());
      if (!matchCompany) return false;
    }

    // Category filter
    if (selectedCategory !== 'ALL' && p.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }

    // Status filter
    if (selectedStatus !== 'ALL' && (p.status || 'PUBLISHED') !== selectedStatus) {
      return false;
    }

    return true;
  });

  // Unique facet options derived from available problems
  const availableConcepts = Array.from(
    new Set([
      'Array',
      'String',
      'Linked List',
      'Stack',
      'Queue',
      'Tree',
      'Graph',
      'Dynamic Programming',
      'Greedy',
      'Hashing',
      'Sorting',
      'Searching',
      'Math',
      'Recursion',
      'Two Pointers',
      'Sliding Window',
      ...problems.flatMap((p) => p.concepts || p.tags || [])
    ])
  ).sort();

  const availableCompanyTags = Array.from(
    new Set([
      'Google',
      'Microsoft',
      'Amazon',
      'Meta',
      'Apple',
      'TCS',
      'Infosys',
      'Accenture',
      'Uber',
      'Netflix',
      ...problems.flatMap((p) => p.companyTags || [])
    ])
  ).sort();

  const availableCategories = Array.from(
    new Set([
      'Algorithms',
      'Data Structures',
      'Mathematics',
      'Dynamic Programming',
      'Strings',
      'Graphs',
      ...problems.map((p) => p.category).filter(Boolean) as string[]
    ])
  ).sort();

  // Create New Problem
  const handleOpenCreate = () => {
    setIsCreating(true);
    setActiveTabInEditor('basic');
    setEditingProblem({
      id: '',
      title: '',
      slug: '',
      description: 'Given an array or string, solve the problem meeting constraints.',
      problemStatement: 'Given an array of integers, write an algorithm to process inputs efficiently.',
      inputFormat: 'The first line contains an integer N.\nThe second line contains N space-separated integers.',
      outputFormat: 'Print the required result to standard output.',
      constraints: '1 <= N <= 10^5\n-10^9 <= A[i] <= 10^9',
      difficulty: 'MEDIUM',
      category: 'Algorithms',
      concepts: ['Array', 'Sliding Window'],
      companyTags: ['Google', 'Amazon'],
      points: 100,
      maximumMarks: 100,
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      explanation: 'Break down into sample test cases and hidden test cases.',
      sampleTestCases: [
        {
          id: `tc-sample-${Date.now()}-1`,
          input: '5\n1 2 3 4 5',
          expectedOutput: '15',
          isHidden: false,
          marks: 30,
          explanation: 'Sum of elements is 15.'
        }
      ],
      hiddenTestCases: [
        {
          id: `tc-hidden-${Date.now()}-1`,
          input: '10\n10 20 30 40 50 60 70 80 90 100',
          expectedOutput: '550',
          isHidden: true,
          marks: 70
        }
      ],
      languages: ['python', 'javascript', 'cpp', 'c', 'java'],
      status: 'DRAFT',
      starterCode: {
        python: `# Python 3 Solution\nimport sys\n\ndef solve():\n    lines = sys.stdin.read().strip().splitlines()\n    if not lines: return\n    # Write logic here\n\nif __name__ == '__main__':\n    solve()\n`,
        javascript: `// JavaScript (Node.js) Solution\nconst fs = require('fs');\n\nfunction solve() {\n  const input = fs.readFileSync(0, 'utf-8').trim();\n  // Write logic here\n}\nsolve();\n`,
        cpp: `// C++ Solution\n#include <iostream>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    // Write logic here\n    return 0;\n}\n`,
        c: `// C Solution\n#include <stdio.h>\n\nint main() {\n    // Write logic here\n    return 0;\n}\n`,
        java: `// Java Solution\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write logic here\n    }\n}\n`
      }
    });
  };

  // Edit Existing Problem
  const handleOpenEdit = (prob: Problem) => {
    setIsCreating(false);
    setActiveTabInEditor('basic');
    setEditingProblem(JSON.parse(JSON.stringify(prob)));
  };

  // Duplicate Problem
  const handleDuplicateProblem = async (prob: Problem) => {
    try {
      await api.duplicateProblem(prob.id);
      setNotification({ type: 'success', message: `Duplicated problem "${prob.title}" as draft.` });
      loadProblems();
      onRefreshStats?.();
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to duplicate problem.' });
    }
  };

  // Delete Problem
  const handleDeleteProblem = async (problemId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete problem "${title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteProblem(problemId);
      setNotification({ type: 'success', message: `Problem "${title}" deleted from library.` });
      loadProblems();
      onRefreshStats?.();
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to delete problem.' });
    }
  };

  // Auto-Balance Test Case Marks
  const handleAutoBalanceMarks = () => {
    if (!editingProblem) return;
    const maxMarks = Number(editingProblem.maximumMarks || editingProblem.points) || 100;
    const allCasesCount = editingProblem.sampleTestCases.length + editingProblem.hiddenTestCases.length;

    if (allCasesCount === 0) {
      setNotification({ type: 'warning', message: 'Add at least 1 test case before auto-balancing marks.' });
      return;
    }

    const baseMark = Math.floor(maxMarks / allCasesCount);
    let remainder = maxMarks - baseMark * allCasesCount;

    const newSamples = editingProblem.sampleTestCases.map((tc) => {
      const mark = baseMark + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      return { ...tc, marks: mark };
    });

    const newHiddens = editingProblem.hiddenTestCases.map((tc) => {
      const mark = baseMark + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      return { ...tc, marks: mark };
    });

    setEditingProblem({
      ...editingProblem,
      sampleTestCases: newSamples,
      hiddenTestCases: newHiddens
    });

    setNotification({ type: 'success', message: `Auto-balanced marks across ${allCasesCount} test cases to equal ${maxMarks} points.` });
  };

  // Calculate Test Case Marks Sum
  const getTestCasesMarksSum = (prob: Problem): number => {
    const sSum = (prob.sampleTestCases || []).reduce((acc, t) => acc + (Number(t.marks) || 0), 0);
    const hSum = (prob.hiddenTestCases || []).reduce((acc, t) => acc + (Number(t.marks) || 0), 0);
    return sSum + hSum;
  };

  // Save Problem (Draft or Published)
  const handleSaveProblem = async (targetStatus?: 'DRAFT' | 'PUBLISHED') => {
    if (!editingProblem) return;

    const title = editingProblem.title.trim();
    if (!title) {
      setNotification({ type: 'error', message: 'Problem Title is required.' });
      return;
    }

    const maxMarks = Number(editingProblem.maximumMarks || editingProblem.points) || 100;
    const tcMarksSum = getTestCasesMarksSum(editingProblem);

    // If attempting to publish, enforce strict validation
    const publishMode = targetStatus === 'PUBLISHED' || editingProblem.status === 'PUBLISHED';
    if (publishMode) {
      if (!editingProblem.inputFormat?.trim()) {
        setNotification({ type: 'error', message: 'Input Format is required before publishing.' });
        return;
      }
      if (!editingProblem.outputFormat?.trim()) {
        setNotification({ type: 'error', message: 'Output Format is required before publishing.' });
        return;
      }
      if (!editingProblem.constraints?.trim()) {
        setNotification({ type: 'error', message: 'Constraints are required before publishing.' });
        return;
      }
      if (!editingProblem.sampleTestCases || editingProblem.sampleTestCases.length === 0) {
        setNotification({ type: 'error', message: 'At least 1 Sample Test Case is required before publishing.' });
        return;
      }
      if (!editingProblem.hiddenTestCases || editingProblem.hiddenTestCases.length === 0) {
        setNotification({ type: 'error', message: 'At least 1 Hidden Test Case is required before publishing.' });
        return;
      }
      if (tcMarksSum !== maxMarks) {
        setNotification({
          type: 'error',
          message: `Partial scoring mismatch: Test case marks sum (${tcMarksSum}) does not equal Maximum Marks (${maxMarks}). Click "Auto-Balance Marks" to fix.`
        });
        return;
      }
    }

    const payload: Partial<Problem> = {
      ...editingProblem,
      title,
      slug: editingProblem.slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      maximumMarks: maxMarks,
      points: maxMarks,
      status: targetStatus || editingProblem.status || 'DRAFT'
    };

    try {
      if (isCreating) {
        await api.createProblem(payload);
        setNotification({ type: 'success', message: `Problem "${title}" created successfully!` });
      } else {
        await api.updateProblem(editingProblem.id, payload);
        setNotification({ type: 'success', message: `Problem "${title}" updated successfully!` });
      }
      setEditingProblem(null);
      loadProblems();
      onRefreshStats?.();
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to save problem.' });
    }
  };

  // Bulk ZIP Upload Handler
  const handleBulkZipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkZipParsing(true);
    setBulkZipModalOpen(true);

    try {
      const res = await parseBulkProblemsZip(file);
      setBulkZipResult(res);
    } catch (err: any) {
      setNotification({ type: 'error', message: `Failed to parse Bulk ZIP: ${err.message}` });
      setBulkZipModalOpen(false);
    } finally {
      setBulkZipParsing(false);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    }
  };

  // Confirm Bulk ZIP Import
  const handleConfirmBulkImport = async () => {
    if (!bulkZipResult || bulkZipResult.validProblems.length === 0) return;

    try {
      const importRes = await api.bulkImportProblems(bulkZipResult.validProblems, { onDuplicate: 'upsert' });
      setNotification({
        type: 'success',
        message: `Successfully imported and published ${importRes.validCount} valid problem(s) into MongoDB & Problem Bank!`
      });
      setBulkZipModalOpen(false);
      setBulkZipResult(null);
      await loadProblems();
      onRefreshStats?.();
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Bulk import failed.' });
    }
  };

  // Single Test Case ZIP Upload Handler inside Editor
  const handleTestCaseZipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTestCaseZipParsing(true);
    setTestCaseZipModalOpen(true);

    try {
      const parsed = await parseTestCasesFromZip(file, 2);
      setTestCaseZipResult(parsed);
    } catch (err: any) {
      setNotification({ type: 'error', message: `Failed to parse Test Cases ZIP: ${err.message}` });
      setTestCaseZipModalOpen(false);
    } finally {
      setTestCaseZipParsing(false);
      if (testCaseFileInputRef.current) testCaseFileInputRef.current.value = '';
    }
  };

  // Apply Test Cases from ZIP
  const handleApplyZipTestCases = () => {
    if (!testCaseZipResult || !editingProblem) return;

    const sampleCases = testCaseZipResult.testCases.filter((tc) => !tc.isHidden);
    const hiddenCases = testCaseZipResult.testCases.filter((tc) => tc.isHidden);

    setEditingProblem({
      ...editingProblem,
      sampleTestCases: [...editingProblem.sampleTestCases, ...sampleCases],
      hiddenTestCases: [...editingProblem.hiddenTestCases, ...hiddenCases]
    });

    setNotification({
      type: 'success',
      message: `Added ${testCaseZipResult.testCases.length} test cases (${sampleCases.length} sample, ${hiddenCases.length} hidden) to problem.`
    });

    setTestCaseZipModalOpen(false);
    setTestCaseZipResult(null);
  };

  const handleDownloadSampleZipTemplate = async () => {
    try {
      const blob = await generateSampleTestCaseZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_testcases_template.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setNotification({ type: 'error', message: 'Failed generating sample template ZIP.' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/5 rounded-lg transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={bulkFileInputRef}
        accept=".zip"
        onChange={handleBulkZipFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={testCaseFileInputRef}
        accept=".zip"
        onChange={handleTestCaseZipFileChange}
        className="hidden"
      />

      {/* =========================================================================
          1. HEADER BAR
          ========================================================================= */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <Code className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
              Problem Library
            </h2>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Create, manage, organize, and test coding problems.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => bulkFileInputRef.current?.click()}
            className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <FileArchive className="w-4 h-4 text-indigo-600" />
            <span>Upload ZIP</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Problem</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. SEARCH, FILTERS & VIEW MODE CONTROLS
          ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search problems by title, concept, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:border-indigo-500 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-xs font-bold text-gray-600">
              Total Problems: <span className="text-indigo-600 font-black">{filteredProblems.length}</span>
              {filteredProblems.length !== problems.length && (
                <span className="text-gray-400 font-normal ml-1">({problems.length} total)</span>
              )}
            </div>

            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setViewMode('card')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'card' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Card View</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Multi-Facet Filter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-2 border-t border-gray-100">
          {/* Difficulty Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1">
              Difficulty
            </label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>

          {/* Concept Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1">
              Concept
            </label>
            <select
              value={selectedConcept}
              onChange={(e) => setSelectedConcept(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Concepts</option>
              {availableConcepts.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Company Tag Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1">
              Company Tag
            </label>
            <select
              value={selectedCompanyTag}
              onChange={(e) => setSelectedCompanyTag(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Companies</option>
              {availableCompanyTags.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN CONTENT AREA (CARD VIEW OR LIST VIEW)
          ========================================================================= */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Loading Problem Library...
          </p>
        </div>
      ) : filteredProblems.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
            <Code className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">No problems found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              No problems match your current search queries or filters. Try resetting filters or create a new problem.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDifficulty('ALL');
              setSelectedConcept('ALL');
              setSelectedCompanyTag('ALL');
              setSelectedCategory('ALL');
              setSelectedStatus('ALL');
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'card' ? (
        /* CARD VIEW GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProblems.map((prob) => {
            const sampleCount = prob.sampleTestCases?.length || 0;
            const hiddenCount = prob.hiddenTestCases?.length || 0;
            const maxMarks = prob.maximumMarks || prob.points || 100;
            const status = prob.status || 'PUBLISHED';

            return (
              <div
                key={prob.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Top Badge Line */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          prob.difficulty === 'EASY'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : prob.difficulty === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                        }`}
                      >
                        {prob.difficulty}
                      </span>

                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold">
                        {maxMarks} pts
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        status === 'PUBLISHED'
                          ? 'bg-emerald-100/60 text-emerald-800'
                          : status === 'DRAFT'
                          ? 'bg-amber-100/60 text-amber-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  {/* Title & Slug */}
                  <h3 className="text-base font-extrabold text-gray-900 group-hover:text-indigo-600 transition leading-snug">
                    {prob.title}
                  </h3>
                  <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                    {prob.id} • {prob.slug}
                  </p>

                  {/* Short Description */}
                  <p className="text-xs text-gray-600 line-clamp-2 mt-2 leading-relaxed">
                    {prob.description || prob.problemStatement || 'No description provided.'}
                  </p>

                  {/* Concept & Company Badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {prob.concepts?.slice(0, 3).map((concept) => (
                      <span
                        key={concept}
                        className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-[10px] font-bold"
                      >
                        <Tag className="w-2.5 h-2.5 mr-1" />
                        {concept}
                      </span>
                    ))}
                    {prob.companyTags?.slice(0, 2).map((comp) => (
                      <span
                        key={comp}
                        className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-md text-[10px] font-bold"
                      >
                        <Building2 className="w-2.5 h-2.5 mr-1" />
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-3">
                  {/* Limits & Test Cases Meta */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-gray-500 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>{prob.timeLimitMs || 1000} ms</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                      <span>{prob.memoryLimitMb || 256} MB</span>
                    </div>
                    <div className="col-span-2 flex items-center space-x-1.5 text-gray-700 font-semibold">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{sampleCount + hiddenCount} Tests ({sampleCount} Sample • {hiddenCount} Hidden)</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      onClick={() => setPreviewProblem(prob)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                      title="Preview Problem"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDuplicateProblem(prob)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                      title="Duplicate Problem"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteProblem(prob.id, prob.title)}
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      title="Delete Problem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(prob)}
                      className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit & Test Cases</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW TABLE */
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Problem Title</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4">Concepts & Tags</th>
                  <th className="py-3 px-4">Max Marks</th>
                  <th className="py-3 px-4">Test Cases</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredProblems.map((prob) => {
                  const sampleCount = prob.sampleTestCases?.length || 0;
                  const hiddenCount = prob.hiddenTestCases?.length || 0;
                  const maxMarks = prob.maximumMarks || prob.points || 100;

                  return (
                    <tr key={prob.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-gray-500">
                        {prob.id}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        <div>{prob.title}</div>
                        <div className="text-[10px] text-gray-400 font-mono font-normal">{prob.slug}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            prob.difficulty === 'EASY'
                              ? 'bg-emerald-50 text-emerald-700'
                              : prob.difficulty === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {prob.difficulty}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {prob.concepts?.slice(0, 2).map((c) => (
                            <span key={c} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded">
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-gray-900">
                        {maxMarks} pts
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-medium">
                        {sampleCount + hiddenCount} ({sampleCount} S • {hiddenCount} H)
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            prob.status === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : prob.status === 'DRAFT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {prob.status || 'PUBLISHED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setPreviewProblem(prob)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(prob)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Edit Problem"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateProblem(prob)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Duplicate Problem"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProblem(prob.id, prob.title)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Problem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. PROBLEM EDITOR MODAL (CREATE OR EDIT)
          ========================================================================= */}
      {editingProblem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-4xl w-full max-h-[92vh] flex flex-col my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    {isCreating ? 'Create New Problem' : `Edit Problem: ${editingProblem.title}`}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Configure specifications, test cases, partial marks, and starter code.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingProblem(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation in Editor */}
            <div className="flex border-b border-gray-200 bg-white px-5 space-x-1">
              {[
                { id: 'basic', label: '1. Basic Meta' },
                { id: 'statement', label: '2. Problem Specs' },
                { id: 'testcases', label: '3. Test Cases & Marks' },
                { id: 'starter', label: '4. Starter Code' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabInEditor(tab.id as any)}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
                    activeTabInEditor === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {/* TAB 1: BASIC META */}
              {activeTabInEditor === 'basic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block font-bold text-gray-700 mb-1">
                      Problem Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Subarray with Given Sum"
                      value={editingProblem.title}
                      onChange={(e) => setEditingProblem({ ...editingProblem, title: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Problem Slug / Identifier
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. subarray-given-sum"
                      value={editingProblem.slug}
                      onChange={(e) => setEditingProblem({ ...editingProblem, slug: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Difficulty Level *
                    </label>
                    <select
                      value={editingProblem.difficulty}
                      onChange={(e) => setEditingProblem({ ...editingProblem, difficulty: e.target.value as ProblemDifficulty })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="EASY">EASY</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HARD">HARD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Algorithms"
                      value={editingProblem.category || ''}
                      onChange={(e) => setEditingProblem({ ...editingProblem, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Maximum Marks (Points) *
                    </label>
                    <input
                      type="number"
                      value={editingProblem.maximumMarks || editingProblem.points || 100}
                      onChange={(e) => setEditingProblem({ ...editingProblem, maximumMarks: Number(e.target.value), points: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold focus:bg-white focus:border-indigo-500 focus:outline-none text-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Concepts / Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Array, Sliding Window, Two Pointers"
                      value={(editingProblem.concepts || editingProblem.tags || []).join(', ')}
                      onChange={(e) => {
                        const tagsArr = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                        setEditingProblem({ ...editingProblem, concepts: tagsArr, tags: tagsArr });
                      }}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Company Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Google, Amazon, Microsoft"
                      value={(editingProblem.companyTags || []).join(', ')}
                      onChange={(e) => {
                        const compArr = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                        setEditingProblem({ ...editingProblem, companyTags: compArr });
                      }}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Time Limit (ms)
                    </label>
                    <input
                      type="number"
                      value={editingProblem.timeLimitMs || 1000}
                      onChange={(e) => setEditingProblem({ ...editingProblem, timeLimitMs: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Memory Limit (MB)
                    </label>
                    <input
                      type="number"
                      value={editingProblem.memoryLimitMb || 256}
                      onChange={(e) => setEditingProblem({ ...editingProblem, memoryLimitMb: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: PROBLEM SPECS & STATEMENT */}
              {activeTabInEditor === 'statement' && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Brief Description / Summary
                    </label>
                    <textarea
                      rows={2}
                      value={editingProblem.description || ''}
                      onChange={(e) => setEditingProblem({ ...editingProblem, description: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Full Problem Statement (Markdown supported) *
                    </label>
                    <textarea
                      rows={6}
                      value={editingProblem.problemStatement || ''}
                      onChange={(e) => setEditingProblem({ ...editingProblem, problemStatement: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Input Format *
                      </label>
                      <textarea
                        rows={3}
                        value={editingProblem.inputFormat || ''}
                        onChange={(e) => setEditingProblem({ ...editingProblem, inputFormat: e.target.value })}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Output Format *
                      </label>
                      <textarea
                        rows={3}
                        value={editingProblem.outputFormat || ''}
                        onChange={(e) => setEditingProblem({ ...editingProblem, outputFormat: e.target.value })}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Constraints *
                    </label>
                    <textarea
                      rows={3}
                      value={editingProblem.constraints || ''}
                      onChange={(e) => setEditingProblem({ ...editingProblem, constraints: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Explanation / Notes
                    </label>
                    <textarea
                      rows={2}
                      value={editingProblem.explanation || ''}
                      onChange={(e) => setEditingProblem({ ...editingProblem, explanation: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: TEST CASES & MARKS VALIDATION */}
              {activeTabInEditor === 'testcases' && (
                <div className="space-y-6">
                  {/* Real-time Partial Scoring Validation Indicator Bar */}
                  {(() => {
                    const maxMarks = Number(editingProblem.maximumMarks || editingProblem.points) || 100;
                    const tcSum = getTestCasesMarksSum(editingProblem);
                    const matches = tcSum === maxMarks;

                    return (
                      <div
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
                          matches
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50/80 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {matches ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                          )}
                          <div>
                            <p className="font-extrabold text-xs">
                              Partial Scoring Status: {tcSum} / {maxMarks} Marks
                            </p>
                            <p className="text-[11px] font-medium opacity-90 mt-0.5">
                              {matches
                                ? '✓ Test case marks sum matches Maximum Marks perfectly.'
                                : `⚠ Total marks sum (${tcSum}) does not match Maximum Marks (${maxMarks}). Adjust individual marks or click auto-balance.`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={handleAutoBalanceMarks}
                            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            Auto-Balance Marks
                          </button>
                          <button
                            type="button"
                            onClick={() => testCaseFileInputRef.current?.click()}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer whitespace-nowrap flex items-center space-x-1"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Import ZIP</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sample Test Cases */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-xs text-gray-900 flex items-center space-x-1.5">
                        <Eye className="w-4 h-4 text-emerald-600" />
                        <span>Sample Test Cases (Visible to Candidates)</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const newSample = {
                            id: `tc-sample-${Date.now()}-${editingProblem.sampleTestCases.length + 1}`,
                            input: '',
                            expectedOutput: '',
                            isHidden: false,
                            marks: 20,
                            explanation: ''
                          };
                          setEditingProblem({
                            ...editingProblem,
                            sampleTestCases: [...editingProblem.sampleTestCases, newSample]
                          });
                        }}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                      >
                        + Add Sample Case
                      </button>
                    </div>

                    {editingProblem.sampleTestCases.map((tc, index) => (
                      <div key={tc.id || index} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px] text-gray-700">
                            Sample Test Case #{index + 1}
                          </span>
                          <div className="flex items-center space-x-2">
                            <label className="text-[10px] font-bold text-gray-500">Marks:</label>
                            <input
                              type="number"
                              value={tc.marks ?? 20}
                              onChange={(e) => {
                                const newCases = [...editingProblem.sampleTestCases];
                                newCases[index].marks = Number(e.target.value);
                                setEditingProblem({ ...editingProblem, sampleTestCases: newCases });
                              }}
                              className="w-16 px-2 py-0.5 bg-white border border-gray-300 rounded text-xs font-bold text-indigo-600"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newCases = editingProblem.sampleTestCases.filter((_, i) => i !== index);
                                setEditingProblem({ ...editingProblem, sampleTestCases: newCases });
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Input</label>
                            <textarea
                              rows={2}
                              value={tc.input}
                              onChange={(e) => {
                                const newCases = [...editingProblem.sampleTestCases];
                                newCases[index].input = e.target.value;
                                setEditingProblem({ ...editingProblem, sampleTestCases: newCases });
                              }}
                              className="w-full p-2 bg-white border border-gray-200 rounded-lg font-mono text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Expected Output</label>
                            <textarea
                              rows={2}
                              value={tc.expectedOutput}
                              onChange={(e) => {
                                const newCases = [...editingProblem.sampleTestCases];
                                newCases[index].expectedOutput = e.target.value;
                                setEditingProblem({ ...editingProblem, sampleTestCases: newCases });
                              }}
                              className="w-full p-2 bg-white border border-gray-200 rounded-lg font-mono text-[11px]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Hidden Test Cases */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-xs text-gray-900 flex items-center space-x-1.5">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span>Hidden Evaluation Test Cases (Proctor Verification)</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const newHidden = {
                            id: `tc-hidden-${Date.now()}-${editingProblem.hiddenTestCases.length + 1}`,
                            input: '',
                            expectedOutput: '',
                            isHidden: true,
                            marks: 40
                          };
                          setEditingProblem({
                            ...editingProblem,
                            hiddenTestCases: [...editingProblem.hiddenTestCases, newHidden]
                          });
                        }}
                        className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition cursor-pointer"
                      >
                        + Add Hidden Case
                      </button>
                    </div>

                    {editingProblem.hiddenTestCases.map((tc, index) => (
                      <div key={tc.id || index} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px] text-gray-700">
                            Hidden Test Case #{index + 1}
                          </span>
                          <div className="flex items-center space-x-2">
                            <label className="text-[10px] font-bold text-gray-500">Marks:</label>
                            <input
                              type="number"
                              value={tc.marks ?? 40}
                              onChange={(e) => {
                                const newCases = [...editingProblem.hiddenTestCases];
                                newCases[index].marks = Number(e.target.value);
                                setEditingProblem({ ...editingProblem, hiddenTestCases: newCases });
                              }}
                              className="w-16 px-2 py-0.5 bg-white border border-gray-300 rounded text-xs font-bold text-indigo-600"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newCases = editingProblem.hiddenTestCases.filter((_, i) => i !== index);
                                setEditingProblem({ ...editingProblem, hiddenTestCases: newCases });
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Hidden Input</label>
                            <textarea
                              rows={2}
                              value={tc.input}
                              onChange={(e) => {
                                const newCases = [...editingProblem.hiddenTestCases];
                                newCases[index].input = e.target.value;
                                setEditingProblem({ ...editingProblem, hiddenTestCases: newCases });
                              }}
                              className="w-full p-2 bg-white border border-gray-200 rounded-lg font-mono text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Expected Output</label>
                            <textarea
                              rows={2}
                              value={tc.expectedOutput}
                              onChange={(e) => {
                                const newCases = [...editingProblem.hiddenTestCases];
                                newCases[index].expectedOutput = e.target.value;
                                setEditingProblem({ ...editingProblem, hiddenTestCases: newCases });
                              }}
                              className="w-full p-2 bg-white border border-gray-200 rounded-lg font-mono text-[11px]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: STARTER CODE */}
              {activeTabInEditor === 'starter' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Provide initial template code for candidates in Python, JavaScript, C++, C, and Java.
                  </p>

                  {['python', 'javascript', 'cpp', 'c', 'java'].map((lang) => (
                    <div key={lang} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-100 px-3.5 py-1.5 font-mono text-[11px] font-extrabold uppercase text-gray-700 border-b border-gray-200">
                        {lang} Solution Starter Code
                      </div>
                      <textarea
                        rows={5}
                        value={(editingProblem.starterCode as any)?.[lang] || ''}
                        onChange={(e) =>
                          setEditingProblem({
                            ...editingProblem,
                            starterCode: {
                              ...editingProblem.starterCode,
                              [lang]: e.target.value
                            }
                          })
                        }
                        className="w-full p-3 font-mono text-xs bg-slate-900 text-slate-100 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setEditingProblem(null)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPreviewProblem(editingProblem)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveProblem('DRAFT')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveProblem('PUBLISHED')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Publish Problem</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. BULK ZIP IMPORT MODAL
          ========================================================================= */}
      {bulkZipModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-2xl w-full flex flex-col my-auto overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Bulk ZIP Problem Import</h3>
                  <p className="text-[11px] text-gray-500">Security verification & problem bank extraction</p>
                </div>
              </div>
              <button onClick={() => setBulkZipModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4 text-xs">
              {bulkZipParsing ? (
                <div className="text-center py-12 space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="font-bold text-gray-700">Scanning ZIP archive & running security verification...</p>
                </div>
              ) : bulkZipResult ? (
                <div className="space-y-4">
                  {/* Security Warnings */}
                  {bulkZipResult.securityWarnings.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-900">
                      <p className="font-extrabold flex items-center space-x-1">
                        <ShieldAlert className="w-4 h-4 text-amber-600 mr-1" />
                        Security Verification Log
                      </p>
                      {bulkZipResult.securityWarnings.map((w, idx) => (
                        <p key={idx} className="text-[11px] font-mono">• {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Summary Stat Badges */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                      <span className="block text-[10px] uppercase font-bold text-gray-400">Total Found</span>
                      <span className="text-lg font-black text-gray-900">{bulkZipResult.totalFound}</span>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <span className="block text-[10px] uppercase font-bold text-emerald-600">Valid Problems</span>
                      <span className="text-lg font-black text-emerald-700">{bulkZipResult.validProblems.length}</span>
                    </div>

                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                      <span className="block text-[10px] uppercase font-bold text-rose-600">Invalid Problems</span>
                      <span className="text-lg font-black text-rose-700">{bulkZipResult.invalidProblems.length}</span>
                    </div>
                  </div>

                  {/* Invalid Problems Table */}
                  {bulkZipResult.invalidProblems.length > 0 && (
                    <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/40 space-y-2">
                      <p className="font-bold text-rose-900">Invalid Problems Excluded from Import:</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {bulkZipResult.invalidProblems.map((inv, idx) => (
                          <div key={idx} className="p-2 bg-white rounded-lg border border-rose-200 text-[11px]">
                            <p className="font-bold text-rose-900">{inv.title} ({inv.problemId})</p>
                            <ul className="list-disc list-inside text-rose-700 font-medium mt-0.5">
                              {inv.errors.map((err, eIdx) => (
                                <li key={eIdx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Valid Problems Preview List */}
                  {bulkZipResult.validProblems.length > 0 && (
                    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                      <p className="font-bold text-gray-900">Valid Problems Ready for Library:</p>
                      <div className="max-h-44 overflow-y-auto space-y-1.5">
                        {bulkZipResult.validProblems.map((prob) => (
                          <div key={prob.id} className="p-2 bg-white border border-gray-200 rounded-lg flex items-center justify-between">
                            <div>
                              <span className="font-bold text-gray-900">{prob.title}</span>
                              <span className="text-[10px] text-gray-400 ml-2 font-mono">({prob.id})</span>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded">
                              {prob.difficulty} • {prob.maximumMarks} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => setBulkZipModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>

              {bulkZipResult && bulkZipResult.validProblems.length > 0 && (
                <button
                  onClick={handleConfirmBulkImport}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Import {bulkZipResult.validProblems.length} Valid Problems</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. PROBLEM DETAILS / PREVIEW MODAL
          ========================================================================= */}
      {previewProblem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col my-auto overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">{previewProblem.title}</h3>
                  <p className="text-[11px] font-mono text-gray-500">{previewProblem.id} • {previewProblem.slug}</p>
                </div>
              </div>
              <button onClick={() => setPreviewProblem(null)} className="p-2 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Meta Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 font-semibold text-gray-700">
                <div>
                  <span className="block text-[10px] text-gray-400 uppercase font-extrabold">Difficulty</span>
                  <span className="text-indigo-600 font-black">{previewProblem.difficulty}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 uppercase font-extrabold">Max Marks</span>
                  <span className="text-gray-900 font-black">{previewProblem.maximumMarks || previewProblem.points || 100} pts</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 uppercase font-extrabold">Time Limit</span>
                  <span>{previewProblem.timeLimitMs || 1000} ms</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 uppercase font-extrabold">Memory Limit</span>
                  <span>{previewProblem.memoryLimitMb || 256} MB</span>
                </div>
              </div>

              {/* Statement */}
              <div>
                <h4 className="font-extrabold text-gray-900 mb-1 uppercase tracking-wider text-[10px]">Problem Statement</h4>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 leading-relaxed font-sans">
                  {previewProblem.problemStatement || previewProblem.description}
                </div>
              </div>

              {/* Formats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <h4 className="font-extrabold text-gray-900 mb-1 uppercase tracking-wider text-[10px]">Input Format</h4>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px]">
                    {previewProblem.inputFormat}
                  </div>
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 mb-1 uppercase tracking-wider text-[10px]">Output Format</h4>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px]">
                    {previewProblem.outputFormat}
                  </div>
                </div>
              </div>

              {/* Constraints */}
              <div>
                <h4 className="font-extrabold text-gray-900 mb-1 uppercase tracking-wider text-[10px]">Constraints</h4>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px]">
                  {previewProblem.constraints}
                </div>
              </div>

              {/* Sample Test Cases */}
              {previewProblem.sampleTestCases && previewProblem.sampleTestCases.length > 0 && (
                <div>
                  <h4 className="font-extrabold text-gray-900 mb-2 uppercase tracking-wider text-[10px]">Sample Test Cases</h4>
                  <div className="space-y-2">
                    {previewProblem.sampleTestCases.map((tc, idx) => (
                      <div key={idx} className="p-3 border border-gray-200 rounded-xl bg-gray-50 space-y-2">
                        <div className="flex justify-between font-bold text-[10px] text-gray-500">
                          <span>Sample Case #{idx + 1}</span>
                          <span>{tc.marks} pts</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 block">Input:</span>
                            <pre className="p-2 bg-white rounded border border-gray-200 overflow-x-auto">{tc.input}</pre>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 block">Output:</span>
                            <pre className="p-2 bg-white rounded border border-gray-200 overflow-x-auto">{tc.expectedOutput}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => setPreviewProblem(null)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition"
              >
                Close Preview
              </button>

              <button
                onClick={() => {
                  const p = previewProblem;
                  setPreviewProblem(null);
                  handleOpenEdit(p);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Problem</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
