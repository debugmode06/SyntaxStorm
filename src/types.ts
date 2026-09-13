export type UserRole = 'ADMIN' | 'JUDGE' | 'PARTICIPANT' | 'STUDENT';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  password?: string;
  passwordHash?: string;
  batchId?: string;
  college?: string;
  institution?: string;
  studentId?: string;
  registrationNo?: string;
  department?: string;
  year?: string;
  yearOfStudy?: string;
  phone?: string;
  avatarUrl?: string;
  status?: AccountStatus;
  isApproved?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentAccount {
  id: string;
  studentId: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  phone?: string;
  college?: string;
  institution?: string;
  department?: string;
  year?: string;
  yearOfStudy?: string;
  batchId?: string;
  status: AccountStatus;
  isApproved?: boolean;
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
  attemptStatus?: AttemptStatus;
}

export interface Batch {
  id: string;
  name: string;
  normalizedName?: string;
  status?: string;
  studentCount?: number;
  contestCount?: number;
  createdAt?: string;
  updatedAt?: string;
  
  // Legacy mock fields
  code?: string;
  description?: string;
  capacity?: number;
  assignedQuestionSetIds?: string[];
  startTime?: string;
  endTime?: string;
  slotDurationMinutes?: number;
  isActive?: boolean;
  participantCount?: number;
}

export type RegistrationStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface StudentRegistration {
  id: string;
  name: string;
  email: string;
  college: string;
  studentId: string;
  department: string;
  yearOfStudy: string;
  phone: string;
  preferredBatchId: string;
  githubOrProfileUrl?: string;
  status: RegistrationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  assignedBatchId?: string;
  assignedUsername?: string;
  assignedPassword?: string;
  assignedRollCode?: string;
  rejectionReason?: string;
}

export interface CreateContestPayload {
  title: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  organizationType?: string;
  organizationName?: string;
  timezone?: string;
  batchId?: string;
  status?: ContestStatus;
  logoUrl?: string;
  instructions?: string;
  round1DurationMinutes?: number;
  round2DurationMinutes?: number;
  batchCount?: number;
  setCount?: number;
  questionsPerSet?: number;
  slotDurationMinutes?: number;
  maxTabSwitches?: number;
  lockdownFullscreen?: boolean;
  blockClipboardPaste?: boolean;
  blockContextMenu?: boolean;
  enablePlagiarismDetection?: boolean;
  round2QualificationLimit?: number;
}

export interface QuestionSet {
  id: string; // e.g. 'set-a', 'set-b'
  name: string; // e.g. 'Set A', 'Set B'
  code?: string;
  roundId: string;
  problemIds: string[];
  description?: string;
  difficultyDistribution?: {
    easy: number;
    medium: number;
    hard: number;
  };
  totalPoints?: number;
  isReady?: boolean;
  validationErrors?: string[];
  assignedParticipantsCount?: number;
}



export interface Round {
  id: string;
  name: string;
  description?: string;
  roundNumber: number; // 1 or 2
  status: 'UPCOMING' | 'ACTIVE' | 'PAUSED' | 'FINALIZED';
  startMode?: 'AUTOMATIC' | 'MANUAL' | 'SCHEDULED';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  cutoffRank?: number;
  minScoreForCutoff?: number;
  scoringMode?: 'STANDARD' | 'PARTIAL' | 'PENALTY_BASED';
  qualificationRule?: string;
  qualifiedParticipantIds?: string[];
  totalQuestions: number;
  isLocked: boolean;
}

export type ProblemDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ProblemPlatform = 'CUSTOM' | 'LEETCODE' | 'HACKERRANK' | 'CODECHEF' | 'CODEFORCES' | 'ATCODER' | 'GEEKSFORGEEKS' | 'HACKEREARTH' | 'OTHER';
export type ProblemStatus = 'DRAFT' | 'READY' | 'PUBLISHED' | 'ARCHIVED';

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  marks?: number;
  weight?: number;
  strength?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  order?: number;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  status?: 'ACTIVE' | 'DISABLED';
  explanation?: string;
  tag?: string;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface Problem {
  id: string;
  title: string;
  slug: string;
  description: string;
  problemStatement?: string;
  category?: string;
  concepts?: string[];
  companyTags?: string[];
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  difficulty: ProblemDifficulty;
  sourcePlatform?: ProblemPlatform;
  sourceUrl?: string;
  tags?: string[];
  points: number;
  maximumMarks?: number;
  roundId?: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  sampleTestCases: TestCase[];
  hiddenTestCases: TestCase[];
  examples?: ProblemExample[];
  explanation?: string;
  notes?: string;
  languages?: string[];
  status?: ProblemStatus;
  version?: number;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  archivedAt?: string;
  starterCode?: {
    python?: string;
    javascript?: string;
    cpp?: string;
    c?: string;
    java?: string;
  };
}

export interface TestCaseResult {
  testCaseId: string;
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'MEMORY_LIMIT_EXCEEDED' | 'COMPILATION_ERROR' | 'RUNTIME_UNAVAILABLE' | 'EXECUTION_SERVICE_UNAVAILABLE' | 'JUDGE0_AUTHENTICATION_REQUIRED' | 'JUDGE0_AUTHORIZATION_FAILED' | 'JUDGE0_RATE_LIMITED' | 'JUDGE0_QUEUE_UNAVAILABLE';
  actualOutput?: string;
  expectedOutput?: string;
  executionTimeMs: number;
  memoryUsedMb: number;
  error?: string;
  isHidden: boolean;
}

export interface Submission {
  id: string;
  userId: string;
  userName: string;
  problemId: string;
  roundId: string;
  contestId?: string;
  attemptId?: string;
  batchId?: string;
  language: string;
  code: string;
  status: 'QUEUED' | 'RUNNING' | 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'COMPILATION_ERROR' | 'MEMORY_LIMIT_EXCEEDED' | 'RUNTIME_UNAVAILABLE' | 'EXECUTION_SERVICE_UNAVAILABLE' | 'JUDGE0_AUTHENTICATION_REQUIRED' | 'JUDGE0_AUTHORIZATION_FAILED' | 'JUDGE0_RATE_LIMITED' | 'JUDGE0_QUEUE_UNAVAILABLE';
  passedTests: number;
  totalTests: number;
  score: number;
  maxScore: number;
  executionTimeMs: number;
  memoryUsedMb: number;
  submittedAt: string;
  testCaseResults: TestCaseResult[];
  errorLog?: string;
  compileOutput?: string;
  runtimeOutput?: string;
}

export interface QuestionResult {
  _id?: string;
  id?: string;
  studentId: string;
  contestId: string;
  attemptId: string;
  problemId: string;
  difficulty?: string;
  passedTestCases: number;
  totalTestCases: number;
  marksEarned: number;
  maxMarks: number;
  status: string;
  testCaseResults?: TestCaseResult[];
  evaluatedAt?: string;
}

export interface QuestionAssignment {
  id: string;
  userId: string;
  roundId: string;
  setId: string; // e.g. 'Set A', 'Set B', etc.
  problemIds: string[];
  shuffledProblemIds?: string[];
  isLocked: boolean;
  lockedAt?: string;
  overridden: boolean;
  assignedAt?: string;
}

export type LockReasonCode = 
  | 'TAB_SWITCH_LIMIT_EXCEEDED'
  | 'FULLSCREEN_EXIT'
  | 'ADMIN_LOCK'
  | 'TIME_EXPIRED'
  | 'SECURITY_VIOLATION'
  | 'SESSION_CONFLICT'
  | 'MANUAL_LOCK'
  | 'OTHER';

export interface OverrideAuditRecord {
  id: string;
  contestId: string;
  attemptId: string;
  studentId: string;
  studentName?: string;
  action: 'UNLOCK_AND_RESUME';
  adminId: string;
  adminName: string;
  reason: string;
  previousState: string;
  newState: string;
  timestamp: string;
  metadata?: {
    lockReasonCode?: string;
    lockReasonText?: string;
    remainingTimeMs?: number;
    assignedSetId?: string;
  };
}

export type AttemptStatus = 
  | 'NOT_STARTED' 
  | 'PREPARING'
  | 'IN_PROGRESS'
  | 'ACTIVE' 
  | 'SUBMITTING' 
  | 'SUBMITTED'
  | 'AUTO_SUBMITTING'
  | 'AUTO_SUBMITTED'
  | 'LOCKED'
  | 'COMPLETED' 
  | 'TERMINATED_SECURITY' 
  | 'TERMINATED_ADMIN' 
  | 'EXPIRED' 
  | 'DISQUALIFIED'
  | 'RESUMED_AFTER_OVERRIDE';

export interface StudentSession {
  studentId: string;
  sessionId: string;
  createdAt?: string;
  loginAt: string;
  lastSeenAt: string;
  expiresAt: string;
  active: boolean;
  userAgent?: string;
  deviceInfo?: string;
  logoutAt?: string;
  logoutReason?: string;
  ipHashOrSafeNetworkMetadata?: string;
}

export interface CodeSnapshot {
  code: string;
  language: string;
  updatedAt: string;
}

export interface ContestAttempt {
  id: string;
  attemptId?: string;
  contestId: string;
  participantId: string;
  studentId?: string;
  batchId: string;
  currentRoundId: string;
  assignedSetId?: string;
  status: AttemptStatus;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  preparationStartedAt?: string;
  preparationEndsAt?: string;
  contestStartTime?: string;
  contestEndTime?: string;
  originalExpiresAt?: string;
  expiresAt?: string;
  startedAt: string;
  submittedAt?: string;
  endedAt?: string;
  tabSwitchCount: number;
  maxTabSwitches: number;
  terminationReason?: string;
  easyScore?: number;
  mediumScore?: number;
  hardScore?: number;
  totalScore?: number;
  submissionType?: 'MANUAL_RETURN' | 'TIME_EXPIRY' | 'AUTO_SECURITY' | string;
  lockReasonCode?: LockReasonCode | string;
  lockReasonText?: string;
  lockedAt?: string;
  lockedBy?: string;
  overrideRecords?: OverrideAuditRecord[];
  activeSessionId: string;
  codeSnapshots: Record<string, CodeSnapshot>; // problemId -> snapshot
  createdAt: string;
  updatedAt: string;
}

export type SecurityEventType = 
  | 'TAB_SWITCH' 
  | 'WINDOW_BLUR' 
  | 'EXTENSION_DETECTED'
  | 'FULLSCREEN_ENTER'
  | 'FULLSCREEN_EXIT' 
  | 'CLIPBOARD_PASTE' 
  | 'PASTE_ATTEMPT'
  | 'SHIFT_INSERT_PASTE'
  | 'CTRL_SHIFT_V_PASTE'
  | 'CONTEXT_MENU_PASTE'
  | 'DROP_PASTE'
  | 'DRAG_DROP_PASTE_ATTEMPT'
  | 'DEVTOOLS_OPEN' 
  | 'CONTEXT_MENU' 
  | 'SUSPICIOUS_KEYPRESS'
  | 'MULTIPLE_SESSION_DETECTED'
  | 'AUTO_SECURITY_SUBMIT';

export type ChallengeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ChallengeStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ChallengeStrength = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
export type CheckerType = 'STANDARD_EXACT_MATCH' | 'CUSTOM_CHECKER';

export interface ChallengeTestCase {
  id: string;
  challengeId: string;
  versionId?: number;
  order: number;
  input: string;
  expectedOutput: string;
  tag?: string;
  isSample: boolean;
  isAdditional: boolean;
  marks: number;
  strength: ChallengeStrength;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChallengeLanguageConfig {
  id?: string;
  languageId: 'c' | 'cpp' | 'java' | 'python' | 'javascript';
  name: string;
  enabled: boolean;
  timeLimitSec: number;
  memoryLimitMb: number;
}

export interface ChallengeSettings {
  partialScoring: boolean;
  negativeMarking: boolean;
  negativeMarkValue?: number;
  maximumSubmissions: number;
  timeLimitSec: number;
  memoryLimitMb: number;
  checkerType: CheckerType;
  customCheckerCode?: string;
}

export interface ChallengeEditorial {
  approach: string;
  algorithm: string;
  explanation: string;
  timeComplexity: string;
  spaceComplexity: string;
  referenceSolution: Record<string, string>; // languageId -> code
  updatedAt?: string;
}

export interface Challenge {
  id: string; // e.g. 'CH001'
  challengeCode: string;
  name: string;
  slug: string;
  description: string;
  problemStatement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  explanation: string;
  difficulty: ChallengeDifficulty;
  category: string;
  tags: string[];
  maximumMarks: number;
  status: ChallengeStatus;
  version: number;
  testCases: ChallengeTestCase[];
  languages: ChallengeLanguageConfig[];
  codeStubs: Record<string, string>; // languageId -> code
  settings: ChallengeSettings;
  editorial: ChallengeEditorial;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  archivedAt?: string;
}

export interface AntiCheatViolation {
  id: string;
  userId: string;
  roundId: string;
  attemptId?: string;
  timestamp: string;
  type: SecurityEventType;
  details: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, any>;
}

export interface ParticipantSecurityState {
  userId: string;
  roundId: string;
  attemptId?: string;
  tabSwitchCount: number;
  maxAllowedSwitches: number;
  isFlagged: boolean;
  sessionTerminated: boolean;
  terminationReason?: string;
  lockReasonCode?: LockReasonCode | string;
  lockReasonText?: string;
  lockedAt?: string;
  lockedBy?: string;
  violations: AntiCheatViolation[];
  riskScore: number; // 0 - 100
  adminOverridden?: boolean;
  overrideNote?: string;
  attemptStatus?: AttemptStatus;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  userId: string;
  studentName: string;
  name: string;
  email: string;
  college: string;
  batch: string;
  batchId?: string;
  batchName?: string;
  assignedSetId?: string;
  attemptId?: string;

  easyScore: number;
  easyMax: number;

  mediumScore: number;
  mediumMax: number;

  hardScore: number;
  hardMax: number;

  totalScore: number;
  totalMax: number;

  securityStatus: string;
  attemptStatus: string;
  submittedAt?: string;

  penaltyMinutes: number;
  solvedCount: number;
  securityRiskScore: number;
  isDisqualified: boolean;
  isQualifiedForRound2?: boolean;

  problemsSolved: {
    problemId: string;
    title?: string;
    score: number;
    maxScore: number;
    difficulty: string;
    solvedAt?: string;
    attempts: number;
    passedTests: number;
    totalTests: number;
    testCaseResults?: TestCaseResult[];
  }[];
}

export interface SystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  activeWorkers: number;
  totalWorkers: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgExecutionTimeMs: number;
  memoryUsageMb: number;
  uptimeSeconds: number;
  timestamp: string;
}

export interface PlagiarismComparison {
  id: string;
  problemId: string;
  problemTitle: string;
  userA: { id: string; name: string };
  userB: { id: string; name: string };
  similarityScore: number; // 0 - 100
  astSimilarity: number;
  tokenSimilarity: number;
  ngramSimilarity: number;
  codeA: string;
  codeB: string;
  isFlagged: boolean;
  analyzedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  targetId?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface ContestSettings {
  maxTabSwitches: number;
  lockdownFullscreen: boolean;
  blockClipboardPaste: boolean;
  blockContextMenu: boolean;
  enablePlagiarismDetection: boolean;
  autoFinalizeRound1: boolean;
  round2QualificationLimit: number;
}

export interface ScoringConfig {
  pointsPerProblem: number;
  enablePartialScoring: boolean;
  submissionPenaltyMinutes: number;
  enableNegativeMarking: boolean;
}

export interface QualificationConfig {
  rule: 'TOP_N_OVERALL' | 'TOP_N_PER_BATCH' | 'MIN_SCORE_PCT';
  limit: number;
  minPercentage?: number;
}

export interface AntiCheatConfig {
  maxTabSwitches: number;
  lockdownFullscreen: boolean;
  blockClipboardPaste: boolean;
  blockContextMenu: boolean;
  enablePlagiarismDetection: boolean;
  riskThreshold: number;
}

export type ContestStatus = 'DRAFT' | 'READY' | 'SCHEDULED' | 'PUBLISHED' | 'LIVE' | 'PAUSED' | 'FINALIZED' | 'ARCHIVED';

export interface Contest {
  id: string;
  title: string;
  description: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  organizationType?: string;
  organizationName?: string;
  timezone?: string;
  batchId?: string;
  round1DurationMinutes?: number;
  round2DurationMinutes?: number;
  status?: ContestStatus;
  logoUrl?: string;
  instructions?: string;
  isLocked?: boolean;
  lockedAt?: string;
  currentRoundId: string;
  isLive: boolean;
  isPaused: boolean;
  questionsPerSet?: number;
  settings: ContestSettings;
  scoringConfig?: ScoringConfig;
  qualificationConfig?: QualificationConfig;
  antiCheatConfig?: AntiCheatConfig;
}
