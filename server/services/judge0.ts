import type { TestCase, TestCaseResult } from '../../src/types.ts';

export interface Judge0Language {
  id: number;
  name: string;
}

export interface Judge0SubmissionPayload {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  wall_time_limit?: number;
  memory_limit?: number;
  max_file_size?: number;
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

export interface SingleExecutionResult {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'COMPILATION_ERROR' | 'MEMORY_LIMIT_EXCEEDED' | 'EXECUTION_SERVICE_UNAVAILABLE' | 'JUDGE0_AUTHENTICATION_REQUIRED' | 'JUDGE0_AUTHORIZATION_FAILED' | 'JUDGE0_RATE_LIMITED' | 'JUDGE0_QUEUE_UNAVAILABLE';
  actualOutput: string;
  expectedOutput: string;
  compileOutput?: string;
  errorLog?: string;
  executionTimeMs: number;
  memoryUsedMb: number;
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
}

const JUDGE0_API_KEY = (process.env.JUDGE0_API_KEY || '').trim();
let envUrl = (process.env.JUDGE0_URL || 'https://ce.judge0.com').trim();
if (!envUrl || envUrl.includes('rapidapi') || envUrl.includes('/api')) {
  envUrl = 'https://ce.judge0.com';
}
const JUDGE0_URL = envUrl.replace(/\/+$/, '');

// Print environment variables existence without printing secret values
console.log(`[Judge0 Config] JUDGE0_URL = ${JUDGE0_URL}`);
console.log(`[Judge0 Config] JUDGE0_API_KEY = ${JUDGE0_API_KEY ? 'configured' : 'absent'}`);

export interface SubmissionTokenRecord {
  judge0Token: string;
  studentId?: string;
  contestId?: string;
  attemptId?: string;
  problemId?: string;
  testCaseId?: string;
  createdAt: number;
}

export const submissionTokenMap = new Map<string, SubmissionTokenRecord>();

export function registerSubmissionToken(record: Omit<SubmissionTokenRecord, 'createdAt'>) {
  submissionTokenMap.set(record.judge0Token, {
    ...record,
    createdAt: Date.now()
  });
}

// Automatically prune records older than 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [token, rec] of submissionTokenMap.entries()) {
    if (now - rec.createdAt > 3600 * 1000) {
      submissionTokenMap.delete(token);
    }
  }
}, 5 * 60 * 1000);

let cachedLanguages: Judge0Language[] | null = null;
let lastFetchLanguagesTime = 0;

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUDGE0_API_KEY) {
    headers['X-Auth-Token'] = JUDGE0_API_KEY;
  }
  return headers;
}

export async function checkDirectJudge0Health(): Promise<{
  reachable: boolean;
  status: number | null;
  provider: string;
  endpoint: string;
  error?: string;
  aboutInfo?: any;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const [aboutRes, langRes] = await Promise.all([
      fetch(`${JUDGE0_URL}/about`, { headers: getAuthHeaders(), signal: controller.signal }),
      fetch(`${JUDGE0_URL}/languages`, { headers: getAuthHeaders(), signal: controller.signal })
    ]);
    clearTimeout(timeout);

    if (aboutRes.ok && langRes.ok) {
      let aboutData: any = null;
      try {
        aboutData = await aboutRes.json();
      } catch (_) {}

      return {
        reachable: true,
        status: 200,
        provider: 'Judge0 CE',
        endpoint: JUDGE0_URL,
        aboutInfo: aboutData
      };
    } else {
      const errStatus = !aboutRes.ok ? aboutRes.status : langRes.status;
      const errText = !aboutRes.ok ? await aboutRes.text().catch(() => '') : await langRes.text().catch(() => '');

      console.error(`[JUDGE0 ERROR]
HTTP status: ${errStatus}
Response body: ${errText}
Request URL: ${JUDGE0_URL}/about
Error message: Endpoint returned non-200 HTTP status`);

      return {
        reachable: false,
        status: errStatus,
        provider: 'Judge0 CE',
        endpoint: JUDGE0_URL,
        error: `Judge0 returned HTTP ${errStatus}: ${errText.slice(0, 200)}`
      };
    }
  } catch (err: any) {
    console.error(`[JUDGE0 ERROR]
HTTP status: null
Response body: none
Request URL: ${JUDGE0_URL}/about
Error message: ${err.message}`);

    return {
      reachable: false,
      status: null,
      provider: 'Judge0 CE',
      endpoint: JUDGE0_URL,
      error: err.message || 'Unable to connect to Judge0'
    };
  }
}

export function sanitizeTestCaseText(text: string | undefined | null): string {
  if (!text) return '';
  let cleaned = String(text).trim();

  // If the text contains a code block, try to extract the content INSIDE the code block
  const codeBlockMatch = cleaned.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // Fallback: strip markdown formatting if it wasn't a closed code block
    cleaned = cleaned.replace(/```[a-zA-Z]*/g, '').trim();
    cleaned = cleaned.replace(/\*\*[\s\S]*$/g, '').trim();
  }

  const forbiddenPhrases = [
    'The input contains',
    'Format:',
    'Input Format',
    'Output Format',
    'Constraints',
    'Print the sum',
    'Sample Input:',
    'Sample Output:',
    'Input:',
    'Output:',
    'Hidden test cases'
  ];

  for (const phrase of forbiddenPhrases) {
    if (cleaned.includes(phrase)) {
      const lines = cleaned.split('\n').filter(line => {
        const trimmed = line.trim();
        return !forbiddenPhrases.some(p => trimmed.toLowerCase().includes(p.toLowerCase()));
      });
      cleaned = lines.join('\n').trim();
    }
  }

  // DO NOT flatten numbers to spaces. Python `input()` expects exactly the right number of lines.
  // Normalize \r\n to \n
  cleaned = cleaned.replace(/\r\n/g, '\n');

  return cleaned;
}

export function normalizeOutput(out: string | null | undefined): string {
  if (out === undefined || out === null) return '';
  return String(out)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

export function normalizeCodeForLanguage(code: string, languageStr: string): string {
  if (!code) return '';
  const norm = (languageStr || '').trim().toLowerCase();

  if (norm.includes('java')) {
    // Ensure public class is named Main for Judge0 Java runner
    if (!code.includes('public class Main') && !code.includes('class Main')) {
      return code.replace(/public\s+class\s+([A-Za-z0-9_]+)/g, 'public class Main');
    }
  }

  return code;
}

export async function getSupportedLanguages(): Promise<Judge0Language[]> {
  const now = Date.now();
  if (cachedLanguages && now - lastFetchLanguagesTime < 5 * 60 * 1000) {
    return cachedLanguages;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${JUDGE0_URL}/languages`, {
      headers: getAuthHeaders(),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedLanguages = data.map((item: any) => ({
          id: Number(item.id),
          name: String(item.name)
        }));
        lastFetchLanguagesTime = Date.now();
        return cachedLanguages;
      }
    } else {
      const errText = await res.text().catch(() => '');
      console.error(`[JUDGE0 ERROR]
HTTP status: ${res.status}
Response body: ${errText}
Request URL: ${JUDGE0_URL}/languages
Error message: Failed to fetch languages list`);
    }
  } catch (err: any) {
    console.error(`[JUDGE0 ERROR]
HTTP status: null
Response body: none
Request URL: ${JUDGE0_URL}/languages
Error message: ${err.message}`);
  }

  // Known default Judge0 language IDs fallback if query fails
  return [
    { id: 109, name: 'Python (3.13.2)' },
    { id: 92, name: 'Python (3.11.2)' },
    { id: 91, name: 'Java (JDK 17.0.6)' },
    { id: 105, name: 'C++ (GCC 14.1.0)' },
    { id: 103, name: 'C (GCC 14.1.0)' },
    { id: 97, name: 'JavaScript (Node.js 20.17.0)' }
  ];
}

export async function getLanguageMapping(languageStr: string): Promise<{ id: number; name: string }> {
  const supported = await getSupportedLanguages();
  const norm = (languageStr || '').trim().toLowerCase();

  if (norm.includes('python') || norm.includes('py')) {
    // Check returned Python 3 language IDs (e.g. 109 = 3.13.2, 113 = 3.14.0, 100 = 3.12.5, 92 = 3.11.2)
    const py109 = supported.find(l => l.id === 109 || l.name.includes('3.13'));
    if (py109) return py109;
    const py113 = supported.find(l => l.id === 113 || l.name.includes('3.14'));
    if (py113) return py113;
    const py100 = supported.find(l => l.id === 100 || l.name.includes('3.12'));
    if (py100) return py100;
    const py92 = supported.find(l => l.id === 92 || l.name.includes('3.11'));
    if (py92) return py92;

    const anyPy3 = supported.find(l => {
      const name = l.name.toLowerCase();
      return name.includes('python') && !name.includes('2.7');
    });
    if (anyPy3) return anyPy3;
  }
  if (norm.includes('java') && !norm.includes('script')) {
    const foundJava = supported.find(l => l.id === 91) || supported.find(l => l.name.toLowerCase().startsWith('java (') && !l.name.toLowerCase().includes('script'));
    if (foundJava) return foundJava;
  }
  if (norm.includes('cpp') || norm.includes('c++')) {
    const foundCpp = supported.find(l => l.id === 105) || supported.find(l => l.name.toLowerCase().includes('c++ (gcc'));
    if (foundCpp) return foundCpp;
  }
  if (norm === 'c' || norm.startsWith('c (')) {
    const foundC = supported.find(l => l.id === 103) || supported.find(l => l.name.toLowerCase().startsWith('c (gcc'));
    if (foundC) return foundC;
  }
  if (norm.includes('javascript') || norm.includes('js') || norm.includes('node')) {
    const foundJs = supported.find(l => l.id === 97) || supported.find(l => l.name.toLowerCase().includes('20.') || l.name.toLowerCase().includes('18.'));
    if (foundJs) return foundJs;
  }

  return supported.find(l => l.id === 109) || supported.find(l => l.id === 92) || supported[0] || { id: 109, name: 'Python (3.13.2)' };
}

export async function getSubmissionResult(token: string): Promise<Judge0SubmissionResponse> {
  const res = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[JUDGE0 ERROR]
HTTP status: ${res.status}
Response body: ${errText}
Request URL: ${JUDGE0_URL}/submissions/${token}
Error message: Get submission token result failed`);
    throw new Error(`Judge0 fetch submission failed with HTTP ${res.status}`);
  }
  return await res.json();
}

async function pollSubmissionResult(token: string, maxWaitMs: number = 30000): Promise<Judge0SubmissionResponse> {
  const startTime = Date.now();
  const headers = getAuthHeaders();
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,status,time,memory,compile_output,message`, { headers });
      if (res.ok) {
        const data: Judge0SubmissionResponse = await res.json();
        if (data.status && data.status.id > 2) {
          return data;
        }
      } else {
        const errBody = await res.text().catch(() => '');
        console.error(`[JUDGE0 ERROR]
HTTP status: ${res.status}
Response body: ${errBody}
Request URL: ${JUDGE0_URL}/submissions/${token}
Error message: Polling submission token failed`);
      }
    } catch (err: any) {
      console.error(`[JUDGE0 ERROR]
HTTP status: null
Response body: none
Request URL: ${JUDGE0_URL}/submissions/${token}
Error message: ${err.message}`);
    }
  }
  throw new Error('Judge0 execution polling timed out after 30 seconds');
}

export async function executeCode(options: {
  code: string;
  language: string;
  input: string;
  expectedOutput?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  studentId?: string;
  contestId?: string;
  attemptId?: string;
  problemId?: string;
  testCaseId?: string;
}): Promise<SingleExecutionResult> {
  const { code, language, input, expectedOutput = '', timeLimitMs = 2000, memoryLimitMb = 256 } = options;
  const langObj = await getLanguageMapping(language);
  const normalizedCode = normalizeCodeForLanguage(code, language);
  const cleanInput = sanitizeTestCaseText(input);
  const cleanExpected = sanitizeTestCaseText(expectedOutput);

  let baseSec = (timeLimitMs || 2000) / 1000;
  if (langObj.name.toLowerCase().includes('python') || langObj.name.toLowerCase().includes('java')) {
    baseSec = Math.max(2.0, baseSec);
  }
  const cpuTimeLimitSec = Math.max(1.0, Math.min(10, baseSec));
  const memoryLimitKb = Math.max(1024, (memoryLimitMb || 256) * 1024);

  const payload: Judge0SubmissionPayload = {
    source_code: normalizedCode,
    language_id: langObj.id,
    stdin: cleanInput,
    expected_output: cleanExpected,
    cpu_time_limit: cpuTimeLimitSec,
    wall_time_limit: cpuTimeLimitSec + 3,
    memory_limit: memoryLimitKb,
    max_file_size: 1024
  };

  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(10000, timeLimitMs + 5000));

    const response = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[JUDGE0 ERROR]
HTTP status: ${response.status}
Response body: ${errText}
Request URL: ${JUDGE0_URL}/submissions?base64_encoded=false&wait=false
Error message: Submission POST request failed`);

      let errStatus: SingleExecutionResult['status'];
      if (response.status === 401) {
        errStatus = 'JUDGE0_AUTHENTICATION_REQUIRED';
      } else if (response.status === 403) {
        errStatus = 'JUDGE0_AUTHORIZATION_FAILED';
      } else if (response.status === 429) {
        errStatus = 'JUDGE0_RATE_LIMITED';
      } else if (response.status === 503) {
        errStatus = 'JUDGE0_QUEUE_UNAVAILABLE';
      } else {
        errStatus = 'EXECUTION_SERVICE_UNAVAILABLE';
      }

      return {
        status: errStatus,
        actualOutput: '',
        expectedOutput: normalizeOutput(cleanExpected),
        errorLog: `Execution error: HTTP ${response.status} (${errStatus})`,
        executionTimeMs: 0,
        memoryUsedMb: 0
      };
    }

    let judgeRes: Judge0SubmissionResponse = await response.json();

    if (judgeRes.token) {
      registerSubmissionToken({
        judge0Token: judgeRes.token,
        studentId: options.studentId,
        contestId: options.contestId,
        attemptId: options.attemptId,
        problemId: options.problemId,
        testCaseId: options.testCaseId
      });
    }

    if (judgeRes.token && (!judgeRes.status || judgeRes.status.id <= 2)) {
      judgeRes = await pollSubmissionResult(judgeRes.token, 30000);
    }

    const elapsedMs = Math.round(performance.now() - startTime);

    const actualOut = normalizeOutput(judgeRes.stdout);
    const expectedOut = normalizeOutput(cleanExpected);
    const compileOut = judgeRes.compile_output ? judgeRes.compile_output.trim() : undefined;
    const stderrOut = judgeRes.stderr ? judgeRes.stderr.trim() : undefined;
    const execTimeMs = judgeRes.time ? Math.round(parseFloat(judgeRes.time) * 1000) : elapsedMs;
    const memMb = judgeRes.memory ? +(judgeRes.memory / 1024).toFixed(1) : 12.0;

    const judgeStatusId = judgeRes.status?.id || 0;
    const judgeStatusDesc = judgeRes.status?.description || '';

    let status: SingleExecutionResult['status'];

    if (judgeStatusId === 3) {
      if (cleanExpected !== '') {
        status = actualOut === expectedOut ? 'ACCEPTED' : 'WRONG_ANSWER';
      } else {
        status = 'ACCEPTED';
      }
    } else if (judgeStatusId === 4) {
      status = 'WRONG_ANSWER';
    } else if (judgeStatusId === 5) {
      status = 'TIME_LIMIT_EXCEEDED';
    } else if (judgeStatusId === 6) {
      status = 'COMPILATION_ERROR';
    } else if (judgeStatusId >= 7 && judgeStatusId <= 12) {
      if (judgeStatusDesc.toLowerCase().includes('memory') || (stderrOut && stderrOut.toLowerCase().includes('memory'))) {
        status = 'MEMORY_LIMIT_EXCEEDED';
      } else {
        status = 'RUNTIME_ERROR';
      }
    } else {
      status = 'RUNTIME_ERROR';
    }

    const errorLog = compileOut || stderrOut || judgeRes.message || (status !== 'ACCEPTED' ? judgeStatusDesc : undefined);

    return {
      status,
      actualOutput: actualOut,
      expectedOutput: expectedOut,
      compileOutput: compileOut,
      errorLog,
      executionTimeMs: execTimeMs,
      memoryUsedMb: memMb,
      token: judgeRes.token
    };

  } catch (err: any) {
    console.error(`[JUDGE0 ERROR]
HTTP status: null
Response body: none
Request URL: ${JUDGE0_URL}/submissions?base64_encoded=false&wait=false
Error message: ${err.message}`);

    return {
      status: 'EXECUTION_SERVICE_UNAVAILABLE',
      actualOutput: '',
      expectedOutput: normalizeOutput(cleanExpected),
      errorLog: err.message || 'Execution service unavailable. Please retry.',
      executionTimeMs: 0,
      memoryUsedMb: 0
    };
  }
}

export function cleanTestCaseExpected(expected: string | null | undefined): string {
  if (!expected) return '';
  let str = String(expected);
  str = str.replace(/\*\*Hidden test cases are not displayed[^\*]*\*\*/gi, '');
  str = str.replace(/Hidden test cases are not displayed[^\n]*/gi, '');
  str = str.replace(/Note:[^\n]*/gi, '');
  return normalizeOutput(str);
}

async function pMap<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(items.length, limit) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runSampleTests(
  code: string,
  language: string,
  sampleTestCases: TestCase[],
  timeLimitMs?: number,
  memoryLimitMb?: number
): Promise<ExecutionResult> {
  let overallStatus: ExecutionResult['status'] = 'ACCEPTED';
  let maxTimeMs = 0;
  let maxMemMb = 0;
  let compileOutput: string | undefined;
  let firstErrorLog: string | undefined;

  const rawResults = await pMap(sampleTestCases, 8, async (tc) => {
    const cleanExp = cleanTestCaseExpected(tc.expectedOutput);
    const tcRes = await executeCode({
      code,
      language,
      input: tc.input,
      expectedOutput: cleanExp,
      timeLimitMs,
      memoryLimitMb
    });

    return {
      tc,
      tcRes
    };
  });

  const testCaseResults: TestCaseResult[] = [];

  for (const { tc, tcRes } of rawResults) {
    maxTimeMs = Math.max(maxTimeMs, tcRes.executionTimeMs);
    maxMemMb = Math.max(maxMemMb, tcRes.memoryUsedMb);

    if (!compileOutput && tcRes.compileOutput) {
      compileOutput = tcRes.compileOutput;
    }

    if (tcRes.status !== 'ACCEPTED') {
      if (!firstErrorLog && tcRes.errorLog) {
        firstErrorLog = tcRes.errorLog;
      }
      if (overallStatus === 'ACCEPTED') {
        overallStatus = tcRes.status;
      }
    }

    testCaseResults.push({
      testCaseId: tc.id,
      status: tcRes.status as any,
      actualOutput: tcRes.actualOutput || '(No output)',
      expectedOutput: cleanTestCaseExpected(tc.expectedOutput),
      error: tcRes.errorLog,
      executionTimeMs: tcRes.executionTimeMs,
      memoryUsedMb: tcRes.memoryUsedMb,
      isHidden: false
    });

    if (
      tcRes.status === 'EXECUTION_SERVICE_UNAVAILABLE' ||
      tcRes.status === 'JUDGE0_AUTHENTICATION_REQUIRED' ||
      tcRes.status === 'JUDGE0_AUTHORIZATION_FAILED' ||
      tcRes.status === 'JUDGE0_RATE_LIMITED' ||
      tcRes.status === 'JUDGE0_QUEUE_UNAVAILABLE'
    ) {
      overallStatus = tcRes.status;
    }
  }

  const passedCount = testCaseResults.filter(r => r.status === 'ACCEPTED').length;

  return {
    status: overallStatus,
    passedTests: passedCount,
    totalTests: sampleTestCases.length,
    score: sampleTestCases.length > 0 ? Math.round((passedCount / sampleTestCases.length) * 100) : 100,
    maxScore: 100,
    executionTimeMs: maxTimeMs,
    memoryUsedMb: maxMemMb,
    testCaseResults,
    errorLog: firstErrorLog || (overallStatus !== 'ACCEPTED' ? `Execution status: ${overallStatus}` : undefined),
    compileOutput
  };
}

export async function runHiddenTests(
  code: string,
  language: string,
  hiddenTestCases: TestCase[],
  timeLimitMs?: number,
  memoryLimitMb?: number
): Promise<ExecutionResult> {
  let overallStatus: ExecutionResult['status'] = 'ACCEPTED';
  let maxTimeMs = 0;
  let maxMemMb = 0;
  let compileOutput: string | undefined;
  let firstErrorLog: string | undefined;

  const rawResults = await pMap(hiddenTestCases, 8, async (tc) => {
    const cleanExp = cleanTestCaseExpected(tc.expectedOutput);
    const tcRes = await executeCode({
      code,
      language,
      input: tc.input,
      expectedOutput: cleanExp,
      timeLimitMs,
      memoryLimitMb
    });

    return {
      tc,
      tcRes
    };
  });

  const testCaseResults: TestCaseResult[] = [];

  for (const { tc, tcRes } of rawResults) {
    maxTimeMs = Math.max(maxTimeMs, tcRes.executionTimeMs);
    maxMemMb = Math.max(maxMemMb, tcRes.memoryUsedMb);

    if (!compileOutput && tcRes.compileOutput) {
      compileOutput = tcRes.compileOutput;
    }

    if (tcRes.status !== 'ACCEPTED') {
      if (!firstErrorLog && tcRes.errorLog) {
        firstErrorLog = tcRes.errorLog;
      }
      if (overallStatus === 'ACCEPTED') {
        overallStatus = tcRes.status;
      }
    }

    testCaseResults.push({
      testCaseId: tc.id,
      status: tcRes.status as any,
      actualOutput: '[HIDDEN TESTCASE]',
      expectedOutput: '[HIDDEN TESTCASE]',
      error: tcRes.status !== 'ACCEPTED' ? 'Execution failed on hidden test case' : undefined,
      executionTimeMs: tcRes.executionTimeMs,
      memoryUsedMb: tcRes.memoryUsedMb,
      isHidden: true
    });

    if (
      tcRes.status === 'EXECUTION_SERVICE_UNAVAILABLE' ||
      tcRes.status === 'JUDGE0_AUTHENTICATION_REQUIRED' ||
      tcRes.status === 'JUDGE0_AUTHORIZATION_FAILED' ||
      tcRes.status === 'JUDGE0_RATE_LIMITED' ||
      tcRes.status === 'JUDGE0_QUEUE_UNAVAILABLE'
    ) {
      overallStatus = tcRes.status;
    }
  }

  const passedCount = testCaseResults.filter(r => r.status === 'ACCEPTED').length;

  return {
    status: overallStatus,
    passedTests: passedCount,
    totalTests: hiddenTestCases.length,
    score: hiddenTestCases.length > 0 ? Math.round((passedCount / hiddenTestCases.length) * 100) : 100,
    maxScore: 100,
    executionTimeMs: maxTimeMs,
    memoryUsedMb: maxMemMb,
    testCaseResults,
    errorLog: firstErrorLog,
    compileOutput
  };
}

export async function runAllTests(
  code: string,
  language: string,
  allTestCases: TestCase[],
  timeLimitMs?: number,
  memoryLimitMb?: number
): Promise<ExecutionResult> {
  const visibleCases = allTestCases.filter(tc => !tc.isHidden);
  const hiddenCases = allTestCases.filter(tc => tc.isHidden);

  const visibleRes = await runSampleTests(code, language, visibleCases, timeLimitMs, memoryLimitMb);
  if (
    visibleRes.status === 'EXECUTION_SERVICE_UNAVAILABLE' ||
    visibleRes.status === 'JUDGE0_AUTHENTICATION_REQUIRED' ||
    visibleRes.status === 'JUDGE0_AUTHORIZATION_FAILED' ||
    visibleRes.status === 'JUDGE0_RATE_LIMITED' ||
    visibleRes.status === 'JUDGE0_QUEUE_UNAVAILABLE'
  ) {
    return visibleRes;
  }

  const hiddenRes = hiddenCases.length > 0
    ? await runHiddenTests(code, language, hiddenCases, timeLimitMs, memoryLimitMb)
    : {
        status: 'ACCEPTED' as const,
        passedTests: 0,
        totalTests: 0,
        score: 100,
        maxScore: 100,
        executionTimeMs: 0,
        memoryUsedMb: 0,
        testCaseResults: []
      };

  const combinedResults = [...visibleRes.testCaseResults, ...hiddenRes.testCaseResults];
  const passedCount = combinedResults.filter(r => r.status === 'ACCEPTED').length;
  const totalCount = allTestCases.length;

  let overallStatus: ExecutionResult['status'] = 'ACCEPTED';
  if (visibleRes.status !== 'ACCEPTED') {
    overallStatus = visibleRes.status;
  } else if (hiddenRes.status !== 'ACCEPTED') {
    overallStatus = hiddenRes.status;
  }

  return {
    status: overallStatus,
    passedTests: passedCount,
    totalTests: totalCount,
    score: totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 100,
    maxScore: 100,
    executionTimeMs: Math.max(visibleRes.executionTimeMs, hiddenRes.executionTimeMs),
    memoryUsedMb: Math.max(visibleRes.memoryUsedMb, hiddenRes.memoryUsedMb),
    testCaseResults: combinedResults,
    errorLog: visibleRes.errorLog || hiddenRes.errorLog,
    compileOutput: visibleRes.compileOutput || hiddenRes.compileOutput
  };
}

export async function checkJudge0Health(): Promise<{
  healthy: boolean;
  serviceUrl: string;
  error?: string;
  supportedLanguages: Judge0Language[];
}> {
  try {
    const supported = await getSupportedLanguages();
    if (supported.length > 0) {
      return {
        healthy: true,
        serviceUrl: JUDGE0_URL,
        supportedLanguages: supported
      };
    } else {
      return {
        healthy: false,
        serviceUrl: JUDGE0_URL,
        error: 'No supported languages returned by Judge0 endpoint',
        supportedLanguages: []
      };
    }
  } catch (err: any) {
    return {
      healthy: false,
      serviceUrl: JUDGE0_URL,
      error: err.message || 'Unable to connect to Judge0 endpoint',
      supportedLanguages: []
    };
  }
}
