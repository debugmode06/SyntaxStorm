import {
  User,
  Contest,
  Batch,
  Round,
  Problem,
  QuestionAssignment,
  QuestionSet,
  Submission,
  ParticipantSecurityState,
  LeaderboardEntry,
  SystemHealth,
  PlagiarismComparison,
  AuditLog,
  StudentRegistration,
  CreateContestPayload,
  ContestAttempt,
  OverrideAuditRecord
} from './types';

const API_BASE = '/api';

let storedUserId: string | null = null;
let storedSessionId: string | null = null;

export const setAuthUserId = (userId: string | null, sessionId?: string | null) => {
  storedUserId = userId;
  if (sessionId !== undefined) {
    storedSessionId = sessionId;
  }
  if (typeof window !== 'undefined') {
    if (userId) {
      localStorage.setItem('symposium_auth_user_id', userId);
    } else {
      localStorage.removeItem('symposium_auth_user_id');
    }
    if (storedSessionId) {
      localStorage.setItem('symposium_auth_session_id', storedSessionId);
    } else {
      localStorage.removeItem('symposium_auth_session_id');
    }
  }
};

if (typeof window !== 'undefined') {
  storedUserId = localStorage.getItem('symposium_auth_user_id');
  storedSessionId = localStorage.getItem('symposium_auth_session_id');
}

const getHeaders = (headers?: Record<string, string>) => {
  const h: Record<string, string> = { ...headers };
  if (storedUserId) {
    h['x-user-id'] = storedUserId;
  }
  if (storedSessionId) {
    h['x-session-id'] = storedSessionId;
  }
  return h;
};
const authenticatedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const newHeaders = getHeaders(init?.headers as any);
  return fetch(input, { ...init, headers: newHeaders });
};


export const api = {
  async getMe(): Promise<{ user: User; securityState: ParticipantSecurityState | null }> {
    const res = await authenticatedFetch(`${API_BASE}/auth/me`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch current user');
    return res.json();
  },

  async login(email: string, password: string): Promise<{ user: User; sessionId?: string; securityState: ParticipantSecurityState | null; attempt?: ContestAttempt | null }> {
    const res = await authenticatedFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || data.error || 'Login failed') as any;
      err.status = res.status;
      err.code = data.code || (res.status === 409 ? 'ACTIVE_SESSION_EXISTS' : undefined);
      throw err;
    }
    if (data.user?.id) {
      setAuthUserId(data.user.id, data.sessionId || null);
    }
    return data;
  },

  async registerStudent(params: {
    name: string;
    email: string;
    college: string;
    studentId: string;
    department: string;
    yearOfStudy: string;
    phone: string;
    preferredBatchId: string;
    githubOrProfileUrl?: string;
  }): Promise<{ registration: StudentRegistration; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/auth/register-student`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    return data;
  },

  async getRegistrations(): Promise<{ registrations: StudentRegistration[] }> {
    const res = await authenticatedFetch(`${API_BASE}/registrations`);
    if (!res.ok) throw new Error('Failed to fetch registrations');
    return res.json();
  },

  async approveRegistration(id: string, params: {
    assignedBatchId: string;
    assignedUsername: string;
    assignedPassword: string;
    assignedRollCode?: string;
  }): Promise<{ registration: StudentRegistration; user: User }> {
    const res = await authenticatedFetch(`${API_BASE}/registrations/${id}/approve`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Approval failed');
    return data;
  },

  async rejectRegistration(id: string, reason: string): Promise<{ registration: StudentRegistration }> {
    const res = await authenticatedFetch(`${API_BASE}/registrations/${id}/reject`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Rejection failed');
    return data;
  },

  async createContest(payload: CreateContestPayload): Promise<{ contest: Contest; batches: Batch[]; rounds: Round[] }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/create`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create contest');
    return data;
  },

  async adminUnlock(userId?: string, roundId?: string, reason?: string): Promise<{ securityState: ParticipantSecurityState }> {
    const targetUserId = userId || 'usr-student-1';
    const res = await this.adminUnlockAttempt('contest-grand-prix-2026', targetUserId, reason || 'Jury manual override.');
    return { securityState: res.securityState };
  },

  async adminUnlockAttempt(contestId: string, attemptIdOrUserId: string, reason: string): Promise<{
    attempt: ContestAttempt;
    securityState: ParticipantSecurityState;
    overrideRecord: OverrideAuditRecord;
  }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/contests/${contestId}/attempts/${attemptIdOrUserId}/unlock`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to unlock test attempt.');
    return data;
  },

  async getAttemptAuditDossier(contestId: string, attemptIdOrUserId: string): Promise<{
    student: User | null;
    contest: Contest;
    attempt: ContestAttempt;
    securityState: ParticipantSecurityState | null;
    submissions: Submission[];
    assignment: QuestionAssignment | null;
    overrideHistory: OverrideAuditRecord[];
  }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/contests/${contestId}/attempts/${attemptIdOrUserId}/audit`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch audit dossier.');
    return data;
  },

  async switchUser(userId: string): Promise<{ user: User; securityState: ParticipantSecurityState | null }> {
    const res = await authenticatedFetch(`${API_BASE}/auth/switch-user`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ userId })
    });
    if (!res.ok) throw new Error('Failed to switch user');
    return res.json();
  },

  // Batch Management
  async getAdminBatches(): Promise<{ batches: Batch[] }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/batches`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async createAdminBatch(name: string): Promise<{ batch: Batch }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/batches`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create batch');
    return data;
  },

  async getAdminBatchStudents(batchId: string): Promise<{ students: User[] }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/batches/${batchId}/students`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async addStudentsToAdminBatch(batchId: string, studentIds: string[]): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/batches/${batchId}/students`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ studentIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add students to batch');
    return data;
  },

  async removeStudentFromAdminBatch(batchId: string, studentId: string): Promise<{ success: boolean }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/batches/${batchId}/students/${studentId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getUsers(): Promise<{ users: User[] }> {
    const res = await authenticatedFetch(`${API_BASE}/users`);
    return res.json();
  },

  async getContests(): Promise<{ contests: Contest[] }> {
    const res = await authenticatedFetch(`${API_BASE}/contests`);
    return res.json();
  },

  async getStudentContests(): Promise<{ contests: (Contest & { computedStatus: 'UPCOMING' | 'LIVE' | 'ENDED' })[] }> {
    const res = await authenticatedFetch(`${API_BASE}/student/contests`);
    return res.json();
  },

  async getContestSets(id: string): Promise<{ sets: any[] }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}/sets`);
    if (!res.ok) throw new Error('Failed to fetch contest sets');
    return res.json();
  },

  async updateContestControl(id: string, updates: Partial<Contest>): Promise<{ contest: Contest }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}/control`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates)
    });
    return res.json();
  },

  async validateContest(): Promise<{ validation: any }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/validate`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' })
    });
    return res.json();
  },

  async lockContest(id: string): Promise<{ contest: Contest; validation: any }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}/lock`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to lock contest');
    return data;
  },

  async publishContest(id: string): Promise<{ contest: Contest; distributedCount: number; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}/publish`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to publish contest');
    return data;
  },

  async saveContestDraft(id: string, updates: Partial<Contest>): Promise<{ contest: Contest; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}/draft`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save draft');
    return data;
  },

  async updateContest(id: string, updates: Partial<Contest>): Promise<{ contest: Contest; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update contest');
    return data;
  },

  async duplicateContest(id: string): Promise<{ contest: Contest; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}/duplicate`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to duplicate contest');
    return data;
  },

  async deleteContest(id: string): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete contest');
    return data;
  },

  async saveContestSets(id: string, sets: QuestionSet[]): Promise<{ message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}/sets`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ sets })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save contest question sets');
    return data;
  },

  async createBatch(batch: Partial<Batch>): Promise<{ batch: Batch; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/batches`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(batch)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create batch');
    return data;
  },

  async updateBatch(id: string, batch: Partial<Batch>): Promise<{ batch: Batch; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/batches/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(batch)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update batch');
    return data;
  },

  async deleteBatch(id: string): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/batches/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete batch');
    return data;
  },

  async duplicateBatch(id: string): Promise<{ batch: Batch; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/batches/${id}/duplicate`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to duplicate batch');
    return data;
  },

  async createRound(round: Partial<Round>): Promise<{ round: Round; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/rounds`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(round)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create round');
    return data;
  },

  async updateRound(id: string, round: Partial<Round>): Promise<{ round: Round; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/rounds/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(round)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update round');
    return data;
  },

  async duplicateRound(id: string): Promise<{ round: Round; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/rounds/${id}/duplicate`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to duplicate round');
    return data;
  },

  async duplicateProblem(id: string): Promise<{ problem: Problem; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/problems/${id}/duplicate`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to duplicate problem');
    return data;
  },

  async bulkImportProblems(problems: any[], options?: { onDuplicate?: 'skip' | 'replace' | 'version' | 'upsert' | 'overwrite'; defaultRoundId?: string }) {
    const res = await authenticatedFetch(`${API_BASE}/problems/bulk-import`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ problems, options })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Bulk import failed');
    return data;
  },

  async getBatches(): Promise<{ batches: Batch[] }> {
    const res = await authenticatedFetch(`${API_BASE}/batches`);
    return res.json();
  },

  async getRounds(): Promise<{ rounds: Round[] }> {
    const res = await authenticatedFetch(`${API_BASE}/rounds`);
    return res.json();
  },

  async getProblems(roundId?: string): Promise<{ problems: Problem[] }> {
    const query = roundId ? `?roundId=${roundId}` : '';
    const res = await authenticatedFetch(`${API_BASE}/problems${query}`);
    return res.json();
  },

  async getAdminProblems(roundId?: string): Promise<{ problems: Problem[] }> {
    const query = roundId ? `?roundId=${roundId}` : '';
    const res = await authenticatedFetch(`${API_BASE}/problems/admin${query}`);
    return res.json();
  },

  async createProblem(problem: Partial<Problem>): Promise<{ problem: Problem; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/problems`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(problem)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create problem');
    return data;
  },

  async updateProblem(problemId: string, problem: Partial<Problem>): Promise<{ problem: Problem; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/problems/${problemId}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(problem)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update problem');
    return data;
  },

  async deleteProblem(problemId: string): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/problems/${problemId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete problem');
    return data;
  },

  async getQuestionSets(roundId?: string): Promise<{ sets: QuestionSet[] }> {
    const query = roundId ? `?roundId=${roundId}` : '';
    const res = await authenticatedFetch(`${API_BASE}/question-sets${query}`);
    return res.json();
  },

  async saveQuestionSet(data: { id?: string; name: string; roundId: string; problemIds: string[]; description?: string }): Promise<{ set: QuestionSet; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/question-sets`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save question set');
    return result;
  },

  async deleteQuestionSet(id: string): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/question-sets/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete question set');
    return result;
  },

  async saveAllQuestionSets(roundId: string, sets: Array<{ id?: string; name: string; problemIds: string[]; description?: string }>): Promise<{ sets: QuestionSet[]; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/question-sets/builder/save-all`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ roundId, sets })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save question sets');
    return result;
  },

  async validateQuestionSetsConfig(params: {
    roundId?: string;
    setCount: number;
    questionsPerSet: number;
    difficultyPattern: string[];
    allowCrossSetDuplicates?: boolean;
  }): Promise<{ report: any }> {
    const res = await authenticatedFetch(`${API_BASE}/question-sets/validate-config`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to validate question sets');
    return result;
  },

  async randomizeQuestionSets(params: {
    roundId?: string;
    setCount: number;
    questionsPerSet: number;
    difficultyPattern: string[];
    allowCrossSetDuplicates?: boolean;
  }): Promise<{ sets: QuestionSet[]; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/question-sets/randomize`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to randomize question sets');
    return result;
  },

  async getChallengeLibrary(params?: {
    roundId?: string;
    search?: string;
    difficulty?: string;
    category?: string;
    status?: string;
  }): Promise<{ challenges: Problem[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.roundId) q.append('roundId', params.roundId);
    if (params?.search) q.append('search', params.search);
    if (params?.difficulty) q.append('difficulty', params.difficulty);
    if (params?.category) q.append('category', params.category);
    if (params?.status) q.append('status', params.status);
    const res = await authenticatedFetch(`${API_BASE}/challenges/library?${q.toString()}`);
    return res.json();
  },

  async autoGenerateQuestionSets(params: { roundId?: string; setCount: number; questionsPerSet: number }): Promise<{ sets: QuestionSet[]; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/question-sets/auto-generate`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to auto-generate sets');
    return result;
  },

  async distributeQuestionSets(roundId?: string): Promise<{ result: { updatedAssignmentsCount: number }; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/question-sets/distribute`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ roundId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to distribute question sets');
    return result;
  },

  async getMyAssignment(roundId?: string): Promise<{ assignment: QuestionAssignment }> {
    const query = roundId ? `?roundId=${roundId}` : '';
    const res = await authenticatedFetch(`${API_BASE}/assignments/me${query}`);
    if (!res.ok) throw new Error('Failed to fetch question assignment');
    return res.json();
  },

  async getAllAssignments(): Promise<{ assignments: (QuestionAssignment & { user: User | null })[] }> {
    const res = await authenticatedFetch(`${API_BASE}/assignments`);
    return res.json();
  },

  async runSampleCode(problemId: string, code: string, language: string) {
    const res = await authenticatedFetch(`${API_BASE}/code/run-sample`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ problemId, code, language, sourceCode: code })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to run code');
    }
    return res.json();
  },

  async getExecutionHealth(): Promise<{
    healthy: boolean;
    serviceUrl: string;
    error?: string;
    python?: { available: boolean; version: string };
    java?: { available: boolean; version: string };
    cpp?: { available: boolean; version: string };
    c?: { available: boolean; version: string };
    javascript?: { available: boolean; version: string };
    languages?: Record<string, boolean>;
    supportedLanguages: Array<{ id: number; name: string }>;
  }> {
    const res = await authenticatedFetch(`${API_BASE}/execution/health`);
    if (!res.ok) throw new Error('Failed to fetch execution health');
    return res.json();
  },

  async submitCode(problemId: string, code: string, language: string, roundId?: string, contestId?: string): Promise<{ submissionId: string; status: string }> {
    const res = await authenticatedFetch(`${API_BASE}/code/submit`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ problemId, code, language, roundId, contestId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Submission failed');
    }
    return res.json();
  },

  async getSubmission(id: string): Promise<{ submission: Submission }> {
    const res = await authenticatedFetch(`${API_BASE}/submissions/${id}`);
    if (!res.ok) throw new Error('Submission not found');
    return res.json();
  },

  async getSubmissions(params?: { userId?: string; problemId?: string; roundId?: string; contestId?: string }): Promise<{ submissions: Submission[] }> {
    const search = new URLSearchParams();
    if (params?.userId) search.append('userId', params.userId);
    if (params?.problemId) search.append('problemId', params.problemId);
    if (params?.roundId) search.append('roundId', params.roundId);
    if (params?.contestId) search.append('contestId', params.contestId);
    const res = await authenticatedFetch(`${API_BASE}/submissions?${search.toString()}`);
    return res.json();
  },

  async getMyAttempt(roundId?: string, contestId?: string): Promise<{ attempt: ContestAttempt | null }> {
    const params = new URLSearchParams();
    if (roundId) params.append('roundId', roundId);
    if (contestId) params.append('contestId', contestId);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await authenticatedFetch(`${API_BASE}/attempts/me${query}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch attempt status');
    return res.json();
  },

  async startAttempt(roundId?: string, termsAccepted: boolean = true, contestId?: string): Promise<{ attempt: ContestAttempt }> {
    const res = await authenticatedFetch(`${API_BASE}/attempts/start`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ roundId, termsAccepted, contestId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to start attempt');
    return data;
  },

  async transitionAttemptToActive(contestId?: string): Promise<{ attempt: ContestAttempt }> {
    const res = await authenticatedFetch(`${API_BASE}/attempts/transition-active`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ contestId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to activate contest attempt');
    return data;
  },

  async submitDeadlineAttempt(roundId?: string, reason?: string, contestId?: string): Promise<{ success: boolean; attempt: ContestAttempt; submissions: Submission[] }> {
    const res = await authenticatedFetch(`${API_BASE}/attempts/deadline-submit`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ roundId, reason, contestId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to auto-submit attempt');
    return data;
  },

  async completeAttempt(roundId?: string, contestId?: string): Promise<{ success: boolean; attempt: ContestAttempt; submissions: Submission[] }> {
    const res = await authenticatedFetch(`${API_BASE}/attempts/complete`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ roundId, contestId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to complete contest attempt');
    return data;
  },

  async finalSubmit(contestId: string, attemptId: string, payload?: { isAutoSubmit?: boolean; codeMap?: Record<string, any>; roundId?: string }): Promise<{
    success: boolean;
    easyScore: number;
    easyMax: number;
    mediumScore: number;
    mediumMax: number;
    hardScore: number;
    hardMax: number;
    totalScore: number;
    totalMax: number;
    attemptStatus: string;
    message: string;
  }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${encodeURIComponent(contestId)}/attempts/${encodeURIComponent(attemptId)}/final-submit`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Final submission failed');
    return data;
  },

  async sessionHeartbeat(userId: string, sessionId: string): Promise<{ active: boolean; conflict?: boolean; error?: string }> {
    const res = await authenticatedFetch(`${API_BASE}/auth/session/heartbeat`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ userId, sessionId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { active: false, conflict: true, error: data.error || 'Session heartbeat failed' };
    }
    return data;
  },

  async logout(userId?: string, sessionId?: string): Promise<void> {
    const uid = userId || storedUserId;
    const sid = sessionId || storedSessionId;
    if (uid) {
      await authenticatedFetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId: uid, sessionId: sid })
      }).catch(() => {});
    }
    setAuthUserId(null, null);
  },

  async recordAntiCheatEvent(eventType: string, details?: string, metadata?: any): Promise<any> {
    const res = await authenticatedFetch(`${API_BASE}/anti-cheat/event`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ eventType, details, metadata, studentId: storedUserId })
    }).catch(() => null);
    return res ? res.json().catch(() => null) : null;
  },

  async autosaveCode(problemId: string, code: string, language: string, contestId?: string): Promise<{ success: boolean; savedAt: string; attemptStatus: string }> {
    const res = await authenticatedFetch(`${API_BASE}/attempts/autosave`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ problemId, code, language, contestId })
    });
    return res.json();
  },

  async recordViolation(type: string, details: string, roundId?: string, metadata?: Record<string, any>): Promise<{
    securityState: ParticipantSecurityState;
    attempt?: ContestAttempt;
    isTerminated?: boolean;
    autoSubmitted?: boolean;
    warningMessage?: string;
  }> {
    const res = await authenticatedFetch(`${API_BASE}/anticheat/violation`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ type, details, roundId, metadata })
    });
    return res.json();
  },

  async recordSecurityEvent(eventType: string, details: string, roundId?: string, metadata?: Record<string, any>): Promise<{
    securityState: ParticipantSecurityState;
    attempt?: ContestAttempt;
    isTerminated?: boolean;
    autoSubmitted?: boolean;
    warningMessage?: string;
  }> {
    const res = await authenticatedFetch(`${API_BASE}/security/events`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ eventType, details, roundId, metadata })
    });
    return res.json();
  },

  async getSecurityMatrix(): Promise<{ securityMatrix: (ParticipantSecurityState & { user: User | null })[] }> {
    const res = await authenticatedFetch(`${API_BASE}/anticheat/matrix`);
    return res.json();
  },

  async adminSecurityOverride(userId: string, reason: string, roundId?: string): Promise<{ securityState: ParticipantSecurityState }> {
    const res = await this.adminUnlockAttempt('contest-grand-prix-2026', userId, reason);
    return { securityState: res.securityState };
  },

  async getAdminLeaderboard(contestId: string, roundId?: string, batchId?: string): Promise<{ leaderboard: LeaderboardEntry[] }> {
    const search = new URLSearchParams();
    if (roundId) search.append('roundId', roundId);
    if (batchId) search.append('batchId', batchId);
    const res = await authenticatedFetch(`${API_BASE}/admin/contests/${contestId}/leaderboard?${search.toString()}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getLeaderboard(roundId?: string, batchId?: string): Promise<{ leaderboard: LeaderboardEntry[] }> {
    const search = new URLSearchParams();
    if (roundId) search.append('roundId', roundId);
    if (batchId) search.append('batchId', batchId);
    const res = await authenticatedFetch(`${API_BASE}/leaderboard?${search.toString()}`);
    return res.json();
  },

  async finalizeRound1(cutoffRank: number): Promise<{ qualifiedCount: number; qualifiedParticipants: LeaderboardEntry[]; round2: Round }> {
    const res = await authenticatedFetch(`${API_BASE}/qualification/finalize-round1`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ cutoffRank })
    });
    if (!res.ok) throw new Error('Failed to finalize round 1');
    return res.json();
  },

  async getPlagiarismReport(problemId?: string): Promise<{ comparisons: PlagiarismComparison[] }> {
    const query = problemId ? `?problemId=${problemId}` : '';
    const res = await authenticatedFetch(`${API_BASE}/plagiarism/scan${query}`);
    return res.json();
  },

  async runSimulation(users: number = 50): Promise<{ submissionsGenerated: number; antiCheatEventsTriggered: number; queuedCount: number }> {
    const res = await authenticatedFetch(`${API_BASE}/simulator/run`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ users })
    });
    return res.json();
  },

  async getSystemHealth(): Promise<SystemHealth> {
    const res = await authenticatedFetch(`${API_BASE}/health`);
    return res.json();
  },

  async getAuditLogs(): Promise<{ logs: AuditLog[] }> {
    const res = await authenticatedFetch(`${API_BASE}/audit-logs`);
    return res.json();
  },

  // ==========================================
  // CHALLENGES AUTHORING & MANAGEMENT
  // ==========================================

  async getChallenges(filters?: {
    difficulty?: string;
    category?: string;
    status?: string;
    search?: string;
    tag?: string;
    language?: string;
  }): Promise<{ challenges: any[] }> {
    const searchParams = new URLSearchParams();
    if (filters?.difficulty) searchParams.append('difficulty', filters.difficulty);
    if (filters?.category) searchParams.append('category', filters.category);
    if (filters?.status) searchParams.append('status', filters.status);
    if (filters?.search) searchParams.append('search', filters.search);
    if (filters?.tag) searchParams.append('tag', filters.tag);
    if (filters?.language) searchParams.append('language', filters.language);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await authenticatedFetch(`${API_BASE}/admin/challenges${query}`);
    if (!res.ok) throw new Error('Failed to fetch challenges');
    return res.json();
  },

  async getChallenge(id: string): Promise<{ challenge: any }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/challenges/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch challenge');
    return data;
  },

  async createChallenge(payload: any): Promise<{ challenge: any; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/challenges`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create challenge');
    return data;
  },

  async updateChallenge(id: string, payload: any): Promise<{ challenge: any; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/challenges/${id}`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update challenge');
    return data;
  },

  async deleteChallenge(id: string): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/challenges/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete challenge');
    return data;
  },

  async duplicateChallenge(id: string): Promise<{ challenge: any; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/challenges/${id}/duplicate`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to duplicate challenge');
    return data;
  },

  async publishChallenge(id: string): Promise<{ challenge: any; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/challenges/${id}/publish`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to publish challenge');
    return data;
  },

  async archiveChallenge(id: string): Promise<{ challenge: any; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/challenges/${id}/archive`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to archive challenge');
    return data;
  },

  async saveChallengeTestCases(id: string, testCases: any[]): Promise<{ challenge: any; testCases: any[]; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/challenges/${id}/test-cases`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ testCases })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save test cases');
    return data;
  },

  async getChallengePreview(id: string): Promise<{ challenge: any }> {
    const res = await authenticatedFetch(`${API_BASE}/challenges/${id}/preview`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to preview challenge');
    return data;
  },

  // ==========================================
  // STUDENT MANAGEMENT
  // ==========================================

  async getStudents(params?: {
    search?: string;
    status?: string;
    institution?: string;
    department?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    students: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    stats: {
      total: number;
      active: number;
      inactive: number;
      institutionsCount: number;
      departmentsCount: number;
    };
  }> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.status) q.append('status', params.status);
    if (params?.institution) q.append('institution', params.institution);
    if (params?.department) q.append('department', params.department);
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));

    const res = await authenticatedFetch(`${API_BASE}/students?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch students');
    return res.json();
  },

  async getStudent(id: string): Promise<{ student: any }> {
    const res = await authenticatedFetch(`${API_BASE}/students/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch student');
    return data;
  },

  async createStudent(payload: {
    studentId: string;
    name: string;
    email: string;
    username: string;
    password?: string;
    college?: string;
    department?: string;
    year?: string;
    phone?: string;
    status?: string;
  }): Promise<{ student: any; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create student');
    return data;
  },

  async updateStudent(id: string, payload: any): Promise<{ student: any; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/students/${id}`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update student');
    return data;
  },

  async resetStudentPassword(id: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/students/${id}/reset-password`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset password');
    return data;
  },

  async deleteStudent(id: string): Promise<{ success: boolean; message: string; softDeactivated?: boolean }> {
    const res = await authenticatedFetch(`${API_BASE}/students/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete student');
    return data;
  },

  // ==========================================
  // ANTI-CHEAT SETTINGS & CONTEST ACTIONS
  // ==========================================

  async getAntiCheatSettings(): Promise<{ settings: any; antiCheatConfig: any }> {
    const res = await authenticatedFetch(`${API_BASE}/settings/anticheat`);
    if (!res.ok) throw new Error('Failed to fetch security settings');
    return res.json();
  },

  async updateAntiCheatSettings(updates: any): Promise<{ success: boolean; message: string; settings: any }> {
    const res = await authenticatedFetch(`${API_BASE}/settings/anticheat`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update security settings');
    return data;
  },

  async archiveContest(id: string): Promise<{ contest: any; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/contests/${id}/archive`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to archive contest');
    return data;
  },

  async getAdminSessions(): Promise<{ success: boolean; sessions: any[] }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/sessions`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch active sessions');
    return res.json();
  },

  async adminForceLogoutSession(studentId: string, sessionId?: string): Promise<{ success: boolean; message: string }> {
    const res = await authenticatedFetch(`${API_BASE}/admin/sessions/force-logout`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ studentId, sessionId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to force logout student session');
    return data;
  }
};
