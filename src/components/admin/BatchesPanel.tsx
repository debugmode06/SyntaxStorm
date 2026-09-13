import React, { useState, useEffect } from 'react';
import { Batch, User } from '../../types';
import { api } from '../../api';
import { Users, Plus, X, Trash2, Search, GraduationCap } from 'lucide-react';

export const BatchesPanel: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchStudents, setBatchStudents] = useState<User[]>([]);
  
  const [newBatchName, setNewBatchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Add students to batch modal
  const [isAddingStudents, setIsAddingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBatches();
    fetchStudents();
  }, []);

  const fetchBatches = async () => {
    try {
      const res = await api.getAdminBatches();
      setBatches(res.batches || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await api.getUsers();
      setStudents(res.users.filter(u => u.role === 'PARTICIPANT'));
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadBatchStudents = async (batchId: string) => {
    try {
      const res = await api.getAdminBatchStudents(batchId);
      setBatchStudents(res.students || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.createAdminBatch(newBatchName);
      setNewBatchName('');
      setIsCreating(false);
      fetchBatches();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddStudents = async () => {
    if (!selectedBatch || selectedStudentIds.size === 0) return;
    try {
      await api.addStudentsToAdminBatch(selectedBatch.id, Array.from(selectedStudentIds));
      setIsAddingStudents(false);
      setSelectedStudentIds(new Set());
      loadBatchStudents(selectedBatch.id);
      fetchBatches();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedBatch) return;
    if (!confirm('Are you sure you want to remove this student from the batch?')) return;
    try {
      await api.removeStudentFromAdminBatch(selectedBatch.id, studentId);
      loadBatchStudents(selectedBatch.id);
      fetchBatches();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredStudents = students.filter(s => {
    if (s.batchId === selectedBatch?.id) return false; // Already in batch
    const q = searchQuery.toLowerCase();
    return (s.name?.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.studentId?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>Batch Management</span>
          </h2>
          <p className="text-sm text-gray-500">Create cohorts and assign students</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Batch</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {batches.map(batch => (
            <div
              key={batch.id}
              onClick={() => {
                setSelectedBatch(batch);
                loadBatchStudents(batch.id);
              }}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedBatch?.id === batch.id
                  ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <h3 className="font-bold text-gray-900">{batch.name}</h3>
              <div className="mt-2 text-sm text-gray-500 flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <GraduationCap className="w-4 h-4" />
                  <span>{batch.studentCount || 0} students</span>
                </span>
                <span>{batch.contestCount || 0} contests</span>
              </div>
            </div>
          ))}
          {batches.length === 0 && (
            <div className="text-center p-8 border border-dashed border-gray-300 rounded-2xl text-gray-500 text-sm">
              No batches created yet.
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedBatch ? (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedBatch.name}</h3>
                  <p className="text-sm text-gray-500">{batchStudents.length} Students</p>
                </div>
                <button
                  onClick={() => setIsAddingStudents(true)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Students</span>
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-6 py-3">Student Name</th>
                      <th className="px-6 py-3">Student ID</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {batchStudents.map(student => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{student.studentId || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleRemoveStudent(student.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {batchStudents.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500 text-sm">
                          No students in this batch yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-3xl border border-gray-200 border-dashed flex items-center justify-center h-full min-h-[300px]">
              <div className="text-gray-400 flex flex-col items-center">
                <Users className="w-12 h-12 mb-2 opacity-50" />
                <p>Select a batch to view students</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Create New Batch</h3>
              <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Batch Name</label>
                <input
                  type="text"
                  required
                  value={newBatchName}
                  onChange={e => setNewBatchName(e.target.value)}
                  placeholder="e.g. CS 2024"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div className="flex justify-end pt-4">
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700">
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingStudents && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Students to {selectedBatch.name}</h3>
              <button onClick={() => { setIsAddingStudents(false); setSelectedStudentIds(new Set()); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
            <div className="overflow-y-auto flex-1 border border-gray-200 rounded-xl">
              {filteredStudents.map(s => (
                <div key={s.id} className="flex items-center p-3 border-b border-gray-100 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.has(s.id)}
                    onChange={(e) => {
                      const next = new Set(selectedStudentIds);
                      if (e.target.checked) next.add(s.id);
                      else next.delete(s.id);
                      setSelectedStudentIds(next);
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded-sm"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-sm text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.email} • {s.studentId || 'No ID'}</div>
                  </div>
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No matching unassigned students found.
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-between items-center">
              <span className="text-sm text-gray-500">{selectedStudentIds.size} selected</span>
              <button
                onClick={handleAddStudents}
                disabled={selectedStudentIds.size === 0}
                className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                Add Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
