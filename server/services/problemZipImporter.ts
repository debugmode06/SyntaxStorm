import JSZip from 'jszip';
import { Challenge } from '../models/index.ts';
import { db as originalDb } from '../proxy.ts';

export interface ProblemImportError {
  problemId: string;
  problemName: string;
  reason: string;
}

export interface ImportReport {
  success: boolean;
  totalDiscovered: number;
  validCount: number;
  importedCount: number;
  failedCount: number;
  difficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
  testCases: {
    visible: number;
    hidden: number;
    total: number;
  };
  failedProblems: ProblemImportError[];
  databaseVerification: {
    beforeCount: number;
    afterCount: number;
    netAdded: number;
  };
  securityWarnings: string[];
}

const EXECUTABLE_EXTENSIONS = [
  '.exe', '.sh', '.bat', '.cmd', '.pyc', '.dll', '.so', '.app', '.jar', '.vbs', '.ps1', '.elf', '.com'
];

function isSafeZipPath(filename: string): boolean {
  if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
    return false;
  }
  return true;
}

function isExecutableFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return EXECUTABLE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * Strictly detect difficulty. Returns ONLY 'EASY' | 'MEDIUM' | 'HARD' or null.
 * Never defaults.
 */
export function detectStrictDifficulty(raw: any, folderPath?: string, title?: string): 'EASY' | 'MEDIUM' | 'HARD' | null {
  const explicit = String(
    raw.difficulty || raw.difficultyLevel || raw.level || raw.diff || ''
  ).trim().toUpperCase();

  if (explicit === 'EASY') return 'EASY';
  if (explicit === 'MEDIUM' || explicit === 'MED') return 'MEDIUM';
  if (explicit === 'HARD') return 'HARD';

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
    if (/\b(easy)\b/i.test(lower) || /[\/\-_]easy[\/\-_]/i.test(lower) || lower.endsWith('/easy') || lower.startsWith('easy/')) {
      return 'EASY';
    }
    if (/\b(medium|med)\b/i.test(lower) || /[\/\-_](medium|med)[\/\-_]/i.test(lower) || lower.endsWith('/medium') || lower.startsWith('medium/')) {
      return 'MEDIUM';
    }
    if (/\b(hard)\b/i.test(lower) || /[\/\-_]hard[\/\-_]/i.test(lower) || lower.endsWith('/hard') || lower.startsWith('hard/')) {
      return 'HARD';
    }
  }

  return null;
}

/**
 * Validate that test case input is actual runtime data, NOT problem description boilerplate.
 */
export function isValidRuntimeTestData(data: string): boolean {
  if (!data || typeof data !== 'string') return false;
  const trimmed = data.trim();
  if (!trimmed) return false;

  const forbiddenPatterns = [
    /^input format/i,
    /^output format/i,
    /^constraints/i,
    /^problem statement/i,
    /^explanation/i,
    /^the input contains/i,
    /^the first line contains/i,
    /^given an array/i,
    /^sample input/i,
    /^sample output/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(trimmed)) return false;
  }

  return true;
}

/**
 * Extract structured sections from Markdown content
 */
function parseMarkdownSections(mdContent: string): {
  title?: string;
  problemStatement?: string;
  description?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
} {
  const result: {
    title?: string;
    problemStatement?: string;
    description?: string;
    inputFormat?: string;
    outputFormat?: string;
    constraints?: string;
  } = {};

  const lines = mdContent.split('\n');
  const titleMatch = mdContent.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  }

  let currentSection = 'statement';
  const sectionBuffers: Record<string, string[]> = {
    statement: [],
    inputFormat: [],
    outputFormat: [],
    constraints: []
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (line.startsWith('#') && !line.startsWith('# ')) {
      const lower = trimmed.toLowerCase();
      if (lower.includes('input format') || lower.includes('input:')) {
        currentSection = 'inputFormat';
        continue;
      } else if (lower.includes('output format') || lower.includes('output:')) {
        currentSection = 'outputFormat';
        continue;
      } else if (lower.includes('constraint')) {
        currentSection = 'constraints';
        continue;
      } else if (lower.includes('problem statement') || lower.includes('description')) {
        currentSection = 'statement';
        continue;
      }
    }
    if (currentSection) {
      sectionBuffers[currentSection].push(line);
    }
  }

  const statementText = sectionBuffers.statement.join('\n').trim();
  if (statementText) {
    result.problemStatement = statementText;
    result.description = statementText.split('\n\n')[0].trim() || statementText;
  }
  const inputFmt = sectionBuffers.inputFormat.join('\n').trim();
  if (inputFmt) result.inputFormat = inputFmt;

  const outputFmt = sectionBuffers.outputFormat.join('\n').trim();
  if (outputFmt) result.outputFormat = outputFmt;

  const constr = sectionBuffers.constraints.join('\n').trim();
  if (constr) result.constraints = constr;

  return result;
}

/**
 * Core function to process a ZIP buffer server-side and import all valid problems.
 */
export async function importProblemsFromZipBuffer(
  zipBuffer: Buffer | ArrayBuffer
): Promise<ImportReport> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipBuffer);

  const fileMap = new Map<string, string>();
  const securityWarnings: string[] = [];
  const entries = Object.keys(loadedZip.files);

  for (const filename of entries) {
    if (!isSafeZipPath(filename)) {
      securityWarnings.push(`Blocked unsafe path / zip slip: "${filename}"`);
      continue;
    }
    if (isExecutableFile(filename)) {
      securityWarnings.push(`Ignored forbidden executable binary: "${filename}"`);
      continue;
    }

    const entry = loadedZip.files[filename];
    if (entry.dir || filename.startsWith('__MACOSX/') || filename.startsWith('.')) {
      continue;
    }

    try {
      const content = await entry.async('string');
      fileMap.set(filename, content.replace(/\r\n/g, '\n').trim());
    } catch (e: any) {
      console.warn(`Could not read text entry: ${filename}`, e.message);
    }
  }

  const rawProblemsList: any[] = [];
  const failedProblems: ProblemImportError[] = [];

  // Strategy 1: Check root or subfolder problems.json or problems_bank.json
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
      failedProblems.push({
        problemId: 'JSON_SYNTAX_ERROR',
        problemName: jsonKey,
        reason: `JSON parse error in ${jsonKey}: ${e.message}`
      });
    }
  }

  // Strategy 2: Distinct problem folders discovery
  // Every problem folder must be treated as an independent problem.
  // Identify canonical problem directories (parent of problem definition files or testcase directories).
  const problemFoldersSet = new Set<string>();

  for (const k of Array.from(fileMap.keys())) {
    if (problemsJsonKeys.includes(k)) continue;

    // Direct indicators of a problem directory
    const isProblemDefFile = /(?:^|\/)(challenge\.json|problem\.json|metadata\.json|problem_statement\.txt|problem\.txt|problem\.md|statement\.md|description\.txt)$/i.test(k);
    if (isProblemDefFile) {
      const lastSlash = k.lastIndexOf('/');
      const folder = lastSlash === -1 ? '' : k.substring(0, lastSlash + 1);
      problemFoldersSet.add(folder);
      continue;
    }

    // Input/output folders: parent of input/output is the problem folder
    const inOutMatch = k.match(/^(.*\/)?(?:in|input|inputs|out|output|outputs|ans|samples|testcases)\//i);
    if (inOutMatch) {
      const folder = inOutMatch[1] || '';
      problemFoldersSet.add(folder);
      continue;
    }
  }

  let problemCounter = 1;

  for (const folderPath of Array.from(problemFoldersSet)) {
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
        } catch (jsonErr: any) {
          console.warn(`JSON syntax error in ${challengeJsonKey}:`, jsonErr.message);
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
        const mdText = fileMap.get(mdKey) || '';
        const mdParsed = parseMarkdownSections(mdText);
        if (mdParsed.title && !pData.title) pData.title = mdParsed.title;
        if (mdParsed.problemStatement && !pData.problemStatement) pData.problemStatement = mdParsed.problemStatement;
        if (mdParsed.description && !pData.description) pData.description = mdParsed.description;
        if (mdParsed.inputFormat && !pData.inputFormat) pData.inputFormat = mdParsed.inputFormat;
        if (mdParsed.outputFormat && !pData.outputFormat) pData.outputFormat = mdParsed.outputFormat;
        if (mdParsed.constraints && !pData.constraints) pData.constraints = mdParsed.constraints;
      }

      // Priority 5: Dedicated format & specification files
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

      // Check secondary metadata.json or problem.json if challenge.json was not present
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

      // Title extraction fallback from folder name if not yet found
      if (!pData.title) {
        // e.g. 01_EASY_Sum_of_Two_Numbers -> Sum of Two Numbers
        const cleaned = folderSegment.replace(/^\d+[\-_]*/, '').replace(/^(easy|medium|hard)[\-_]*/i, '').replace(/[\-_]+/g, ' ').trim();
        pData.title = cleaned || `Problem ${folderSegment}`;
      }

      // Ensure description and problemStatement are populated accurately
      if (!pData.description && pData.problemStatement) {
        pData.description = pData.problemStatement.split('\n\n')[0].trim() || pData.problemStatement;
      }
      if (!pData.problemStatement && pData.description) {
        pData.problemStatement = pData.description;
      }

      // Scan input and output files strictly inside this problem folder
      const inputs = Array.from(fileMap.keys()).filter(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length);
        const lower = relative.toLowerCase();
        return (
          lower.includes('/input/') || lower.includes('/in/') || lower.includes('/inputs/') || lower.includes('/samples/') ||
          lower.startsWith('input/') || lower.startsWith('in/') || lower.startsWith('inputs/') || lower.startsWith('samples/') ||
          lower.endsWith('.in')
        ) && !lower.endsWith('.md') && !lower.endsWith('.json') && !lower.endsWith('.txt');
      }).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const outputs = Array.from(fileMap.keys()).filter(k => {
        if (!k.startsWith(folderPath)) return false;
        const relative = k.substring(folderPath.length);
        const lower = relative.toLowerCase();
        return (
          lower.includes('/output/') || lower.includes('/out/') || lower.includes('/outputs/') || lower.includes('/ans/') ||
          lower.startsWith('output/') || lower.startsWith('out/') || lower.startsWith('outputs/') || lower.startsWith('ans/') ||
          lower.endsWith('.out') || lower.endsWith('.ans') || lower.endsWith('.sol')
        ) && !lower.endsWith('.md') && !lower.endsWith('.json') && !lower.endsWith('.txt');
      }).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const sampleTCs: any[] = [];
      const hiddenTCs: any[] = [];

      inputs.forEach((inKey, idx) => {
        const basename = inKey.split('/').pop() || '';
        const numMatch = basename.match(/(\d+)/);
        const token = numMatch ? numMatch[1] : basename;

        let outKey = outputs.find(oKey => {
          const oBase = oKey.split('/').pop() || '';
          return oBase.includes(token) ||
            oKey.replace(/output|out|ans|sol/i, 'input').toLowerCase() === inKey.replace(/output|out|ans|sol/i, 'input').toLowerCase() ||
            oKey.replace(/\.(out|sol|ans)$/i, '.in').toLowerCase() === inKey.replace(/\.(txt|in|dat)$/i, '.in').toLowerCase();
        });

        if (!outKey && outputs[idx]) {
          outKey = outputs[idx];
        }

        if (outKey) {
          const inContent = fileMap.get(inKey) || '';
          const outContent = fileMap.get(outKey) || '';
          if (isValidRuntimeTestData(inContent) && outContent.trim().length > 0) {
            const isSample = inKey.toLowerCase().includes('sample') || outKey.toLowerCase().includes('sample') || idx < 2;
            const tc = {
              input: inContent,
              expectedOutput: outContent,
              isSample,
              isHidden: !isSample
            };
            if (isSample) sampleTCs.push(tc);
            else hiddenTCs.push(tc);
          }
        }
      });

      if (!pData.sampleTestCases || pData.sampleTestCases.length === 0) {
        pData.sampleTestCases = sampleTCs;
      }
      if (!pData.hiddenTestCases || pData.hiddenTestCases.length === 0) {
        pData.hiddenTestCases = hiddenTCs;
      }

      pData.detectedSourceFiles = detectedSourceFiles;
      rawProblemsList.push(pData);
      problemCounter++;
    } catch (folderErr: any) {
      failedProblems.push({
        problemId: folderPath,
        problemName: folderPath,
        reason: `Failed parsing problem folder: ${folderErr.message}`
      });
    }
  }

  // Validate every problem strictly
  const validChallengeDocs: any[] = [];
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;

  for (let idx = 0; idx < rawProblemsList.length; idx++) {
    const raw = rawProblemsList[idx];
    const problemId = String(raw.problemId || raw.id || `P${String(idx + 1).padStart(3, '0')}`).trim();
    let title = String(raw.title || raw.name || raw.problemTitle || '').trim();
    if (!title) {
      title = `Problem ${problemId.replace(/^P0*/, '') || (idx + 1)}`;
    }

    // 1. Difficulty check (strictly EASY, MEDIUM, HARD; NO defaulting)
    const detectedDiff = detectStrictDifficulty(raw, raw.folderPath, title);
    if (!detectedDiff) {
      failedProblems.push({
        problemId,
        problemName: title,
        reason: `IMPORT_VALIDATION_ERROR: Missing or invalid difficulty in "${problemId}". Allowed: EASY, MEDIUM, HARD. Source files: [${(raw.detectedSourceFiles || []).join(', ')}]`
      });
      continue;
    }

    const difficulty: 'EASY' | 'MEDIUM' | 'HARD' = detectedDiff;

    // 2. Strict field presence checks (no synthetic / default fallbacks)
    const description = String(raw.description || '').trim();
    const problemStatement = String(raw.problemStatement || '').trim();
    const inputFormat = String(raw.inputFormat || '').trim();
    const outputFormat = String(raw.outputFormat || '').trim();
    const constraints = String(raw.constraints || '').trim();

    const missingFields: string[] = [];
    if (!description) missingFields.push('description');
    if (!problemStatement) missingFields.push('problemStatement');
    if (!inputFormat) missingFields.push('inputFormat');
    if (!outputFormat) missingFields.push('outputFormat');
    if (!constraints) missingFields.push('constraints');

    // 3. Test cases check: exactly 2 visible sample and 3 hidden test cases required
    const rawSampleList: any[] = Array.isArray(raw.sampleTestCases)
      ? raw.sampleTestCases
      : Array.isArray(raw.examples)
      ? raw.examples
      : [];

    const rawHiddenList: any[] = Array.isArray(raw.hiddenTestCases)
      ? raw.hiddenTestCases
      : Array.isArray(raw.testCases)
      ? raw.testCases.filter((t: any) => t.isHidden)
      : [];

    const validSampleCases = rawSampleList.filter(tc => {
      const inp = typeof tc === 'object' ? String(tc.input || '') : '';
      const out = typeof tc === 'object' ? String(tc.expectedOutput || tc.output || '') : '';
      return isValidRuntimeTestData(inp) && out.trim().length > 0;
    });

    const validHiddenCases = rawHiddenList.filter(tc => {
      const inp = typeof tc === 'object' ? String(tc.input || '') : '';
      const out = typeof tc === 'object' ? String(tc.expectedOutput || tc.output || '') : '';
      return isValidRuntimeTestData(inp) && out.trim().length > 0;
    });

    let finalSample: any[] = [];
    let finalHidden: any[] = [];

    if (validSampleCases.length >= 2 && validHiddenCases.length >= 3) {
      finalSample = validSampleCases.slice(0, 2);
      finalHidden = validHiddenCases.slice(0, 3);
    } else {
      const combined = [...validSampleCases, ...validHiddenCases];
      if (combined.length >= 5) {
        finalSample = combined.slice(0, 2);
        finalHidden = combined.slice(2, 5);
      }
    }

    if (finalSample.length !== 2) missingFields.push(`sampleTestCases (found ${finalSample.length}, required 2)`);
    if (finalHidden.length !== 3) missingFields.push(`hiddenTestCases (found ${finalHidden.length}, required 3)`);

    if (missingFields.length > 0) {
      failedProblems.push({
        problemId,
        problemName: title,
        reason: `IMPORT_VALIDATION_ERROR: Missing required fields [${missingFields.join(', ')}] for problem "${title}" (${problemId}). Source files: [${(raw.detectedSourceFiles || []).join(', ')}]`
      });
      continue;
    }

    // Scoring per difficulty: Easy 10 pts (5x2), Medium 15 pts (5x3), Hard 25 pts (5x5)
    const marksPerCase = difficulty === 'EASY' ? 2 : difficulty === 'HARD' ? 5 : 3;
    const maxScore = difficulty === 'EASY' ? 10 : difficulty === 'HARD' ? 25 : 15;

    const formattedSample = finalSample.map((tc, sIdx) => ({
      id: `tc-sample-${problemId}-${sIdx + 1}`,
      input: String(tc.input).trim(),
      expectedOutput: String(tc.expectedOutput || tc.output).trim(),
      isSample: true,
      isHidden: false,
      marks: marksPerCase,
      order: sIdx + 1,
      explanation: tc.explanation || `Sample test case ${sIdx + 1}`
    }));

    const formattedHidden = finalHidden.map((tc, hIdx) => ({
      id: `tc-hidden-${problemId}-${hIdx + 1}`,
      input: String(tc.input).trim(),
      expectedOutput: String(tc.expectedOutput || tc.output).trim(),
      isSample: false,
      isHidden: true,
      marks: marksPerCase,
      order: 2 + hIdx + 1
    }));

    const all5TestCases = [...formattedSample, ...formattedHidden];

    if (difficulty === 'EASY') easyCount++;
    else if (difficulty === 'MEDIUM') mediumCount++;
    else if (difficulty === 'HARD') hardCount++;

    const slug = String(raw.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();

    let concepts: string[] = ['Algorithms'];
    if (Array.isArray(raw.concepts) && raw.concepts.length > 0) concepts = raw.concepts;
    else if (Array.isArray(raw.tags) && raw.tags.length > 0) concepts = raw.tags;

    let companyTags: string[] = [];
    if (Array.isArray(raw.companyTags)) companyTags = raw.companyTags;

    const challengeDoc = {
      id: problemId,
      problemId,
      title,
      name: title,
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
      points: maxScore,
      maximumMarks: maxScore,
      timeLimitMs: Number(raw.timeLimitMs || 1000),
      memoryLimitMb: Number(raw.memoryLimitMb || 256),
      sampleTestCases: formattedSample,
      hiddenTestCases: formattedHidden,
      testCases: all5TestCases,
      languages: ['python', 'javascript', 'cpp', 'c', 'java'],
      status: 'PUBLISHED',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    validChallengeDocs.push(challengeDoc);
  }

  // Database verification: count before
  const beforeCount = await Challenge.countDocuments();

  if (validChallengeDocs.length > 0) {
    const bulkOps = validChallengeDocs.map(doc => ({
      updateOne: {
        filter: { id: doc.id },
        update: { $set: doc },
        upsert: true
      }
    }));

    await Challenge.bulkWrite(bulkOps);

    // Sync to in-memory map
    for (const doc of validChallengeDocs) {
      originalDb.problems.set(doc.id, doc as any);
      originalDb.challenges.set(doc.id, doc as any);
    }
  }

  // Database verification: count after
  const afterCount = await Challenge.countDocuments();

  const report: ImportReport = {
    success: failedProblems.length === 0 && validChallengeDocs.length > 0,
    totalDiscovered: rawProblemsList.length,
    validCount: validChallengeDocs.length,
    importedCount: validChallengeDocs.length,
    failedCount: failedProblems.length,
    difficulty: {
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount
    },
    testCases: {
      visible: validChallengeDocs.length * 2,
      hidden: validChallengeDocs.length * 3,
      total: validChallengeDocs.length * 5
    },
    failedProblems,
    databaseVerification: {
      beforeCount,
      afterCount,
      netAdded: afterCount - beforeCount
    },
    securityWarnings
  };

  console.log('📦 Bulk Problem ZIP Import Report:', JSON.stringify(report, null, 2));
  return report;
}
