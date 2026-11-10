import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  KeyRound,
  Terminal,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ExternalLink,
  Activity,
} from 'lucide-react';

interface UpstoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectToken: (token: string, remember: boolean) => void;
  onDisconnect: () => void;
  currentToken: string | null;
}

export const UpstoxModal: React.FC<UpstoxModalProps> = ({
  isOpen,
  onClose,
  onConnectToken,
  onDisconnect,
  currentToken,
}) => {
  const [activeTab, setActiveTab] = useState<'optionA' | 'optionB'>('optionA');

  // Option A fields
  const [analyticsToken, setAnalyticsToken] = useState<string>('');
  const [rememberToken, setRememberToken] = useState<boolean>(true);

  // Option B fields
  const [apiKey, setApiKey] = useState<string>('');
  const [apiSecret, setApiSecret] = useState<string>('');
  const [redirectUrl, setRedirectUrl] = useState<string>('http://localhost:3000');
  const [authCode, setAuthCode] = useState<string>('');

  // Diagnostics test log
  const [testLog, setTestLog] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [profileInfo, setProfileInfo] = useState<any>(null);

  useEffect(() => {
    if (currentToken) {
      setAnalyticsToken(currentToken);
    }
  }, [currentToken]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const tokenToTest = (activeTab === 'optionA' ? analyticsToken : currentToken)?.trim();
    if (!tokenToTest) {
      setTestLog('Error: Please enter your Upstox token or authorization code first.');
      setTestSuccess(false);
      return;
    }

    setIsTesting(true);
    setTestLog('Connecting to Upstox API v2 (User Profile & Real-Time Quotes)...');

    try {
      const res = await fetch('/api/upstox/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToTest }),
      });
      const data = await res.json();

      setIsTesting(false);
      if (data.success) {
        setTestSuccess(true);
        setProfileInfo(data.profile);

        const sampleNifty = data.sampleQuote?.['NSE_INDEX:Nifty 50'] || data.sampleQuote?.['NSE_INDEX|Nifty 50'];
        const sampleRel = data.sampleQuote?.['NSE_EQ:INE002A01018'] || data.sampleQuote?.['NSE_EQ|INE002A01018'];

        let quoteDetail = '';
        if (sampleNifty?.last_price) quoteDetail += ` · Nifty 50: ₹${sampleNifty.last_price}`;
        if (sampleRel?.last_price) quoteDetail += ` · Reliance: ₹${sampleRel.last_price}`;

        setTestLog(
          `Success: Connected to ${data.profile?.user_name || 'Upstox User'} (${data.profile?.user_id || 'ID Verified'}). Real-time live quotes stream active${quoteDetail}!`
        );
      } else {
        setTestSuccess(false);
        setProfileInfo(null);
        setTestLog(
          `Upstox Error: ${data.message || 'Token unauthorized or expired'}. Make sure your token is active in Upstox Developer Console.`
        );
      }
    } catch {
      setIsTesting(false);
      setTestSuccess(false);
      setProfileInfo(null);
      setTestLog('Network Error: Could not reach Upstox proxy endpoint.');
    }
  };

  const handleConnectOptionA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!analyticsToken.trim()) return;
    onConnectToken(analyticsToken.trim(), rememberToken);
    onClose();
  };

  const handleConnectOptionB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authCode.trim() || !apiKey.trim() || !apiSecret.trim()) {
      setTestLog('Error: Please fill in API Key, API Secret, Redirect URI, and Authorization Code.');
      setTestSuccess(false);
      return;
    }

    setIsTesting(true);
    setTestLog('Exchanging authorization code with Upstox OAuth server (https://api.upstox.com/v2/login/authorization/token)...');

    try {
      const res = await fetch('/api/upstox/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: authCode.trim(),
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          redirectUri: redirectUrl.trim(),
        }),
      });

      const data = await res.json();
      setIsTesting(false);
      setApiSecret(''); // Never saved, cleared immediately

      if (data.success && data.accessToken) {
        setTestSuccess(true);
        setTestLog(`Success: Authenticated as ${data.userName} (${data.userId}). Real-time feed enabled!`);
        onConnectToken(data.accessToken, rememberToken);
        onClose();
      } else {
        setTestSuccess(false);
        setTestLog(`Upstox OAuth Error: ${data.message || 'Authorization failed'}.`);
      }
    } catch (err) {
      setIsTesting(false);
      setTestSuccess(false);
      setTestLog(`Exchange Failure: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-[#0D1422] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90dvh] shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.07] bg-[#080D16] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#477DFF]/15 text-[#477DFF] flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  Connect Upstox Real-Time API
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#00C995]/15 text-[#00C995] border border-[#00C995]/30 flex items-center gap-1 font-semibold">
                  <Activity className="w-3 h-3" />
                  Live 10s
                </span>
              </div>
              <p className="text-xs text-[#8B9BB4]">
                Official Upstox API v2 feed for real-time NSE prices, OHLC, volume, and open interest
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#121C2D] hover:bg-[#1A2639] text-[#8B9BB4] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs flex-1 min-h-0 overflow-y-auto">
          {/* 24/7 Active Notice */}
          <div className="p-3 rounded-xl bg-[#00C995]/10 border border-[#00C995]/30 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#00C995] shrink-0 mt-0.5" />
            <div className="text-slate-300">
              <strong className="text-[#00C995]">24/7 NSE Live Feed Already Active (Zero Token Needed):</strong> Money Line automatically streams live NSE prices &amp; 3:30 PM settled multi-timeframe candles 24/7 on any device. Connecting a personal Upstox v2 token below is completely optional.
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-3 rounded-xl bg-[#121C2D] border border-white/[0.07] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#00C995] shrink-0 mt-0.5" />
            <div className="text-slate-300">
              <strong className="text-white">Zero-Secret Security:</strong> Requests are processed through your secure backend proxy. If an optional token expires at 3:30 AM IST, the terminal automatically switches back to the 24/7 NSE Live Feed with zero interruption.
            </div>
          </div>

          {/* Option Selector Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 bg-[#121C2D] p-1 rounded-xl border border-white/[0.06]">
            <button
              onClick={() => setActiveTab('optionA')}
              className={`flex-1 py-2 px-2.5 font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'optionA'
                  ? 'bg-[#477DFF] text-white shadow-xs'
                  : 'text-[#8B9BB4] hover:text-white'
              }`}
            >
              Option A: Token / Analytics Token (Recommended)
            </button>
            <button
              onClick={() => setActiveTab('optionB')}
              className={`flex-1 py-2 px-2.5 font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'optionB'
                  ? 'bg-[#477DFF] text-white shadow-xs'
                  : 'text-[#8B9BB4] hover:text-white'
              }`}
            >
              Option B: API Key &amp; Secret OAuth Login
            </button>
          </div>

          {/* OPTION A FORM */}
          {activeTab === 'optionA' && (
            <form onSubmit={handleConnectOptionA} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-white">
                    Upstox Access Token or Analytics Token
                  </label>
                  <a
                    href="https://developer.upstox.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#477DFF] hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Upstox Developer Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <textarea
                  rows={3}
                  value={analyticsToken}
                  onChange={e => setAnalyticsToken(e.target.value)}
                  placeholder="Paste your Upstox Bearer token or 1-year Analytics Token here..."
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#121C2D] text-white placeholder:text-[#8B9BB4] font-mono text-xs focus:outline-none focus:border-[#477DFF]"
                  required
                />
                <span className="text-[11px] text-[#8B9BB4] mt-1 block">
                  How to get it: Log in to <strong>developer.upstox.com</strong>, open your app, and copy the API token or Analytics Token.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberToken}
                    onChange={e => setRememberToken(e.target.checked)}
                    className="rounded text-[#477DFF]"
                  />
                  <span>Remember token on this browser</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-3 py-2 rounded-xl border border-white/10 bg-[#121C2D] text-white hover:bg-[#1A2639] transition-colors cursor-pointer"
                  >
                    {isTesting ? 'Verifying...' : 'Test Connection'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#477DFF] hover:bg-[#3B66D6] text-white font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Save &amp; Activate Live Feed
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* OPTION B FORM */}
          {activeTab === 'optionB' && (
            <form onSubmit={handleConnectOptionB} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-white mb-1">API Key</label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="From Upstox Developer Console"
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#121C2D] text-white placeholder:text-[#8B9BB4] font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-white mb-1">API Secret</label>
                  <input
                    type="password"
                    value={apiSecret}
                    onChange={e => setApiSecret(e.target.value)}
                    placeholder="Cleared right after exchange"
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#121C2D] text-white placeholder:text-[#8B9BB4] font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-white mb-1">Redirect URL</label>
                <input
                  type="text"
                  value={redirectUrl}
                  onChange={e => setRedirectUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#121C2D] text-white font-mono"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-white">
                    Authorization Code
                  </label>
                  {apiKey && (
                    <a
                      href={`https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(apiKey)}&redirect_uri=${encodeURIComponent(redirectUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#477DFF] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>1. Click to Log in on Upstox</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <input
                  type="text"
                  value={authCode}
                  onChange={e => setAuthCode(e.target.value)}
                  placeholder="Paste the ?code= parameter from browser URL bar after logging in"
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#121C2D] text-white placeholder:text-[#8B9BB4] font-mono"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberToken}
                    onChange={e => setRememberToken(e.target.checked)}
                    className="rounded text-[#477DFF]"
                  />
                  <span>Remember generated token</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="px-4 py-2 rounded-xl bg-[#477DFF] hover:bg-[#3B66D6] text-white font-semibold shadow-xs cursor-pointer"
                  >
                    {isTesting ? 'Authenticating...' : 'Exchange Code & Connect'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Diagnostics Log Output */}
          {testLog && (
            <div className="mt-3 p-3.5 rounded-xl bg-[#080D16] text-slate-200 font-mono text-[11px] border border-white/10 flex items-start gap-2.5">
              <Terminal className="w-4 h-4 text-[#8B9BB4] shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <span className="text-[#8B9BB4] block text-[10px] uppercase tracking-wider font-sans font-semibold">
                  Connection Diagnostics:
                </span>
                <p className={testSuccess ? 'text-[#00C995]' : 'text-[#E9B949]'}>{testLog}</p>

                {profileInfo && (
                  <div className="pt-2 mt-2 border-t border-white/10 text-[10px] text-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-1">
                    <span>Trader: <strong className="text-white">{profileInfo.user_name}</strong></span>
                    <span>Client ID: <strong className="text-white">{profileInfo.user_id}</strong></span>
                    <span>Broker: <strong className="text-white">{profileInfo.broker || 'Upstox'}</strong></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active Connection & Disconnect Button */}
          {currentToken && (
            <div className="pt-3 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#00C995] font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Upstox Live Feed Active</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onDisconnect();
                  setAnalyticsToken('');
                  setProfileInfo(null);
                  setTestLog('Disconnected. Upstox token purged from storage.');
                }}
                className="px-3 py-1.5 rounded-xl border border-[#FF526B]/30 text-[#FF526B] hover:bg-[#FF526B]/10 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect &amp; Clear Token</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
