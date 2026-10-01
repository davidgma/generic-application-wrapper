import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Install GAW as Desktop or Mobile App"
        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        {!compact && <span>Install App</span>}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Install on iPhone / iPad"
          className={`flex items-center gap-1.5 rounded border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
          {!compact && <span>Install iOS</span>}
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-semibold">Install GAW on iOS</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px]">1</span>
                  <p>In Safari, tap the <strong className="text-indigo-300">Share</strong> button at the bottom navigation bar.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px]">2</span>
                  <p>Scroll down in the action sheet and select <strong className="text-indigo-300">Add to Home Screen</strong>.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px]">3</span>
                  <p>Tap <strong className="text-indigo-300">Add</strong>. GAW will now launch fullscreen with native offline SQLite storage!</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-slate-200 transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
