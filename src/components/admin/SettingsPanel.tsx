import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  Copy,
  Terminal,
  Monitor,
  Bell
} from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    maxTabSwitches: 3,
    lockdownFullscreen: true,
    blockClipboardPaste: true,
    copyProtection: true,
    pasteProtection: true,
    devToolsDetection: true,
    windowFocusMonitoring: true,
    autoSubmitOnViolations: true,
    showWarningPopup: true
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getAntiCheatSettings();
      if (res.settings || res.antiCheatConfig) {
        const s = res.settings || {};
        const c = res.antiCheatConfig || {};
        setSettings({
          maxTabSwitches: c.maxTabSwitches ?? s.maxTabSwitches ?? 3,
          lockdownFullscreen: c.lockdownFullscreen ?? s.lockdownFullscreen ?? true,
          blockClipboardPaste: c.blockClipboardPaste ?? s.blockClipboardPaste ?? true,
          copyProtection: s.copyProtection ?? true,
          pasteProtection: s.pasteProtection ?? true,
          devToolsDetection: s.devToolsDetection ?? true,
          windowFocusMonitoring: s.windowFocusMonitoring ?? true,
          autoSubmitOnViolations: s.autoSubmitOnViolations ?? true,
          showWarningPopup: s.showWarningPopup ?? true
        });
      }
    } catch (err: any) {
      console.error('Failed to load anti-cheat settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleToggle = (key: keyof typeof settings) => {
    if (key === 'maxTabSwitches') return;
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      await api.updateAntiCheatSettings(settings);
      setActionSuccess('Security & Anti-Cheat settings saved successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update anti-cheat settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center text-gray-500 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <span className="text-xs font-semibold">Loading security & anti-cheat configuration...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        </div>
      )}

      {/* Settings Header */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight">Security & Anti-Cheat Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure proctoring strictness, browser lockdown rules, and automated violation handlers.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer shrink-0"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Settings</span>
        </button>
      </div>

      {/* Settings Form List */}
      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-6">
        
        {/* Maximum Tab Switches */}
        <div className="flex items-center justify-between p-4 bg-gray-50/70 border border-gray-200 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-gray-900">Maximum Tab Switches</h4>
              <p className="text-xs text-gray-500">Allowed tab switches or focus departures before session termination.</p>
            </div>
          </div>

          <div className="w-24">
            <input
              type="number"
              min="1"
              max="10"
              value={settings.maxTabSwitches}
              onChange={(e) => setSettings({ ...settings, maxTabSwitches: Number(e.target.value) })}
              className="w-full bg-white border border-gray-300 text-center text-sm font-black rounded-xl py-1.5 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Toggle List */}
        <div className="space-y-3">
          {[
            {
              key: 'lockdownFullscreen' as const,
              title: 'Fullscreen Lock',
              description: 'Mandate full-screen mode during active examination session.',
              icon: Lock
            },
            {
              key: 'clipboardBlocking' as const,
              title: 'Clipboard Blocking',
              description: 'Prevent system clipboard access during test execution.',
              icon: Copy
            },
            {
              key: 'copyProtection' as const,
              title: 'Copy Protection',
              description: 'Block text selecting, dragging, and context-menu copying of problem text.',
              icon: Copy
            },
            {
              key: 'pasteProtection' as const,
              title: 'Paste Protection',
              description: 'Prevent external source code pasting into the Monaco editor.',
              icon: Copy
            },
            {
              key: 'devToolsDetection' as const,
              title: 'DevTools Detection',
              description: 'Detect F12 inspect element, browser console, and debugger attachments.',
              icon: Terminal
            },
            {
              key: 'windowFocusMonitoring' as const,
              title: 'Window Focus Monitoring',
              description: 'Track window blur events and second screen display connections.',
              icon: Monitor
            },
            {
              key: 'autoSubmitOnViolations' as const,
              title: 'Auto Submit on Maximum Violations',
              description: 'Automatically force-submit student exam upon reaching tab switch threshold.',
              icon: ShieldAlert
            },
            {
              key: 'showWarningPopup' as const,
              title: 'Show Warning Popup',
              description: 'Display warning modal overlay when a candidate departs the assessment window.',
              icon: Bell
            }
          ].map(({ key, title, description, icon: Icon }) => {
            const isChecked = !!settings[key as keyof typeof settings];
            return (
              <div
                key={key}
                className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 border border-gray-200/80 rounded-2xl transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-700">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{title}</h4>
                    <p className="text-[11px] text-gray-500">{description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle(key as keyof typeof settings)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isChecked ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isChecked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Save Footer */}
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Security Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
