import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Problem, QuestionAssignment, Submission, TestCaseResult } from '../types';
import { ProblemStatement } from './ProblemStatement';
import { TestcaseConsole } from './TestcaseConsole';
import { api } from '../api';
import {
  Play,
  Send,
  Maximize2,
  Minimize2,
  RotateCcw,
  Code2,
  CheckCircle2,
  Layers,
  Sparkles,
  AlertTriangle,
  Lock,
  CloudCheck
} from 'lucide-react';

interface CodingWorkspaceProps {
  problems: Problem[];
  assignment: QuestionAssignment | null;
  roundId: string;
  contestId?: string;
  isSessionTerminated: boolean;
  onSubmitTest?: () => void;
}

export const CodingWorkspace: React.FC<CodingWorkspaceProps> = ({
  problems,
  assignment,
  roundId,
  contestId,
  isSessionTerminated,
  onSubmitTest
}) => {
  const [selectedProblemIdx, setSelectedProblemIdx] = useState<number>(0);
  const [language, setLanguage] = useState<'python' | 'javascript' | 'cpp' | 'c' | 'java'>('python');
  const [executionRuntimeInfo, setExecutionRuntimeInfo] = useState<any>(null);
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getExecutionHealth().then(info => {
      setExecutionRuntimeInfo(info);
    }).catch(() => {});
  }, []);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [testCaseResults, setTestCaseResults] = useState<TestCaseResult[]>([]);
  const [lastSubmission, setLastSubmission] = useState<Submission | null>(null);
  const [executionError, setExecutionError] = useState<string | undefined>(undefined);
  const [submissionsHistory, setSubmissionsHistory] = useState<Submission[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pasteBlockedToast, setPasteBlockedToast] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<any>(null);
  const activeProblem = problems[selectedProblemIdx] || problems[0];

  // Trigger paste blocked notification and record security violation
  const triggerPasteBlocked = useCallback((reason = 'Paste action is blocked during contest execution.') => {
    setPasteBlockedToast(reason);
    setTimeout(() => setPasteBlockedToast(null), 3500);

    if (activeProblem) {
      api.recordSecurityEvent('CLIPBOARD_PASTE', `Editor paste attempt intercepted: ${reason}`, roundId)
        .catch(() => {});
    }
  }, [activeProblem, roundId]);

  // Handle Monaco Editor mount: bind command overrides to strictly intercept paste shortcuts and enforce single cursor
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Enforce single cursor, disable column selection / multi-cursor, and guarantee font metrics
    editor.updateOptions({
      columnSelection: false,
      multiCursorModifier: 'ctrlCmd',
      multiCursorMergeOverlapping: true,
      multiCursorLimit: 1,
      cursorStyle: 'line',
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'off',
      cursorWidth: 2,
      matchBrackets: 'always',
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnType: false,
      formatOnPaste: false,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, 'Courier New', monospace",
      fontWeight: '400',
      fontLigatures: false,
      letterSpacing: 0,
      disableMonospaceOptimizations: true
    });

    // Remeasure fonts immediately to sync metrics with current render state
    monaco.editor.remeasureFonts();
    editor.layout();

    // Re-measure when browser finishes downloading or swapping custom web fonts
    if (typeof document !== 'undefined' && 'fonts' in document) {
      const syncEditorWithFonts = () => {
        monaco.editor.remeasureFonts();
        editor.layout();
        if (typeof (editor as any).render === 'function') {
          (editor as any).render(true);
        }
      };

      document.fonts.ready.then(syncEditorWithFonts);

      const handleFontDone = () => {
        syncEditorWithFonts();
      };
      document.fonts.addEventListener('loadingdone', handleFontDone);

      if (document.fonts.load) {
        document.fonts.load('13px "JetBrains Mono"').then(syncEditorWithFonts).catch(() => {});
      }

      editor.onDidDispose(() => {
        document.fonts.removeEventListener('loadingdone', handleFontDone);
      });
    }

    // Window resize / DPI scaling / browser zoom handler
    const handleResize = () => {
      monaco.editor.remeasureFonts();
      editor.layout();
      if (typeof (editor as any).render === 'function') {
        (editor as any).render(true);
      }
    };
    window.addEventListener('resize', handleResize);
    editor.onDidDispose(() => {
      window.removeEventListener('resize', handleResize);
    });

    // Development diagnostics helper for inspecting caret and font coordinate metrics
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      (window as any).__debugEditorCaret = () => {
        const pos = editor.getPosition();
        const layout = editor.getLayoutInfo();
        const fontInfo = editor.getOption(monaco.editor.EditorOption.fontInfo);
        const editorDom = editor.getDomNode();
        const editorRect = editorDom?.getBoundingClientRect();
        const cursorEl = editorDom?.querySelector('.cursor') as HTMLElement | null;
        const cursorRect = cursorEl?.getBoundingClientRect();

        const codeContentX = (editorRect?.left || 0) + layout.contentLeft;
        const gutterWidth = layout.glyphMarginWidth + layout.lineNumbersWidth + layout.decorationsWidth;
        const scrollLeft = editor.getScrollLeft();
        const logicalCaretX = codeContentX + ((pos?.column || 1) - 1) * fontInfo.typicalHalfwidthCharacterWidth - scrollLeft;
        const renderedCaretX = cursorRect?.left || 0;
        const offset = renderedCaretX - logicalCaretX;

        // Measure real DOM character range bounding box if available
        let domCharRect: { left: number; top: number; width: number; height: number } | null = null;
        let domCharOffset = 0;
        try {
          const viewLineEl = editorDom?.querySelector('.view-line') as HTMLElement | null;
          if (viewLineEl) {
            const walker = document.createTreeWalker(viewLineEl, NodeFilter.SHOW_TEXT);
            let currentOffset = 0;
            let targetNode: Node | null = null;
            let targetNodeOffset = 0;
            const targetCharIdx = Math.max(0, (pos?.column || 1) - 1);

            while (walker.nextNode()) {
              const node = walker.currentNode;
              const len = node.nodeValue?.length || 0;
              if (currentOffset + len >= targetCharIdx) {
                targetNode = node;
                targetNodeOffset = targetCharIdx - currentOffset;
                break;
              }
              currentOffset += len;
            }
            if (targetNode) {
              const range = document.createRange();
              range.setStart(targetNode, targetNodeOffset);
              range.setEnd(targetNode, targetNodeOffset);
              const r = range.getBoundingClientRect();
              domCharRect = { left: r.left, top: r.top, width: r.width, height: r.height };
              domCharOffset = renderedCaretX - r.left;
            }
          }
        } catch {
          // diagnostic inspect fallback
        }

        return {
          pos,
          codeContentX,
          gutterWidth,
          editorContainerLeft: editorRect?.left,
          paddingLeft: layout.contentLeft - gutterWidth,
          scrollLeft,
          logicalCaretX,
          renderedCaretX,
          offset,
          domCharRect,
          domCharOffset,
          disableMonospaceOptimizations: editor.getOption(monaco.editor.EditorOption.disableMonospaceOptimizations),
          fontMetrics: {
            typicalHalfwidthCharacterWidth: fontInfo.typicalHalfwidthCharacterWidth,
            spaceWidth: fontInfo.spaceWidth,
            isMonospace: fontInfo.isMonospace,
            fontFamily: fontInfo.fontFamily,
            fontSize: fontInfo.fontSize,
            letterSpacing: fontInfo.letterSpacing,
            fontLoaded: document.fonts && document.fonts.check ? document.fonts.check(`${fontInfo.fontSize}px 'JetBrains Mono'`) : 'unknown'
          }
        };
      };
    }

    // Ctrl+V / Cmd+V
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
      triggerPasteBlocked('Ctrl+V paste is disabled');
    });

    // Ctrl+Shift+V / Cmd+Shift+V
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV, () => {
      triggerPasteBlocked('Paste is disabled');
    });

    // Shift+Insert
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, () => {
      triggerPasteBlocked('Shift+Insert paste is disabled');
    });

    // Disable Ctrl+M (which toggles tab focus mode in Monaco and leaks focus to browser)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyM, () => {
      // Intercepted to ensure Tab always indents code inside Monaco
    });

    // Block right-click context menu within Monaco container
    editor.onContextMenu((e) => {
      e.event.preventDefault();
      triggerPasteBlocked('Context menu is disabled');
    });
  };

  // Synchronize Monaco editor content smoothly when switching problem or language
  useEffect(() => {
    if (editorRef.current && activeProblem) {
      const targetCode = codeMap[`${activeProblem.id}_${language}`] || activeProblem.starterCode?.[language] || '';
      const currentEditorValue = editorRef.current.getValue();
      if (currentEditorValue !== targetCode) {
        editorRef.current.setValue(targetCode);
      }
    }
  }, [activeProblem?.id, language]);

  // Load submissions for current problem
  useEffect(() => {
    if (!activeProblem) return;
    api.getSubmissions({ problemId: activeProblem.id, roundId })
      .then(res => setSubmissionsHistory(res.submissions || []))
      .catch(() => {});
  }, [activeProblem?.id, roundId]);

  // Set starter code if empty
  useEffect(() => {
    if (!activeProblem) return;
    const key = `${activeProblem.id}_${language}`;
    if (!codeMap[key]) {
      const starter = activeProblem.starterCode?.[language] ||
        (language === 'python' ? '# Write your solution here\n' :
         language === 'java' ? `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n` :
         language === 'c' ? `#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n` :
         language === 'cpp' ? `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n` :
         '// Write your solution here\n');
      setCodeMap(prev => ({ ...prev, [key]: starter }));
    }
  }, [activeProblem?.id, language]);

  const currentCode = activeProblem
    ? codeMap[`${activeProblem.id}_${language}`] || activeProblem.starterCode?.[language] || ''
    : '';

  // Debounced autosave
  const handleCodeChange = (value: string | undefined) => {
    if (!activeProblem || isSessionTerminated) return;
    const newCode = value || '';
    setCodeMap(prev => ({
      ...prev,
      [`${activeProblem.id}_${language}`]: newCode
    }));

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      api.autosaveCode(activeProblem.id, newCode, language, contestId)
        .then(() => {
          const now = new Date();
          setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        })
        .catch(() => {});
    }, 1200);
  };

  const handleResetCode = () => {
    if (!activeProblem || isSessionTerminated) return;
    const starter = activeProblem.starterCode?.[language] || '';
    setCodeMap(prev => ({
      ...prev,
      [`${activeProblem.id}_${language}`]: starter
    }));
  };

  const handleRunSampleCode = async () => {
    if (!activeProblem || isRunning || isSubmitting || isSessionTerminated) return;
    const codeToExecute = editorRef.current ? editorRef.current.getValue() : currentCode;

    setIsRunning(true);
    setExecutionError(undefined);
    setTestCaseResults([]); // Clear previous results so UI reflects new run state

    try {
      const res = await api.runSampleCode(activeProblem.id, codeToExecute, language);
      setTestCaseResults(res.result?.testCaseResults || []);
      setExecutionError(res.result?.errorLog);
    } catch (e: any) {
      setExecutionError(e.message || 'Failed to execute code');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (!activeProblem || isRunning || isSubmitting || isSessionTerminated) return;
    const codeToExecute = editorRef.current ? editorRef.current.getValue() : currentCode;

    setIsSubmitting(true);
    setExecutionError(undefined);
    setLastSubmission(null);
    setTestCaseResults([]); // Clear previous results so UI reflects fresh submission state

    try {
      const res = await api.submitCode(activeProblem.id, codeToExecute, language, roundId, contestId);
      const subId = res.submissionId;

      // Poll submission status until finished
      const pollInterval = setInterval(async () => {
        try {
          const subRes = await api.getSubmission(subId);
          if (subRes.submission.status !== 'QUEUED' && subRes.submission.status !== 'RUNNING') {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            setLastSubmission(subRes.submission);
            setTestCaseResults(subRes.submission.testCaseResults || []);
            setExecutionError(subRes.submission.errorLog);

            // Refresh history
            api.getSubmissions({ problemId: activeProblem.id, roundId, contestId }).then(hRes => {
              setSubmissionsHistory(hRes.submissions || []);
            });
          }
        } catch (err) {
          clearInterval(pollInterval);
          setIsSubmitting(false);
        }
      }, 500);
    } catch (e: any) {
      setIsSubmitting(false);
      setExecutionError(e.message || 'Submission error');
    }
  };

  if (!activeProblem) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center text-gray-500 text-sm">
        No problems assigned to your candidate profile for this round.
      </div>
    );
  }

  return (
    <div
      onDragStart={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
      className={`flex flex-col relative select-none ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : 'h-[calc(100vh-4rem)]'}`}
    >
      
      {/* Floating Paste Blocked Toast */}
      {pasteBlockedToast && (
        <div className="absolute top-14 right-6 z-50 bg-rose-900/95 border border-rose-600 text-rose-100 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xs">
          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
          <span>{pasteBlockedToast}</span>
        </div>
      )}

      {/* Permanent Question Set Sequence Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 mr-2 text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Assigned Set: {assignment?.setId && assignment.setId !== 'undefined' ? assignment.setId : ((assignment as any)?.setName || 'Set A')}</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 mr-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Total: 50 Marks</span>
          </div>

          {/* Question Sequence Tabs (P1, P2, P3...) */}
          <div className="flex items-center space-x-1">
            {problems.map((prob, idx) => {
              const isSelected = selectedProblemIdx === idx;
              const isSolved = submissionsHistory.some(s => s.problemId === prob.id && s.status === 'ACCEPTED');
              const diff = (prob.difficulty || 'MEDIUM').toUpperCase();
              const pts = diff === 'EASY' ? 10 : diff === 'HARD' ? 25 : 15;

              return (
                <button
                  key={prob.id}
                  id={`prob-tab-${idx + 1}`}
                  onClick={() => {
                    setSelectedProblemIdx(idx);
                    setTestCaseResults([]);
                    setLastSubmission(null);
                    setExecutionError(undefined);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  <span>P{idx + 1}: {diff} ({pts} pts)</span>
                  {isSolved && (
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-200' : 'text-emerald-600'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Controls: Language Selector, Reset & Fullscreen */}
        <div className="flex items-center space-x-2">
          <select
            id="editor-lang-select"
            aria-label="Editor Language Selector"
            value={language}
            onChange={e => setLanguage(e.target.value as any)}
            disabled={isSessionTerminated}
            className="bg-gray-50 border border-gray-200 text-gray-800 text-xs font-semibold rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
          >
            {(!executionRuntimeInfo || executionRuntimeInfo.python?.available) && <option value="python">{executionRuntimeInfo?.python?.version || 'Python 3'}</option>}
            {(!executionRuntimeInfo || executionRuntimeInfo.javascript?.available) && <option value="javascript">{executionRuntimeInfo?.javascript?.version || 'JavaScript'}</option>}
            {(!executionRuntimeInfo || executionRuntimeInfo.cpp?.available) && <option value="cpp">{executionRuntimeInfo?.cpp?.version || 'C++'}</option>}
            {(!executionRuntimeInfo || executionRuntimeInfo.c?.available) && <option value="c">{executionRuntimeInfo?.c?.version || 'C'}</option>}
            {(!executionRuntimeInfo || executionRuntimeInfo.java?.available) && <option value="java">{executionRuntimeInfo?.java?.version || 'Java'}</option>}
          </select>

          <button
            id="reset-code-btn"
            onClick={handleResetCode}
            disabled={isSessionTerminated}
            title="Reset code template"
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="fullscreen-toggle-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Split Grid View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Left: Problem Statement & Constraints */}
        <div className="h-full overflow-hidden">
          <ProblemStatement problem={activeProblem} submissions={submissionsHistory} />
        </div>

        {/* Right: Monaco Editor + Bottom Execution Drawer */}
        <div className="h-full flex flex-col bg-gray-950 overflow-hidden">
          {/* Monaco Code Editor */}
          <div className="flex-1 overflow-hidden relative">
            <Editor
              height="100%"
              language={language === 'cpp' || language === 'c' ? 'cpp' : language}
              theme="vs-dark"
              value={currentCode}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, 'Courier New', monospace",
                fontWeight: '400',
                fontLigatures: false,
                letterSpacing: 0,
                disableMonospaceOptimizations: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                tabSize: 4,
                insertSpaces: true,
                tabFocusMode: false,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                readOnly: isSessionTerminated,
                columnSelection: false,
                multiCursorModifier: 'ctrlCmd',
                multiCursorMergeOverlapping: true,
                multiCursorLimit: 1,
                cursorStyle: 'line',
                cursorBlinking: 'blink',
                cursorSmoothCaretAnimation: 'off',
                cursorWidth: 2
              }}
            />
          </div>

          {/* Action Bar (Run & Submit) */}
          <div className="bg-gray-900 px-4 py-2.5 border-t border-gray-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[11px] text-gray-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Autosaved ({lastSavedTime}) • {language.toUpperCase()}</span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                id="run-code-btn"
                disabled={isRunning || isSubmitting || isSessionTerminated}
                onClick={handleRunSampleCode}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all border border-gray-700 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>{isRunning ? 'Running...' : 'Run Code'}</span>
              </button>

              <button
                id="submit-code-btn"
                disabled={isRunning || isSubmitting || isSessionTerminated}
                onClick={handleSubmitSolution}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Evaluating...' : 'Submit Solution'}</span>
              </button>

              {onSubmitTest && (
                <button
                  id="workspace-submit-test-btn"
                  disabled={isRunning || isSubmitting || isSessionTerminated}
                  onClick={onSubmitTest}
                  className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md"
                  title="Submit Complete Test & Exit"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Test</span>
                </button>
              )}
            </div>
          </div>

          {/* Execution & Output Console Drawer */}
          <div className="h-56">
            <TestcaseConsole
              testCaseResults={testCaseResults}
              lastSubmission={lastSubmission}
              isRunning={isRunning}
              isSubmitting={isSubmitting}
              executionError={executionError}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

