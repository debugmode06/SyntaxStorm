import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types';
import { api } from '../../api';
import { FileText, Shield, User, Clock, Search } from 'lucide-react';

export const AuditLogsPanel: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.getAuditLogs()
      .then(res => setLogs(res.logs || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(
    l =>
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.performedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-black text-gray-900 tracking-tight">
              Immutable Security & System Audit Trail
            </h2>
          </div>
          <p className="text-xs text-gray-500">
            Append-only event log capturing all jury decisions, anti-cheat terminations, overrides, and submissions.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter audit events..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action Type</th>
              <th className="px-4 py-3">Actor / Target</th>
              <th className="px-4 py-3">Event Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
            {filtered.map(log => (
              <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                      log.action.includes('TERMINATION')
                        ? 'bg-red-100 text-red-800'
                        : log.action.includes('OVERRIDE')
                        ? 'bg-purple-100 text-purple-800'
                        : log.action.includes('FINALIZED')
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {log.action}
                  </span>
                </td>

                <td className="px-4 py-3 text-gray-800 font-bold">
                  {log.performedBy}
                </td>

                <td className="px-4 py-3 text-gray-700 font-sans text-xs">
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
