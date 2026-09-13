import type { TestCase, TestCaseResult } from '../src/types.ts';
import {
  executeAllTestCases,
  getExecutionHealth as getServiceHealth,
  normalizeOutput as normalizeOut
} from './services/codeExecution.ts';

export interface ExecutionOptions {
  code: string;
  language: string;
  testCases: TestCase[];
  timeLimitMs?: number;
  memoryLimitMb?: number;
}

export function normalizeOutput(out: string | null | undefined): string {
  return normalizeOut(out);
}

export async function getExecutionHealth() {
  const health = await getServiceHealth();
  const supported = health.supportedLanguages || [];

  const pyObj = supported.find(l => l.id === 92 || (l.name.toLowerCase().includes('python') && l.name.includes('3.')));
  const javaObj = supported.find(l => l.id === 91 || (l.name.toLowerCase().includes('java') && !l.name.toLowerCase().includes('script')));
  const cppObj = supported.find(l => l.id === 105 || l.name.toLowerCase().includes('c++ (gcc'));
  const cObj = supported.find(l => l.id === 103 || l.name.toLowerCase().startsWith('c (gcc'));
  const jsObj = supported.find(l => l.id === 97 || l.name.toLowerCase().includes('20.'));

  return {
    available: health.healthy,
    healthy: health.healthy,
    provider: 'Judge0 CE',
    endpoint: health.serviceUrl,
    serviceUrl: health.serviceUrl,
    error: health.error,
    python: { available: !!pyObj, version: pyObj?.name || 'Python 3' },
    java: { available: !!javaObj, compiler: javaObj?.name, version: javaObj?.name || 'Java' },
    cpp: { available: !!cppObj, compiler: cppObj?.name, version: cppObj?.name || 'C++' },
    c: { available: !!cObj, compiler: cObj?.name, version: cObj?.name || 'C' },
    javascript: { available: !!jsObj, version: jsObj?.name || 'JavaScript' },
    supportedLanguages: supported
  };
}

export class CodeJudge {
  static async evaluate(options: ExecutionOptions): Promise<{
    status: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'COMPILATION_ERROR' | 'MEMORY_LIMIT_EXCEEDED' | 'EXECUTION_SERVICE_UNAVAILABLE' | 'JUDGE0_AUTHENTICATION_REQUIRED' | 'JUDGE0_AUTHORIZATION_FAILED' | 'JUDGE0_RATE_LIMITED' | 'JUDGE0_QUEUE_UNAVAILABLE';
    passedTests: number;
    totalTests: number;
    score: number;
    maxScore: number;
    executionTimeMs: number;
    memoryUsedMb: number;
    testCaseResults: TestCaseResult[];
    errorLog?: string;
  }> {
    return await executeAllTestCases(options);
  }
}
