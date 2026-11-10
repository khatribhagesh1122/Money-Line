import React, { useState } from 'react';
import { DataSourceMode } from '../types/market';
import {
  Settings,
  Moon,
  Sun,
  KeyRound,
  Trash2,
  ShieldCheck,
  Activity,
  CheckCircle2,
} from 'lucide-react';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  voiceLang: 'en' | 'hi';
  onToggleLanguage: () => void;
  dataSource: DataSourceMode;
  onDataSourceChange: (source: DataSourceMode) => void;
  isUpstoxConnected: boolean;
  onOpenUpstoxModal: () => void;
  onClearStorage: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  onToggleTheme,
  isMuted,
  onToggleMute,
  voiceLang,
  onToggleLanguage,
  dataSource,
  onDataSourceChange,
  isUpstoxConnected,
  onOpenUpstoxModal,
  onClearStorage,
}) => {
  const [clearedNotice, setClearedNotice] = useState(false);

  const handleClear = () => {
    onClearStorage();
    setClearedNotice(true);
    setTimeout(() => setClearedNotice(false), 3000);
  };

  return (
    <div className="max-w-4xl space-y-2.5 pb-10">
      {/* Compact Header */}
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-3 sm:p-3.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#477DFF]/15 border border-[#477DFF]/30 text-[#477DFF] flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white">
              Terminal Preferences &amp; Integrations
            </h1>
            <p className="text-[11px] text-[#8B9BB4]">
              Configure data feeds, display themes, and broker connectivity
            </p>
          </div>
        </div>
      </div>

      {/* 24/7 NSE Live Feed & Cross-Device Cloud Sync Card */}
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00C995]/15 text-[#00C995] flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                24/7 NSE Live Market &amp; 3:30 PM Settlement Engine
              </h2>
              <p className="text-xs text-[#8B9BB4]">
                Always-on NSE equities, F&amp;O &amp; multi-timeframe candles on any device — zero daily token required
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 bg-[#00C995]/15 text-[#00C995] border-[#00C995]/30">
            <span className="w-2 h-2 rounded-full bg-[#00C995] animate-pulse" />
            {isUpstoxConnected ? '24/7 LIVE + UPSTOX v2' : '24/7 LIVE FEED ACTIVE'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-[#121C2D] border border-[#00C995]/20 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#00C995]">
              <CheckCircle2 className="w-4 h-4 text-[#00C995] shrink-0" />
              <span>Zero-Token 24/7 Operation</span>
            </div>
            <p className="text-[11px] text-[#8B9BB4] leading-relaxed">
              Streams live NSE prices &amp; 15m/1h/D/W/M candles during market hours (09:15–15:30 IST) and serves official 3:30 PM IST settled prices post-market, weekends &amp; holidays.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#121C2D] border border-[#477DFF]/20 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#477DFF]">
              <ShieldCheck className="w-4 h-4 text-[#477DFF] shrink-0" />
              <span>Cross-Device Cloud Workspace Sync</span>
            </div>
            <p className="text-[11px] text-[#8B9BB4] leading-relaxed">
              Your Watchlist, 7-Parameter Screener filter presets, and Flash Alerts sync automatically across any phone, tablet, or desktop opening this link.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#121C2D] border border-white/[0.07] text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <KeyRound className="w-3.5 h-3.5 text-[#21C8E8]" />
              <span>Optional: Personal Upstox API v2 Direct Broker Override</span>
            </div>
            <p className="text-[11px] text-[#8B9BB4]">
              {isUpstoxConnected
                ? 'Custom Upstox token connected. Will automatically fall back to the 24/7 NSE Live Feed when the token expires.'
                : 'Not required for 24/7 screening. Optionally attach a personal Upstox v2 token if desired.'}
            </p>
          </div>

          <button
            onClick={onOpenUpstoxModal}
            className="px-3.5 py-2 rounded-xl font-semibold text-xs transition-colors cursor-pointer shrink-0 border border-white/10 bg-[#080D16] hover:bg-[#1A2639] text-white"
          >
            {isUpstoxConnected ? 'Manage Optional Upstox Key' : 'Optional Upstox Setup'}
          </button>
        </div>
      </div>

      {/* Visual & Storage Preferences */}
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-white">Interface &amp; Workspace Preferences</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Theme */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.07] bg-[#121C2D]">
            <div>
              <span className="text-xs font-bold text-white block">Color Theme</span>
              <span className="text-[11px] text-[#8B9BB4] mt-0.5 block">
                Currently: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <button
              onClick={onToggleTheme}
              className="px-3 py-2 rounded-xl border border-white/10 bg-[#080D16] hover:bg-[#1A2639] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-[#E9B949]" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[#477DFF]" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>

          {/* Storage Reset */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/[0.07] bg-[#121C2D]">
            <div>
              <span className="text-xs font-bold text-white block">Local Cache &amp; Watchlist</span>
              <span className="text-[11px] text-[#8B9BB4] mt-0.5 block">
                Reset saved workspace cache and watchlist
              </span>
            </div>
            <button
              onClick={handleClear}
              className="px-3 py-2 rounded-xl border border-[#FF526B]/30 bg-[#FF526B]/10 text-[#FF526B] hover:bg-[#FF526B]/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearedNotice ? 'Cleared!' : 'Reset'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
