import type { TestCase, TestCaseResult } from '../../src/types.ts';
import {
  getSupportedLanguages as getJudge0Languages,
  getLanguageMapping as getJudge0LanguageMapping,
  executeCode as executeJudge0Single,
  runSampleTests,
  runHiddenTests,
  runAllTests,
  getSubmissionResult as getJudge0SubResult,
  checkJudge0Health as checkHealth,
  sanitizeTestCaseText,
  normalizeOutput as normOutput,
  normalizeCodeForLanguage as normCode
} from './judge0.ts';

export interface CodeExecutionOptions {
  code: string;
  language: string;
  testCases: TestCase[];
  timeLimitMs?: number;
  memoryLimitMb?: number;
  isHiddenEvaluation?: boolean;
}

export interface SingleTestCaseExecutionOptions {
  code: string;
  language: string;
  input: string;
  expectedOutput?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
}

export interface Judge0SubmissionResponse {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?: {
    id: number;
    description: string;
  };
  token?: string;
}

export interface ExecutionResult {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'COMPILATION_ERROR' | 'MEMORY_LIMIT_EXCEEDED' | 'EXECUTION_SERVICE_UNAVAILABLE' | 'JUDGE0_AUTHENTICATION_REQUIRED' | 'JUDGE0_AUTHORIZATION_FAILED' | 'JUDGE0_RATE_LIMITED' | 'JUDGE0_QUEUE_UNAVAILABLE';
  passedTests: number;
  totalTests: number;
  score: number;
  maxScore: number;
  executionTimeMs: number;
  memoryUsedMb: number;
  testCaseResults: TestCaseResult[];
  errorLog?: string;
  compileOutput?: string;
  stdout?: string;
  stderr?: string;
}

export function normalizeOutput(out: string | null | undefined): string {
  return normOutput(out);
}

export function normalizeCodeForLanguage(code: string, languageStr: string): string {
  return normCode(code, languageStr);
}

export async function getSupportedLanguages() {
  return await getJudge0Languages();
}

export async function getLanguageMapping(languageStr: string) {
  const mapping = await getJudge0LanguageMapping(languageStr);
  return mapping.id;
}

export async function getExecutionResult(token: string) {
  return await getJudge0SubResult(token);
}

export async function executeTestCase(options: SingleTestCaseExecutionOptions) {
  return await executeJudge0Single({
    code: options.code,
    language: options.language,
    input: sanitizeTestCaseText(options.input),
    expectedOutput: sanitizeTestCaseText(options.expectedOutput),
    timeLimitMs: options.timeLimitMs,
    memoryLimitMb: options.memoryLimitMb
  });
}

export async function executeAllTestCases(options: CodeExecutionOptions): Promise<ExecutionResult> {
  const { code, language, testCases, timeLimitMs, memoryLimitMb, isHiddenEvaluation } = options;
  if (isHiddenEvaluation) {
    return await runHiddenTests(code, language, testCases, timeLimitMs, memoryLimitMb);
  }
  return await runAllTests(code, language, testCases, timeLimitMs, memoryLimitMb);
}

export async function executeCode(options: CodeExecutionOptions): Promise<ExecutionResult> {
  return await runSampleTests(options.code, options.language, options.testCases, options.timeLimitMs, options.memoryLimitMb);
}

export async function submitCode(options: CodeExecutionOptions): Promise<ExecutionResult> {
  return await runAllTests(options.code, options.language, options.testCases, options.timeLimitMs, options.memoryLimitMb);
}

export async function getExecutionHealth() {
  const health = await checkHealth();
  const supported = health.supportedLanguages;
  const hasPy = supported.some(l => l.name.toLowerCase().includes('python'));
  const hasJava = supported.some(l => l.name.toLowerCase().includes('java') && !l.name.toLowerCase().includes('script'));
  const hasCpp = supported.some(l => l.name.toLowerCase().includes('c++') || l.name.toLowerCase().includes('cpp'));
  const hasC = supported.some(l => l.name.toLowerCase().startsWith('c (') || l.name.toLowerCase() === 'c');
  const hasJs = supported.some(l => l.name.toLowerCase().includes('javascript') || l.name.toLowerCase().includes('node'));

  return {
    healthy: health.healthy,
    serviceUrl: health.serviceUrl,
    error: health.error,
    languages: {
      python: hasPy,
      java: hasJava,
      cpp: hasCpp,
      c: hasC,
      javascript: hasJs
    },
    supportedLanguages: supported
  };
}
