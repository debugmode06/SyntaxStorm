import JSZip from 'jszip';
import { TestCase, Problem } from '../types';

export interface ParsedZipResult {
  testCases: TestCase[];
  sampleCount: number;
  hiddenCount: number;
  unmatchedFiles: string[];
  totalFiles: number;
  errors: string[];
}

export interface BulkZipProblemError {
  problemId: string;
  title: string;
  errors: string[];
}

export interface BulkZipImportResult {
  totalFound: number;
  validProblems: Problem[];
  invalidProblems: BulkZipProblemError[];
  securityWarnings: string[];
  totalFiles: number;
}

/**
 * Case-insensitive difficulty detection from metadata or folder/file paths/title/ID.
 * Priority 1: Explicit difficulty metadata (case-insensitive)
 * Priority 2: Folder name, folder path, problem ID, or problem title
 * Returns 'EASY' | 'MEDIUM' | 'HARD' if detected, or null if missing/undetermined.
 */
export function detectDifficulty(raw: any, folderPath?: string, title?: string): 'EASY' | 'MEDIUM' | 'HARD' | null {
  // Priority 1: Explicit metadata field (case-insensitive)
  const explicit = String(
    raw.difficulty || raw.difficultyLevel || raw.level || raw.diff || ''
  ).trim().toUpperCase();

  if (explicit) {
    if (explicit.includes('EASY')) return 'EASY';
    if (explicit.includes('MEDIUM') || explicit.includes('MED')) return 'MEDIUM';
    if (explicit.includes('HARD')) return 'HARD';
  }

  // Priority 2: Folder name, folder path, problem ID, or problem title
  const candidates = [
    folderPath || '',
    String(raw.folderName || ''),
    String(raw.folderPath || ''),
    String(raw.problemId || ''),
    String(raw.id || ''),
    title || '',
    String(raw.title || ''),
    String(raw.problemTitle || ''),
    String(raw.name || '')
  ];

  for (const str of candidates) {
    if (!str) continue;
    const lower = str.toLowerCase();

    // Check easy
    if (
      /\b(easy)\b/i.test(lower) ||
      /_easy_/i.test(lower) ||
      /^easy[_\-\s]/i.test(lower) ||
      /[_\-\s]easy$/i.test(lower) ||
      /[_\-\s]easy[_\-\s]/i.test(lower) ||
      lower.startsWith('easy') ||
      lower.includes('_easy') ||
      lower.includes('easy_')
    ) {
      return 'EASY';
    }

    // Check medium
    if (
      /\b(medium|med)\b/i.test(lower) ||
      /_medium_/i.test(lower) ||
      /^medium[_\-\s]/i.test(lower) ||
      /[_\-\s]medium$/i.test(lower) ||
      /[_\-\s]medium[_\-\s]/i.test(lower) ||
      lower.startsWith('medium') ||
      lower.includes('_medium') ||
      lower.includes('medium_')
    ) {
      return 'MEDIUM';
    }

    // Check hard
    if (
      /\b(hard)\b/i.test(lower) ||
      /_hard_/i.test(lower) ||
      /^hard[_\-\s]/i.test(lower) ||
      /[_\-\s]hard$/i.test(lower) ||
      /[_\-\s]hard[_\-\s]/i.test(lower) ||
      lower.startsWith('hard') ||
      lower.includes('_hard') ||
      lower.includes('hard_')
    ) {
      return 'HARD';
    }
  }

  return null;
}

// Dangerous extensions to reject for zip security
const EXECUTABLE_EXTENSIONS = [
  '.exe', '.sh', '.bat', '.cmd', '.pyc', '.dll', '.so', '.app', '.jar', '.vbs', '.ps1', '.elf', '.com'
];

/**
 * Validates zip filename against path traversal / zip slip attacks
 */
function isSafeZipPath(filename: string): boolean {
  if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
    return false;
  }
  return true;
}

/**
 * Checks if a file has a forbidden executable extension
 */
function isExecutableFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return EXECUTABLE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * Helper to strip code fences (```lang ... ``` or ``` ...) from text block
 */
function stripCodeFences(str: string): string {
  if (!str) return '';
  let s = str.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/\n?```$/, '');
  }
  return s.trim();
}

/**
 * Advanced extraction of test cases from Markdown or Plain Text content.
 * Handles headings (Sample Test Cases, Examples, Sample Input/Output),
 * code fences, numbered cases (Example 1, Sample Case 1), and inline Input/Output tags.
 */
function extractTestCasesFromText(text: string, problemId: string = 'p'): TestCase[] {
  const testCases: TestCase[] = [];
  if (!text) return testCases;

  const normalized = text.replace(/\r\n/g, '\n');

  // Strategy A: Check for embedded JSON block ```json ... ``` containing testcases
  const jsonBlockMatch = normalized.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]);
      const extracted = parseRawTestCasesArray(parsed, problemId);
      if (extracted.length > 0) return extracted;
    } catch {
      // Ignore JSON parse failure and fall through
    }
  }

  // Strategy B: Find all Input and Output block pairs in Markdown/Text
  // We search for markers indicating Input and Output sections.
  const inputRegex = /(?:^|\n)(?:#{1,6}\s*|\*{0,2})(?:Sample\s*)?(?:Test\s*Case\s*\d*|Case\s*\d*|Example\s*\d*|Input(?:\s*\d+)?)\*{0,2}:?\s*/gi;
  const outputRegex = /(?:^|\n)(?:#{1,6}\s*|\*{0,2})(?:Sample\s*)?(?:Output(?:\s*\d+)?|Expected\s*Output|Result|Ans)\*{0,2}:?\s*/gi;

  // Pattern for paired sections: "Input..." followed by "Output..."
  // Example matches:
  // Input:
  // ...
  // Output:
  // ...
  const pairPattern = /(?:(?:^|\n)(?:#{1,6}\s*|\*{0,2}|\d+\.\s*)(?:Sample\s*)?(?:Test\s*Case\s*\d*|Case\s*\d*|Example\s*\d*|Input(?:\s*\d+)?)\*{0,2}:?\s*)\n?([\s\S]*?)(?=(?:^|\n)(?:#{1,6}\s*|\*{0,2})(?:Sample\s*)?(?:Output(?:\s*\d+)?|Expected\s*Output|Result|Ans)\*{0,2}:?\s*)\n?(?:(?:#{1,6}\s*|\*{0,2})(?:Sample\s*)?(?:Output(?:\s*\d+)?|Expected\s*Output|Result|Ans)\*{0,2}:?\s*)\n?([\s\S]*?)(?=(?:^|\n)(?:#{1,6}\s*|\*{0,2})(?:Sample\s*)?(?:Test\s*Case\s*\d*|Case\s*\d*|Example\s*\d*|Input(?:\s*\d+)?|Explanation|Constraints|Note|##)|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = pairPattern.exec(normalized)) !== null) {
    const rawIn = match[1];
    const rawOut = match[2];

    const cleanIn = stripCodeFences(rawIn);
    const cleanOut = stripCodeFences(rawOut);

    if (cleanIn || cleanOut) {
      testCases.push({
        id: `tc-md-${problemId}-${testCases.length + 1}`,
        input: cleanIn,
        expectedOutput: cleanOut,
        isHidden: false,
        marks: 0
      });
    }
  }

  if (testCases.length > 0) return testCases;

  // Strategy C: Code fence block inspection
  // E.g.
  // ```
  // Input:
  // 5 3
  // 1 2 3 -4 5
  // Output:
  // 6
  // ```
  const codeBlockRegex = /```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```/gi;
  let codeBlockMatch: RegExpExecArray | null;
  while ((codeBlockMatch = codeBlockRegex.exec(normalized)) !== null) {
    const blockText = codeBlockMatch[1];
    if (/Input:/i.test(blockText) && /Output:/i.test(blockText)) {
      const parts = blockText.split(/Output:/i);
      if (parts.length >= 2) {
        const inStr = parts[0].replace(/Input:/i, '').trim();
        const outStr = parts[1].trim();
        testCases.push({
          id: `tc-block-${problemId}-${testCases.length + 1}`,
          input: stripCodeFences(inStr),
          expectedOutput: stripCodeFences(outStr),
          isHidden: false,
          marks: 0
        });
      }
    }
  }

  return testCases;
}

export function isDescriptiveText(str: string): boolean {
  if (!str) return true;
  const s = str.trim();
  if (s === '') return true;
  const patterns = [
    /^format:/i,
    /the input contains/i,
    /print the/i,
    /^constraints:/i,
    /^given/i,
    /input format/i,
    /output format/i,
    /standard input/i,
    /standard output/i,
    /sample input/i,
    /sample output/i,
    /number of elements/i,
    /space-separated/i
  ];
  return patterns.some(p => p.test(s));
}

/**
 * Normalizes an array or object of test cases from JSON objects.
 * Handles key variations: sampleTestCases, sample_test_cases, sampleTests, sample_tests, testCases, test_cases, examples, samples.
 */
function parseRawTestCasesArray(rawObj: any, problemId: string = 'p'): TestCase[] {
  const result: TestCase[] = [];
  if (!rawObj) return result;

  let list: any[] = [];
  if (Array.isArray(rawObj)) {
    list = rawObj;
  } else if (typeof rawObj === 'object') {
    list = rawObj.sampleTestCases || rawObj.sample_test_cases || rawObj.sampleTests ||
           rawObj.sample_tests || rawObj.testCases || rawObj.test_cases ||
           rawObj.examples || rawObj.samples || [];
  }

  if (!Array.isArray(list)) return result;

  list.forEach((item, idx) => {
    if (!item) return;
    const inputVal = String(item.input ?? item.in ?? item.sampleInput ?? item.sample_input ?? '').trim();
    const outputVal = String(item.expectedOutput ?? item.output ?? item.out ?? item.expected_output ?? item.sampleOutput ?? item.sample_output ?? '').trim();
    const isHidden = item.isHidden ?? item.is_hidden ?? (item.isSample === false ? true : false);
    const marks = Number(item.marks || item.points) || 0;
    const explanation = item.explanation || item.sampleExplanation || undefined;

    if (inputVal && outputVal && !isDescriptiveText(inputVal) && !isDescriptiveText(outputVal)) {
      result.push({
        id: item.id || `tc-json-${problemId}-${idx + 1}`,
        input: inputVal,
        expectedOutput: outputVal,
        isHidden: Boolean(isHidden),
        marks,
        explanation
      });
    }
  });

  return result;
}

/**
 * Parses markdown document for metadata fields and test cases.
 */
function parseMarkdown(md: string, problemId: string = 'p'): any {
  const data: any = {};
  if (!md) return data;

  const normalized = md.replace(/\r\n/g, '\n');

  // Title extraction from H1 or ## Title
  const h1Match = normalized.match(/^#\s+(.+)$/m);
  if (h1Match) {
    data.title = h1Match[1].trim();
  }

  const sections = [
    { key: 'title', regex: /(?:^|\n)#{1,3}\s*(?:Problem\s*)?Title\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'difficulty', regex: /(?:^|\n)#{1,3}\s*Difficulty\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'concepts', regex: /(?:^|\n)#{1,3}\s*Concepts\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'tags', regex: /(?:^|\n)#{1,3}\s*Tags\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'companyTags', regex: /(?:^|\n)#{1,3}\s*Company\s*Tags\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'description', regex: /(?:^|\n)#{1,3}\s*(?:Problem\s*)?(?:Description|Statement)\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'inputFormat', regex: /(?:^|\n)#{1,3}\s*Input\s*Format\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'outputFormat', regex: /(?:^|\n)#{1,3}\s*Output\s*Format\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'constraints', regex: /(?:^|\n)#{1,3}\s*Constraints\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'explanation', regex: /(?:^|\n)#{1,3}\s*Explanation\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'maximumMarks', regex: /(?:^|\n)#{1,3}\s*(?:Maximum\s*Marks|Points|Marks)\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'timeLimit', regex: /(?:^|\n)#{1,3}\s*Time\s*Limit\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i },
    { key: 'memoryLimit', regex: /(?:^|\n)#{1,3}\s*Memory\s*Limit\s*\n([\s\S]*?)(?=\n#{1,3}|$)/i }
  ];

  for (const sec of sections) {
    const match = normalized.match(sec.regex);
    if (match) {
      data[sec.key] = stripCodeFences(match[1].trim());
    }
  }

  // Extract test cases from Markdown text
  const extractedTCs = extractTestCasesFromText(normalized, problemId);
  if (extractedTCs.length > 0) {
    data.sampleTestCases = extractedTCs;
  }

  return data;
}

function parseMetadataTxt(txt: string): any {
  const data: any = {};
  if (!txt) return data;

  const lines = txt.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim().toLowerCase().replace(/_/g, '');
      const val = line.substring(colonIdx + 1).trim();
      if (key === 'problemid' || key === 'id') data.problemId = val;
      else if (key === 'title' || key === 'name') data.title = val;
      else if (key === 'difficulty') data.difficulty = val;
      else if (key === 'concepts') data.concepts = val;
      else if (key === 'tags') data.tags = val;
      else if (key === 'companytags' || key === 'company') data.companyTags = val;
      else if (key === 'maximummarks' || key === 'marks' || key === 'points') data.maximumMarks = val;
      else if (key === 'timelimit' || key === 'timelimitms') data.timeLimitMs = val;
      else if (key === 'memorylimit' || key === 'memorylimitmb') data.memoryLimitMb = val;
    }
  }
  return data;
}

/**
 * Extracts and pairs test cases from a ZIP archive for a single problem.
 */
export async function parseTestCasesFromZip(
  fileOrBuffer: File | ArrayBuffer,
  markFirstAsSample: number = 2
): Promise<ParsedZipResult> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(fileOrBuffer);

  const fileMap = new Map<string, string>();
  const allFileNames: string[] = [];

  // Read all text files from ZIP
  const entries = Object.keys(loadedZip.files);
  for (const filename of entries) {
    if (!isSafeZipPath(filename) || isExecutableFile(filename)) {
      continue;
    }
    const entry = loadedZip.files[filename];
    if (entry.dir || filename.startsWith('__MACOSX/') || filename.startsWith('.')) {
      continue;
    }
    allFileNames.push(filename);
    try {
      const content = await entry.async('string');
      fileMap.set(filename, content.replace(/\r\n/g, '\n').trim());
    } catch (e) {
      console.warn(`Failed reading file in zip: ${filename}`, e);
    }
  }

  const testCases: TestCase[] = [];
  const processedFiles = new Set<string>();
  const errors: string[] = [];

  // 1. Check for testcases.json
  const jsonKey = Array.from(fileMap.keys()).find(
    k => k.toLowerCase().endsWith('testcases.json') || k.toLowerCase().endsWith('tests.json')
  );
  if (jsonKey) {
    try {
      const rawJson = JSON.parse(fileMap.get(jsonKey) || '[]');
      const parsedTCs = parseRawTestCasesArray(rawJson, 'single-zip');
      parsedTCs.forEach((tc, idx) => {
        tc.isHidden = idx >= markFirstAsSample;
        testCases.push(tc);
      });
      processedFiles.add(jsonKey);
    } catch (e: any) {
      errors.push(`Failed parsing testcases.json: ${e.message}`);
    }
  }

  // 2. Identify paired input/output files
  const keys = Array.from(fileMap.keys()).filter(k => !processedFiles.has(k));

  const inputRegexes = [
    /^(?:.*\/)?(?:sample_)?(?:input|in)[-_]?(\d+|[a-zA-Z0-9_-]+)\.(?:txt|in|dat)$/i,
    /^(?:.*\/)?(\d+|[a-zA-Z0-9_-]+)[-_]?(?:input|in)\.(?:txt|in|dat)$/i,
    /^(?:.*\/)?(?:inputs|sample_inputs|samples)\/(\d+|[a-zA-Z0-9_-]+)\.(?:txt|in|dat)$/i,
    /^(?:.*\/)?(\d+|[a-zA-Z0-9_-]+)\.in$/i
  ];

  const outputRegexes = [
    /^(?:.*\/)?(?:sample_)?(?:output|out|ans|sol)[-_]?(\d+|[a-zA-Z0-9_-]+)\.(?:txt|out|ans|sol|dat)$/i,
    /^(?:.*\/)?(\d+|[a-zA-Z0-9_-]+)[-_]?(?:output|out|ans|sol)\.(?:txt|out|ans|sol|dat)$/i,
    /^(?:.*\/)?(?:outputs|sample_outputs|samples)\/(\d+|[a-zA-Z0-9_-]+)\.(?:txt|out|ans|sol|dat)$/i,
    /^(?:.*\/)?(\d+|[a-zA-Z0-9_-]+)\.out$/i
  ];

  const inputEntries: { filename: string; token: string; isSample: boolean }[] = [];
  const outputEntries: { filename: string; token: string }[] = [];

  for (const filename of keys) {
    const isSample = filename.toLowerCase().includes('sample') || filename.toLowerCase().includes('example');
    let matchedInput = false;

    for (const r of inputRegexes) {
      const match = filename.match(r);
      if (match) {
        inputEntries.push({ filename, token: match[1] || filename, isSample });
        matchedInput = true;
        break;
      }
    }

    if (!matchedInput) {
      for (const r of outputRegexes) {
        const match = filename.match(r);
        if (match) {
          outputEntries.push({ filename, token: match[1] || filename });
          break;
        }
      }
    }
  }

  inputEntries.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));

  inputEntries.forEach((inEntry, idx) => {
    const outEntry = outputEntries.find(o => o.token === inEntry.token || (
      o.filename.replace(/output|out|ans|sol/i, 'input').toLowerCase() === inEntry.filename.toLowerCase() ||
      o.filename.replace(/\.out$/i, '.in').toLowerCase() === inEntry.filename.toLowerCase()
    ));

    const inputContent = fileMap.get(inEntry.filename) || '';
    let outputContent = '';

    if (outEntry) {
      outputContent = fileMap.get(outEntry.filename) || '';
      processedFiles.add(inEntry.filename);
      processedFiles.add(outEntry.filename);
    } else if (outputEntries[idx]) {
      outputContent = fileMap.get(outputEntries[idx].filename) || '';
      processedFiles.add(inEntry.filename);
      processedFiles.add(outputEntries[idx].filename);
    } else {
      processedFiles.add(inEntry.filename);
    }

    const isHidden = inEntry.isSample ? false : (testCases.length >= markFirstAsSample);

    testCases.push({
      id: `tc-zip-${Date.now()}-${testCases.length + 1}`,
      input: inputContent,
      expectedOutput: outputContent,
      isHidden,
      marks: 10,
      explanation: inEntry.isSample ? `Sample testcase from ${inEntry.filename}` : undefined
    });
  });

  // Fallback: If no testcases found, check if text files have testcases inside text
  if (testCases.length === 0) {
    for (const [fname, content] of fileMap.entries()) {
      if (fname.endsWith('.md') || fname.endsWith('.txt')) {
        const extracted = extractTestCasesFromText(content, 'zip');
        if (extracted.length > 0) {
          testCases.push(...extracted);
          break;
        }
      }
    }
  }

  const unmatchedFiles = allFileNames.filter(f => !processedFiles.has(f));
  const sampleCount = testCases.filter(t => !t.isHidden).length;
  const hiddenCount = testCases.filter(t => t.isHidden).length;

  return {
    testCases,
    sampleCount,
    hiddenCount,
    unmatchedFiles,
    totalFiles: allFileNames.length,
    errors
  };
}

/**
 * Bulk ZIP Problem Parser with Security Verification & Structural Extraction.
 * Handles ZIP archives containing 50-70+ problems with folders or problems.json.
 */
export async function parseBulkProblemsZip(
  fileOrBuffer: File | ArrayBuffer
): Promise<BulkZipImportResult> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(fileOrBuffer);

  const fileMap = new Map<string, string>();
  const securityWarnings: string[] = [];
  const entries = Object.keys(loadedZip.files);

  let totalFiles = 0;

  for (const filename of entries) {
    totalFiles++;
    if (!isSafeZipPath(filename)) {
      securityWarnings.push(`Blocked Zip Slip attempt or unsafe path: "${filename}"`);
      continue;
    }
    if (isExecutableFile(filename)) {
      securityWarnings.push(`Ignored potentially executable binary file: "${filename}"`);
      continue;
    }

    const entry = loadedZip.files[filename];
    if (entry.dir || filename.startsWith('__MACOSX/') || filename.startsWith('.')) {
      continue;
    }

    try {
      const content = await entry.async('string');
      fileMap.set(filename, content.replace(/\r\n/g, '\n').trim());
    } catch (e) {
      console.warn(`Failed reading text file: ${filename}`, e);
    }
  }

  const rawProblemsList: any[] = [];
  const invalidProblems: BulkZipProblemError[] = [];

  // Strategy 1: Look for root/subfolder problems.json or problems_bank.json
  const problemsJsonKeys = Array.from(fileMap.keys()).filter(
    k => k.toLowerCase().endsWith('problems.json') || k.toLowerCase().endsWith('problems_bank.json')
  );

  for (const jsonKey of problemsJsonKeys) {
    try {
      const parsed = JSON.parse(fileMap.get(jsonKey) || '[]');
      if (Array.isArray(parsed)) {
        rawProblemsList.push(...parsed);
      }
    } catch (e: any) {
      invalidProblems.push({
        problemId: 'ZIP-JSON-ROOT',
        title: `Syntax error in ${jsonKey}`,
        errors: [`JSON syntax error in ${jsonKey}: ${e.message}`]
      });
    }
  }

  // Strategy 2: Distinct problem folders discovery
  // Identify canonical problem directories (parent of problem definition files or testcase directories)
  const problemRoots = new Set<string>();

  for (const k of Array.from(fileMap.keys())) {
    if (problemsJsonKeys.includes(k)) continue;

    // Direct indicators of a problem directory
    const isProblemDefFile = /(?:^|\/)(challenge\.json|problem\.json|metadata\.json|problem_statement\.txt|problem\.txt|problem\.md|statement\.md|description\.txt)$/i.test(k);
    if (isProblemDefFile) {
      const lastSlash = k.lastIndexOf('/');
      const folder = lastSlash === -1 ? '' : k.substring(0, lastSlash + 1);
      problemRoots.add(folder);
      continue;
    }

    // Input/output folders: parent of input/output is the problem folder
    const inOutMatch = k.match(/^(.*\/)?(?:in|input|inputs|out|output|outputs|ans|samples|testcases)\//i);
    if (inOutMatch) {
      const folder = inOutMatch[1] || '';
      problemRoots.add(folder);
      continue;
    }
  }

  let problemCounter = 1;

  for (const folderPath of Array.from(problemRoots)) {
    try {
      // ISOLATION: Fresh isolated object per problem folder
      const detectedSourceFiles: string[] = [];
      const folderSegment = folderPath.replace(/\/$/, '').split('/').pop() || `P${String(problemCounter).padStart(3, '0')}`;
      const defaultId = folderSegment;

      let pData: any = {
        id: defaultId,
        problemId: defaultId,
        folderPath,
        folderName: folderSegment
      };

      // ----------------------------------------------------
      // PARSER PRIORITY:
      // 1. Explicit machine-readable challenge.json
      // 2. Explicit problem_statement.txt
      // 3. Explicit problem.txt
      // 4. Structured markdown problem.md / statement.md / README.md
      // 5. Dedicated spec files: input_format.txt, output_format.txt, constraints.txt, description.txt
      // ----------------------------------------------------

      // Priority 1: challenge.json
      const challengeJsonKey = Array.from(fileMap.keys()).find(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return relative === 'challenge.json' || relative.endsWith('/challenge.json');
      });

      if (challengeJsonKey) {
        detectedSourceFiles.push(challengeJsonKey);
        try {
          const parsed = JSON.parse(fileMap.get(challengeJsonKey) || '{}');
          Object.assign(pData, parsed);
        } catch {
          // ignore
        }
      }

      // Priority 2: Explicit problem_statement.txt
      const probStatementKey = Array.from(fileMap.keys()).find(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return relative === 'problem_statement.txt' || relative.endsWith('/problem_statement.txt');
      });

      if (probStatementKey) {
        detectedSourceFiles.push(probStatementKey);
        const stmtContent = fileMap.get(probStatementKey) || '';
        if (stmtContent.trim()) {
          pData.problemStatement = stmtContent.trim();
          if (!pData.description) {
            const firstPara = stmtContent.trim().split('\n\n')[0].trim();
            pData.description = firstPara || stmtContent.trim();
          }
        }
      }

      // Priority 3: Explicit problem.txt
      if (!pData.problemStatement) {
        const probTxtKey = Array.from(fileMap.keys()).find(k => {
          if (!k.startsWith(folderPath)) return false;
          const relative = k.substring(folderPath.length).toLowerCase();
          return relative === 'problem.txt' || relative.endsWith('/problem.txt');
        });
        if (probTxtKey) {
          detectedSourceFiles.push(probTxtKey);
          const txtContent = fileMap.get(probTxtKey) || '';
          if (txtContent.trim()) {
            pData.problemStatement = txtContent.trim();
            if (!pData.description) {
              const firstPara = txtContent.trim().split('\n\n')[0].trim();
              pData.description = firstPara || txtContent.trim();
            }
          }
        }
      }

      // Priority 4: Markdown problem.md / statement.md / readme.md
      const mdKey = Array.from(fileMap.keys()).find(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return relative === 'problem.md' || relative === 'statement.md' || relative === 'readme.md' ||
               relative.endsWith('/problem.md') || relative.endsWith('/statement.md') || relative.endsWith('/readme.md');
      });

      if (mdKey) {
        detectedSourceFiles.push(mdKey);
        const mdData = parseMarkdown(fileMap.get(mdKey) || '', defaultId);
        if (mdData.title && !pData.title) pData.title = mdData.title;
        if (mdData.problemStatement && !pData.problemStatement) pData.problemStatement = mdData.problemStatement;
        if (mdData.description && !pData.description) pData.description = mdData.description;
        if (mdData.inputFormat && !pData.inputFormat) pData.inputFormat = mdData.inputFormat;
        if (mdData.outputFormat && !pData.outputFormat) pData.outputFormat = mdData.outputFormat;
        if (mdData.constraints && !pData.constraints) pData.constraints = mdData.constraints;
      }

      // Priority 5: Dedicated format files
      // DO NOT use input_format.txt, output_format.txt, constraints.txt as problemStatement or description!
      const inputFormatKey = Array.from(fileMap.keys()).find(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return relative === 'input_format.txt' || relative === 'inputformat.txt' || relative.endsWith('/input_format.txt');
      });
      if (inputFormatKey) {
        detectedSourceFiles.push(inputFormatKey);
        pData.inputFormat = fileMap.get(inputFormatKey)!.trim();
      }

      const outputFormatKey = Array.from(fileMap.keys()).find(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return relative === 'output_format.txt' || relative === 'outputformat.txt' || relative.endsWith('/output_format.txt');
      });
      if (outputFormatKey) {
        detectedSourceFiles.push(outputFormatKey);
        pData.outputFormat = fileMap.get(outputFormatKey)!.trim();
      }

      const constraintsKey = Array.from(fileMap.keys()).find(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return relative === 'constraints.txt' || relative.endsWith('/constraints.txt');
      });
      if (constraintsKey) {
        detectedSourceFiles.push(constraintsKey);
        pData.constraints = fileMap.get(constraintsKey)!.trim();
      }

      const descKey = Array.from(fileMap.keys()).find(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return relative === 'description.txt' || relative.endsWith('/description.txt');
      });
      if (descKey) {
        detectedSourceFiles.push(descKey);
        pData.description = fileMap.get(descKey)!.trim();
      }

      // Secondary metadata.json or problem.json
      const metaKey = Array.from(fileMap.keys()).find(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return (relative === 'problem.json' || relative === 'metadata.json' ||
                relative.endsWith('/problem.json') || relative.endsWith('/metadata.json')) &&
                !problemsJsonKeys.includes(k);
      });
      if (metaKey) {
        detectedSourceFiles.push(metaKey);
        try {
          const parsed = JSON.parse(fileMap.get(metaKey) || '{}');
          if (!pData.title && (parsed.title || parsed.name)) pData.title = parsed.title || parsed.name;
          if (!pData.difficulty && parsed.difficulty) pData.difficulty = parsed.difficulty;
          if (!pData.description && parsed.description) pData.description = parsed.description;
          if (!pData.problemStatement && (parsed.problemStatement || parsed.statement)) pData.problemStatement = parsed.problemStatement || parsed.statement;
          if (!pData.inputFormat && parsed.inputFormat) pData.inputFormat = parsed.inputFormat;
          if (!pData.outputFormat && parsed.outputFormat) pData.outputFormat = parsed.outputFormat;
          if (!pData.constraints && parsed.constraints) pData.constraints = parsed.constraints;
          if (!pData.sampleTestCases && parsed.sampleTestCases) pData.sampleTestCases = parsed.sampleTestCases;
          if (!pData.hiddenTestCases && parsed.hiddenTestCases) pData.hiddenTestCases = parsed.hiddenTestCases;
        } catch {
          // ignore
        }
      }

      if (!pData.title) {
        const cleaned = folderSegment.replace(/^\d+[\-_]*/, '').replace(/^(easy|medium|hard)[\-_]*/i, '').replace(/[\-_]+/g, ' ').trim();
        pData.title = cleaned || `Problem ${folderSegment}`;
      }

      if (!pData.description && pData.problemStatement) {
        pData.description = pData.problemStatement.split('\n\n')[0].trim() || pData.problemStatement;
      }
      if (!pData.problemStatement && pData.description) {
        pData.problemStatement = pData.description;
      }

      // Extract testcase files in this problem folder
      const folderInputs = Array.from(fileMap.keys()).filter(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return (
          relative.includes('/input/') || relative.includes('/in/') || relative.includes('/inputs/') || relative.includes('/samples/') ||
          relative.startsWith('input/') || relative.startsWith('in/') || relative.startsWith('inputs/') || relative.startsWith('samples/') ||
          relative.endsWith('.in')
        ) && !relative.endsWith('.md') && !relative.endsWith('.json') && !relative.endsWith('.txt');
      }).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const folderOutputs = Array.from(fileMap.keys()).filter(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length).toLowerCase();
        return (
          relative.includes('/output/') || relative.includes('/out/') || relative.includes('/outputs/') || relative.includes('/ans/') ||
          relative.startsWith('output/') || relative.startsWith('out/') || relative.startsWith('outputs/') || relative.startsWith('ans/') ||
          relative.endsWith('.out') || relative.endsWith('.ans') || relative.endsWith('.sol')
        ) && !relative.endsWith('.md') && !relative.endsWith('.json') && !relative.endsWith('.txt');
      }).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const extractedSampleTCs: TestCase[] = [];
      const extractedHiddenTCs: TestCase[] = [];

      folderInputs.forEach((inKey, idx) => {
        const basename = inKey.split('/').pop() || '';
        const tokenMatch = basename.match(/(\d+)/);
        const token = tokenMatch ? tokenMatch[1] : basename;

        let expectedOutKey = folderOutputs.find(oKey => {
          const oBase = oKey.split('/').pop() || '';
          return (
            oBase.includes(token) ||
            oKey.replace(/output|out|ans|sol/i, 'input').toLowerCase() === inKey.replace(/output|out|ans|sol/i, 'input').toLowerCase() ||
            oKey.replace(/\.(out|sol|ans)$/i, '.in').toLowerCase() === inKey.replace(/\.(txt|in|dat)$/i, '.in').toLowerCase()
          );
        });

        if (!expectedOutKey && folderOutputs[idx]) {
          expectedOutKey = folderOutputs[idx];
        }

        if (expectedOutKey) {
          const inContent = fileMap.get(inKey) || '';
          const outContent = fileMap.get(expectedOutKey) || '';
          if (inContent.trim() && outContent.trim()) {
            const isSample = inKey.toLowerCase().includes('sample') || expectedOutKey.toLowerCase().includes('sample') || idx < 2;
            const tc: TestCase = {
              id: `tc-folder-${defaultId}-${idx + 1}`,
              input: inContent,
              expectedOutput: outContent,
              isHidden: !isSample,
              marks: 0
            };
            if (isSample) extractedSampleTCs.push(tc);
            else extractedHiddenTCs.push(tc);
          }
        }
      });

      if (!pData.sampleTestCases || pData.sampleTestCases.length === 0) {
        pData.sampleTestCases = extractedSampleTCs;
      }
      if (!pData.hiddenTestCases || pData.hiddenTestCases.length === 0) {
        pData.hiddenTestCases = extractedHiddenTCs;
      }

      pData.detectedSourceFiles = detectedSourceFiles;
      rawProblemsList.push(pData);
      problemCounter++;
    } catch (e: any) {
      invalidProblems.push({
        problemId: folderPath,
        title: folderPath,
        errors: [`Failed parsing problem folder: ${e.message}`]
      });
    }
  }

  // Process & Validate every extracted problem object
  const validProblems: Problem[] = [];

  rawProblemsList.forEach((raw, idx) => {
    const folderName = String(raw.problemId || raw.id || `P${String(idx + 1).padStart(3, '0')}`).trim();
    const pId = String(raw.problemId || raw.id || raw.problem_id || folderName).trim();

    let title = String(raw.title || raw.problemTitle || raw.name || raw.problem_name || '').trim();
    if (!title) {
      title = `Problem ${pId.replace(/^P0*/, '') || (idx + 1)}`;
    }

    const errors: string[] = [];

    // Parse difficulty (strictly EASY, MEDIUM, HARD; NO defaulting)
    const detectedDiff = detectDifficulty(raw, raw.folderPath, title);
    if (!detectedDiff) {
      errors.push(`Difficulty is missing or invalid. Allowed: EASY, MEDIUM, HARD. Source files: [${(raw.detectedSourceFiles || []).join(', ')}]`);
    }
    const difficulty: 'EASY' | 'MEDIUM' | 'HARD' = detectedDiff || 'MEDIUM';

    // Strict scoring per difficulty: Easy 10 (5x2), Medium 15 (5x3), Hard 25 (5x5)
    const maxMarks = difficulty === 'EASY' ? 10 : difficulty === 'HARD' ? 25 : 15;
    const marksPerCase = difficulty === 'EASY' ? 2 : difficulty === 'HARD' ? 5 : 3;

    // Strict field presence checks
    const description = String(raw.description || '').trim();
    const problemStatement = String(raw.problemStatement || '').trim();
    const inputFormat = String(raw.inputFormat || '').trim();
    const outputFormat = String(raw.outputFormat || '').trim();
    const constraints = String(raw.constraints || '').trim();

    if (!description) errors.push('description is required');
    if (!problemStatement) errors.push('problemStatement is required');
    if (!inputFormat) errors.push('inputFormat is required');
    if (!outputFormat) errors.push('outputFormat is required');
    if (!constraints) errors.push('constraints is required');

    // Collect Sample Test Cases
    let sampleTestCases: TestCase[] = [];
    if (Array.isArray(raw.sampleTestCases) && raw.sampleTestCases.length > 0) {
      sampleTestCases = parseRawTestCasesArray(raw.sampleTestCases, pId);
    } else if (Array.isArray(raw.sample_test_cases) && raw.sample_test_cases.length > 0) {
      sampleTestCases = parseRawTestCasesArray(raw.sample_test_cases, pId);
    } else if (Array.isArray(raw.sampleTests) && raw.sampleTests.length > 0) {
      sampleTestCases = parseRawTestCasesArray(raw.sampleTests, pId);
    } else if (Array.isArray(raw.examples) && raw.examples.length > 0) {
      sampleTestCases = parseRawTestCasesArray(raw.examples, pId);
    }

    // Collect Hidden Test Cases
    let hiddenTestCases: TestCase[] = [];
    if (Array.isArray(raw.hiddenTestCases) && raw.hiddenTestCases.length > 0) {
      hiddenTestCases = parseRawTestCasesArray(raw.hiddenTestCases, pId);
    } else if (Array.isArray(raw.hidden_test_cases) && raw.hidden_test_cases.length > 0) {
      hiddenTestCases = parseRawTestCasesArray(raw.hidden_test_cases, pId);
    } else if (Array.isArray(raw.testCases || raw.test_cases)) {
      const allTCs = parseRawTestCasesArray(raw.testCases || raw.test_cases, pId);
      allTCs.forEach(tc => {
        if (tc.isHidden) hiddenTestCases.push(tc);
        else if (sampleTestCases.length < 2) sampleTestCases.push(tc);
        else hiddenTestCases.push(tc);
      });
    }

    let finalSample: TestCase[] = [];
    let finalHidden: TestCase[] = [];

    if (sampleTestCases.length >= 2 && hiddenTestCases.length >= 3) {
      finalSample = sampleTestCases.slice(0, 2);
      finalHidden = hiddenTestCases.slice(0, 3);
    } else {
      const combined = [...sampleTestCases, ...hiddenTestCases];
      if (combined.length >= 5) {
        finalSample = combined.slice(0, 2);
        finalHidden = combined.slice(2, 5);
      }
    }

    if (finalSample.length !== 2) {
      errors.push(`sampleTestCases: found ${finalSample.length}, exactly 2 required.`);
    }
    if (finalHidden.length !== 3) {
      errors.push(`hiddenTestCases: found ${finalHidden.length}, exactly 3 required.`);
    }

    // Assign marks
    finalSample = finalSample.map((t, i) => ({
      ...t,
      id: `tc-sample-${pId}-${i + 1}`,
      marks: marksPerCase,
      isHidden: false
    }));

    finalHidden = finalHidden.map((t, i) => ({
      ...t,
      id: `tc-hidden-${pId}-${i + 1}`,
      marks: marksPerCase,
      isHidden: true
    }));

    if (errors.length > 0) {
      invalidProblems.push({
        problemId: pId,
        title: title || `Problem #${idx + 1}`,
        errors
      });
    } else {
      const slug = String(raw.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();

      // Concepts & Tags
      let concepts: string[] = ['Algorithms'];
      if (Array.isArray(raw.concepts) && raw.concepts.length > 0) concepts = raw.concepts;
      else if (Array.isArray(raw.tags) && raw.tags.length > 0) concepts = raw.tags;

      let companyTags: string[] = [];
      if (Array.isArray(raw.companyTags)) companyTags = raw.companyTags;

      const validProb: Problem = {
        id: pId,
        title,
        slug,
        description,
        problemStatement,
        inputFormat,
        outputFormat,
        constraints,
        difficulty,
        category: raw.category || concepts[0] || 'Algorithms',
        concepts,
        companyTags,
        tags: concepts,
        points: maxMarks,
        maximumMarks: maxMarks,
        timeLimitMs: Number(raw.timeLimitMs || 1000),
        memoryLimitMb: Number(raw.memoryLimitMb || 256),
        sampleTestCases: finalSample,
        hiddenTestCases: finalHidden,
        explanation: raw.explanation || '',
        languages: ['python', 'javascript', 'cpp', 'c', 'java'],
        status: 'PUBLISHED',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      validProblems.push(validProb);
    }
  });

  return {
    totalFound: rawProblemsList.length,
    validProblems,
    invalidProblems,
    securityWarnings,
    totalFiles
  };
}

/**
 * Creates a sample test case ZIP download for contest managers as a reference.
 */
export async function generateSampleTestCaseZip(): Promise<Blob> {
  const zip = new JSZip();
  zip.file('input00.txt', '5 3\n1 2 3 -4 5');
  zip.file('output00.txt', '6');
  zip.file('input01.txt', '4 2\n-2 -3 -1 -5');
  zip.file('output01.txt', '-1');
  zip.file('input02.txt', '6 4\n10 -5 20 -15 30 -5');
  zip.file('output02.txt', '45');
  zip.file('input03.txt', '5 2\n-10 20 -5 15 -1');
  zip.file('output03.txt', '30');
  zip.file('README.txt', 'Place your input files (input00.txt, input01.txt...) and output files (output00.txt, output01.txt...) in this zip archive.');

  return await zip.generateAsync({ type: 'blob' });
}
