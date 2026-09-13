import mongoose from 'mongoose';

// User Schema
const UserSchema = new mongoose.Schema({
  id: { type: String, index: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  password: { type: String },
  role: { type: String, required: true },
  name: { type: String, required: true },
  studentId: { type: String },
  college: { type: String },
  institution: { type: String },
  department: { type: String },
  year: { type: String },
  yearOfStudy: { type: String },
  phone: { type: String },
  status: { type: String, default: 'ACTIVE' },
  batchId: { type: String },
  assignedContestId: { type: String },
  passwordChanged: { type: Boolean, default: false }
}, { timestamps: true, strict: false });

// Batch Schema
const BatchSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: { type: String, required: true },
  normalizedName: { type: String, unique: true },
  status: { type: String, default: 'ACTIVE' }
}, { timestamps: true });

// Batch Membership Schema
const BatchMembershipSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  batchId: { type: String, required: true, index: true },
  studentId: { type: String, required: true, index: true },
  addedBy: String
}, { timestamps: true });

BatchMembershipSchema.index({ batchId: 1, studentId: 1 }, { unique: true });

// Contest Schema
const ContestSchema = new mongoose.Schema({
  id: { type: String, index: true },
  title: String,
  description: String,
  date: String,
  startTime: String,
  endTime: String,
  organizationType: String,
  organizationName: String,
  timezone: String,
  status: { type: String, default: 'DRAFT' },
  logoUrl: String,
  instructions: String,
  isLocked: Boolean,
  lockedAt: Date,
  currentRoundId: String,
  isLive: Boolean,
  isPaused: Boolean,
  questionsPerSet: Number,
  settings: mongoose.Schema.Types.Mixed,
  scoringConfig: mongoose.Schema.Types.Mixed,
  qualificationConfig: mongoose.Schema.Types.Mixed,
  antiCheatConfig: mongoose.Schema.Types.Mixed
}, { timestamps: true, strict: false });

// Challenge / Problem Schema
const ChallengeSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  problemId: { type: String },
  challengeCode: String,
  title: String,
  name: String,
  slug: String,
  description: String,
  problemStatement: String,
  inputFormat: String,
  outputFormat: String,
  constraints: String,
  sampleInput: String,
  sampleOutput: String,
  explanation: String,
  difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD'], required: true },
  category: String,
  tags: [String],
  concepts: [String],
  companyTags: [String],
  points: Number,
  maximumMarks: Number,
  timeLimitMs: Number,
  memoryLimitMb: Number,
  status: { type: String, default: 'DRAFT' },
  version: Number,
  sampleTestCases: [mongoose.Schema.Types.Mixed],
  hiddenTestCases: [mongoose.Schema.Types.Mixed],
  testCases: [mongoose.Schema.Types.Mixed],
  languages: [mongoose.Schema.Types.Mixed],
  codeStubs: mongoose.Schema.Types.Mixed,
  settings: mongoose.Schema.Types.Mixed,
  editorial: mongoose.Schema.Types.Mixed,
  createdBy: String,
  publishedAt: Date,
  archivedAt: Date
}, { timestamps: true, strict: false });

ChallengeSchema.index({ problemId: 1 });

// QuestionSet Schema
const QuestionSetSchema = new mongoose.Schema({
  id: { type: String, index: true },
  contestId: String,
  roundId: String,
  name: String,
  setId: String,
  problemIds: [String]
}, { timestamps: true, strict: false });

// QuestionAssignment Schema
const QuestionAssignmentSchema = new mongoose.Schema({
  id: { type: String, index: true },
  userId: String,
  contestId: String,
  roundId: String,
  setId: String,
  problemIds: [String],
  assignedAt: Date
}, { timestamps: true, strict: false });

// StudentRegistration Schema
const StudentRegistrationSchema = new mongoose.Schema({
  id: { type: String, index: true },
  name: String,
  email: String,
  college: String,
  studentId: String,
  department: String,
  yearOfStudy: String,
  phone: String,
  preferredBatchId: String,
  githubOrProfileUrl: String,
  status: { type: String, default: 'PENDING' },
  submittedAt: Date,
  reviewedAt: Date,
  rejectionReason: String
}, { timestamps: true, strict: false });

// Submission Schema
const SubmissionSchema = new mongoose.Schema({
  id: { type: String, index: true },
  userId: String,
  userName: String,
  problemId: String,
  roundId: String,
  contestId: String,
  attemptId: { type: String, index: true },
  batchId: String,
  language: String,
  code: String,
  status: String,
  passedTests: Number,
  totalTests: Number,
  score: Number,
  maxScore: Number,
  executionTimeMs: Number,
  memoryUsedMb: Number,
  submittedAt: Date,
  testCaseResults: [mongoose.Schema.Types.Mixed],
  errorLog: String
}, { timestamps: true, strict: false });

// ContestAttempt Schema
const ContestAttemptSchema = new mongoose.Schema({
  id: { type: String, index: true },
  contestId: { type: String, required: true, index: true },
  participantId: { type: String, required: true, index: true },
  studentId: { type: String, required: true, index: true },
  attemptId: { type: String, index: true },
  assignedSetId: String,
  batchId: String,
  currentRoundId: String,
  status: { type: String, default: 'IN_PROGRESS' },
  termsAccepted: Boolean,
  termsAcceptedAt: Date,
  startedAt: Date,
  originalExpiresAt: Date,
  expiresAt: Date,
  submittedAt: Date,
  endedAt: Date,
  tabSwitchCount: { type: Number, default: 0 },
  maxTabSwitches: Number,
  terminationReason: String,
  lockReasonCode: String,
  lockReasonText: String,
  overrideGranted: Boolean,
  resumedByAdmin: { type: Boolean, default: false },
  resumedAt: Date,
  lastOverrideAt: Date,
  lastOverrideBy: String,
  lastOverrideReason: String,
  overrideRecords: [mongoose.Schema.Types.Mixed],
  activeSessionId: String,
  codeSnapshots: mongoose.Schema.Types.Mixed,
  scores: mongoose.Schema.Types.Mixed
}, { timestamps: true, strict: false });

ContestAttemptSchema.index({ studentId: 1, contestId: 1 }, { unique: true });
ContestAttemptSchema.index({ participantId: 1, contestId: 1 }, { unique: true });

// QuestionResult Schema
const QuestionResultSchema = new mongoose.Schema({
  id: { type: String, index: true },
  studentId: { type: String, required: true, index: true },
  contestId: { type: String, required: true, index: true },
  attemptId: { type: String, required: true, index: true },
  problemId: { type: String, required: true, index: true },
  difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD'] },
  passedTestCases: { type: Number, default: 0 },
  totalTestCases: { type: Number, default: 5 },
  marksEarned: { type: Number, default: 0 },
  maxMarks: { type: Number, default: 0 },
  status: { type: String, default: 'QUEUED' },
  testCaseResults: [mongoose.Schema.Types.Mixed],
  evaluatedAt: Date
}, { timestamps: true, strict: false });

QuestionResultSchema.index({ attemptId: 1, problemId: 1 }, { unique: true });

// StudentSession Schema
const StudentSessionSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  studentId: { type: String, index: true },
  createdAt: Date,
  loginAt: Date,
  lastSeenAt: Date,
  expiresAt: Date,
  active: Boolean,
  userAgent: String,
  deviceInfo: String,
  logoutAt: Date,
  logoutReason: String,
  ipHashOrSafeNetworkMetadata: String
}, { timestamps: true, strict: false });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Contest = mongoose.models.Contest || mongoose.model('Contest', ContestSchema);
export const Challenge = mongoose.models.Challenge || mongoose.model('Challenge', ChallengeSchema);
export const QuestionSet = mongoose.models.QuestionSet || mongoose.model('QuestionSet', QuestionSetSchema);
export const QuestionAssignment = mongoose.models.QuestionAssignment || mongoose.model('QuestionAssignment', QuestionAssignmentSchema);
export const StudentRegistration = mongoose.models.StudentRegistration || mongoose.model('StudentRegistration', StudentRegistrationSchema);
export const Submission = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
export const ContestAttempt = mongoose.models.ContestAttempt || mongoose.model('ContestAttempt', ContestAttemptSchema);
export const QuestionResult = mongoose.models.QuestionResult || mongoose.model('QuestionResult', QuestionResultSchema);
export const StudentSessionModel = mongoose.models.StudentSession || mongoose.model('StudentSession', StudentSessionSchema);
export const Batch = mongoose.models.Batch || mongoose.model('Batch', BatchSchema);
export const BatchMembership = mongoose.models.BatchMembership || mongoose.model('BatchMembership', BatchMembershipSchema);
