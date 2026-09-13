import React, { useState } from 'react';
import { CreateContestPayload } from '../types';
import { api } from '../api';
import { parseLocalDateTime } from '../utils/timezone';
import {
  Trophy,
  X,
  Clock,
  Shield,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface CreateContestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContestCreated: () => void;
}

export const CreateContestModal: React.FC<CreateContestModalProps> = ({
  isOpen,
  onClose,
  onContestCreated
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [title, setTitle] = useState('Apex Code Grand Prix 2026');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endTime, setEndTime] = useState('12:00');
  const [organizationType, setOrganizationType] = useState('University');
  const [organizationName, setOrganizationName] = useState('National Institute of Technology');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a contest title.');
      return;
    }

    const startDateObj = parseLocalDateTime(startDate, startTime, 'Asia/Kolkata');
    const endDateObj = parseLocalDateTime(endDate, endTime, 'Asia/Kolkata');

    if (!startDateObj || !endDateObj) {
      setError('Please provide valid start and end dates and times.');
      return;
    }

    if (endDateObj.getTime() <= startDateObj.getTime()) {
      setError('End date and time must be later than start date and time.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: CreateContestPayload = {
        title: title.trim(),
        description: `Official coding contest held by ${organizationName}.`,
        date: startDate,
        startTime: startDateObj.toISOString(),
        endTime: endDateObj.toISOString(),
        organizationType,
        organizationName,
        timezone: 'Asia/Kolkata / IST',
        status: isDraft ? 'DRAFT' : 'DRAFT',
        setCount: 3,
        questionsPerSet: 3,
        maxTabSwitches: 3,
        lockdownFullscreen: true,
        blockClipboardPaste: true,
        blockContextMenu: true,
        enablePlagiarismDetection: true
      };

      await api.createContest(payload);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onContestCreated();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to create contest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 text-white relative">
          <button
            id="close-create-contest-btn"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Trophy className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                Create New Contest
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                Set up contest timing schedule and organizational details.
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center space-x-3 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Contest created successfully!</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              CONTEST NAME *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Apex Coding Championship 2026"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                START DATE *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                START TIME *
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                END DATE *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                END TIME *
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ORGANIZATION TYPE *
              </label>
              <select
                value={organizationType}
                onChange={e => setOrganizationType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="University">University</option>
                <option value="College">College</option>
                <option value="Enterprise">Enterprise</option>
                <option value="Community">Community</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                ORGANIZATION NAME *
              </label>
              <input
                type="text"
                required
                value={organizationName}
                onChange={e => setOrganizationName(e.target.value)}
                placeholder="e.g. NIT Trichy"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={loading || success}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={loading || success}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Creating...' : 'Create'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
