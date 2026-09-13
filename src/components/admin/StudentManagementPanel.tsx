import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  Users,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Building,
  GraduationCap,
  Calendar,
  X,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  UserX
} from 'lucide-react';

export const StudentManagementPanel: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total: 0,
    active: 0,
    inactive: 0,
    institutionsCount: 0,
    departmentsCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Modals
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [passwordModalStudent, setPasswordModalStudent] = useState<any | null>(null);
  const [deleteModalStudent, setDeleteModalStudent] = useState<any | null>(null);
  const [viewStudent, setViewStudent] = useState<any | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    email: '',
    username: '',
    password: '',
    college: '',
    department: '',
    year: '3rd Year',
    phone: '',
    status: 'ACTIVE'
  });
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await api.getStudents({
        search,
        status: statusFilter,
        department: departmentFilter,
        page,
        limit: 20
      });
      const resData = res as any;
      setStudents(resData.students || []);
      setPagination({
        page: resData.page || resData.pagination?.page || 1,
        limit: resData.limit || resData.pagination?.limit || 20,
        total: resData.total || resData.pagination?.total || 0,
        totalPages: resData.totalPages || resData.pagination?.totalPages || 1
      });
      setStats({
        total: resData.stats?.total ?? resData.total ?? 0,
        active: resData.stats?.active ?? resData.activeCount ?? 0,
        inactive: resData.stats?.inactive ?? resData.inactiveCount ?? 0,
        institutionsCount: resData.stats?.institutionsCount ?? resData.institutionCount ?? (resData.availableInstitutions?.length || 1),
        departmentsCount: resData.stats?.departmentsCount ?? (resData.availableDepartments?.length || 1)
      });
    } catch (err: any) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, statusFilter, departmentFilter, page]);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setFormData({
      studentId: `STU-2026-${randomDigits}`,
      name: '',
      email: '',
      username: '',
      password: `Pass@${randomDigits}`,
      college: 'Institute of Technology',
      department: 'Computer Science',
      year: '3rd Year',
      phone: '',
      status: 'ACTIVE'
    });
    setFormError(null);
    setAddEditModalOpen(true);
  };

  const handleOpenEdit = (stu: any) => {
    setEditingStudent(stu);
    setFormData({
      studentId: stu.studentId || stu.id,
      name: stu.name || '',
      email: stu.email || '',
      username: stu.username || '',
      password: '', // Leave empty unless changing
      college: stu.college || 'Institute of Technology',
      department: stu.department || 'Computer Science',
      year: stu.year || '3rd Year',
      phone: stu.phone || '',
      status: stu.status || 'ACTIVE'
    });
    setFormError(null);
    setAddEditModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.username.trim() || !formData.studentId.trim()) {
      setFormError('Student ID, Name, Email, and Username are required.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editingStudent) {
        await api.updateStudent(editingStudent.id, formData);
        setActionSuccess(`Updated student ${formData.name}`);
      } else {
        await api.createStudent(formData);
        setActionSuccess(`Created new student ${formData.name}`);
      }
      setAddEditModalOpen(false);
      fetchStudents();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save student record');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalStudent || !newPassword.trim()) return;

    setSaving(true);
    try {
      await api.resetStudentPassword(passwordModalStudent.id, newPassword.trim());
      setActionSuccess(`Password reset successfully for ${passwordModalStudent.name}`);
      setPasswordModalStudent(null);
      setNewPassword('');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalStudent) return;
    setSaving(true);
    try {
      const res = await api.deleteStudent(deleteModalStudent.id);
      setActionSuccess(res.message);
      setDeleteModalStudent(null);
      fetchStudents();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Students</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{stats.total || 0}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{stats.active || 0}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inactive</span>
            <div className="p-2 bg-gray-100 text-gray-600 rounded-xl">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-600 mt-2">{stats.inactive || 0}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Institutions</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{stats.institutionsCount || 1}</p>
        </div>
      </div>

      {/* Controls & Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, ID, username..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl pl-9 pr-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition"
            />
          </div>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
            className="bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          >
            <option value="">All Departments</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Software Engineering">Software Engineering</option>
            <option value="Data Science">Data Science</option>
            <option value="Electronics & Communication">Electronics & Communication</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {/* Add Student Button */}
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Student</span>
        </button>
      </div>

      {/* Student Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <span className="text-xs font-semibold">Loading student records...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center">
            <Users className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-sm font-bold text-gray-800">No students found</p>
            <p className="text-xs text-gray-500 mt-1">Try adjusting search filters or add a new student.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Email & Username</th>
                  <th className="px-4 py-3">College & Dept</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((stu) => (
                  <tr key={stu.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">
                      {stu.studentId || stu.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{stu.name}</div>
                      <div className="text-[10px] text-gray-500">ID: {stu.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 font-medium">{stu.email}</div>
                      <div className="text-[10px] text-gray-400 font-mono">@{stu.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800 truncate max-w-[180px]">
                        {stu.college || 'Institute of Technology'}
                      </div>
                      <div className="text-[10px] text-gray-500">{stu.department || 'Computer Science'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 text-gray-700 font-medium text-[11px] px-2 py-0.5 rounded-md border border-gray-200">
                        {stu.year || '3rd Year'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          stu.status === 'ACTIVE' || !stu.status
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {stu.status === 'ACTIVE' || !stu.status ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-gray-400" /> Inactive
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewStudent(stu)}
                          title="View Details"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(stu)}
                          title="Edit Student"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setPasswordModalStudent(stu);
                            const randomDigits = Math.floor(1000 + Math.random() * 9000);
                            setNewPassword(`Reset@${randomDigits}`);
                          }}
                          title="Reset Password"
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteModalStudent(stu)}
                          title="Delete Student"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40 font-bold hover:bg-gray-100 transition"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-white border border-gray-200 rounded-lg disabled:opacity-40 font-bold hover:bg-gray-100 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {addEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">
                {editingStudent ? 'Edit Student Details' : 'Add New Student'}
              </h3>
              <button onClick={() => setAddEditModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="py-4 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Student ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    placeholder="e.g. STU-2026-101"
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-mono font-bold rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alexandra Chen"
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alex@university.edu"
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="alex_chen"
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-mono font-bold rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {!editingStudent && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-mono rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    College / Institution
                  </label>
                  <input
                    type="text"
                    value={formData.college}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                    placeholder="Institute of Technology"
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Computer Science"
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-medium rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Academic Year
                </label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Postgraduate">Postgraduate</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddEditModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingStudent ? 'Save Changes' : 'Create Student'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {passwordModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <h3 className="text-base font-black text-gray-900">Reset Student Password</h3>
              </div>
              <button onClick={() => setPasswordModalStudent(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="py-4 space-y-4">
              <p className="text-xs text-gray-600">
                Reset login password for <strong className="text-gray-900">{passwordModalStudent.name}</strong> (
                {passwordModalStudent.email}).
              </p>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 text-xs font-mono font-bold rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const randomDigits = Math.floor(1000 + Math.random() * 9000);
                      setNewPassword(`Reset@${randomDigits}`);
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalStudent(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Reset Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Confirmation Modal */}
      {deleteModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100 text-red-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-black text-gray-900">Confirm Account Removal</h3>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-gray-600">
                Are you sure you want to remove <strong className="text-gray-900">{deleteModalStudent.name}</strong> (
                {deleteModalStudent.studentId || deleteModalStudent.id})?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px]">
                Note: If this student has active contest submission history, the account will be safely switched to{' '}
                <strong>INACTIVE</strong> status to preserve audit compliance.
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteModalStudent(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={saving}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Removal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Student Details Modal */}
      {viewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">Student Profile Summary</h3>
              <button onClick={() => setViewStudent(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm">
                  {viewStudent.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{viewStudent.name}</div>
                  <div className="text-[11px] font-mono text-indigo-600">{viewStudent.studentId || viewStudent.id}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-gray-400 block font-bold">EMAIL</span>
                  <span className="font-semibold text-gray-800 break-all">{viewStudent.email}</span>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-gray-400 block font-bold">USERNAME</span>
                  <span className="font-semibold text-gray-800">@{viewStudent.username}</span>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-gray-400 block font-bold">DEPARTMENT</span>
                  <span className="font-semibold text-gray-800">{viewStudent.department || 'Computer Science'}</span>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-gray-400 block font-bold">YEAR</span>
                  <span className="font-semibold text-gray-800">{viewStudent.year || '3rd Year'}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setViewStudent(null)}
                className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
