import React, { useState, useMemo } from 'react';
import {
  MarketMood,
  PreMarketCues,
  MarketStatus,
  MarketHealthTelemetry,
  Stock,
} from '../types/market';
import {
  BarChart2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface MoodGaugeProps {
  mood: MarketMood;
  cues: PreMarketCues;
  status: MarketStatus;
  marketHealth?: MarketHealthTelemetry | null;
  stocks?: Stock[];
}

export const MoodGauge: React.FC<MoodGaugeProps> = ({
  mood,
  marketHealth,
}) => {
  const [selectedUniverse, setSelectedUniverse] = useState<
    'nseOverall' | 'nifty50' | 'nifty100' | 'nifty200' | 'nifty500' | 'foStocks'
  >('nseOverall');

  const activeBreadth = useMemo(() => {
    const b = marketHealth?.breadth?.[selectedUniverse];
    if (b && (b.advances > 0 || b.declines > 0)) {
      return b;
    }
    return {
      name: 'NSE Active Universe',
      advances: mood.advCount,
      declines: mood.decCount,
      unchanged: Math.max(0, mood.totalCount - mood.advCount - mood.decCount),
      totalValid: mood.totalCount,
      totalEligible: mood.totalCount,
      coveragePercent: 100,
      adRatio:
        mood.decCount > 0
          ? Number((mood.advCount / mood.decCount).toFixed(2))
          : mood.advCount,
    };
  }, [marketHealth, selectedUniverse, mood]);

  const totalBreadthCount = Math.max(
    1,
    activeBreadth.advances + activeBreadth.declines + (activeBreadth.unchanged || 0)
  );
  const advPct = (activeBreadth.advances / totalBreadthCount) * 100;
  const decPct = (activeBreadth.declines / totalBreadthCount) * 100;

  return (
    <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C995]/15 border border-[#00C995]/30 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-[#00C995]" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
              Market Breadth
            </h3>
            <p className="text-[10px] text-[#8B9BB4]">
              Advance / Decline participation across NSE &amp; F&amp;O universes
            </p>
          </div>
        </div>

        {/* Universe Tabs */}
        <div className="flex items-center gap-1 bg-[#121C2D] p-1 rounded-xl border border-white/[0.06] overflow-x-auto">
          {[
            { id: 'nseOverall', label: 'NSE All' },
            { id: 'nifty50', label: 'Nifty 50' },
            { id: 'nifty100', label: 'Nifty 100' },
            { id: 'nifty500', label: 'Nifty 500' },
            { id: 'foStocks', label: 'F&O' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedUniverse(tab.id as typeof selectedUniverse)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedUniverse === tab.id
                  ? 'bg-[#477DFF] text-white shadow-xs'
                  : 'text-[#8B9BB4] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advance / Decline Visual Bar */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-extrabold text-[#00C995]">
              <TrendingUp className="w-3.5 h-3.5" />
              {activeBreadth.advances} ADVANCES ({advPct.toFixed(0)}%)
            </span>
            <span className="text-[#8B9BB4]">•</span>
            <span className="text-[#8B9BB4] text-[11px]">
              Unch: {activeBreadth.unchanged || 0}
            </span>
          </div>

          <div className="px-2.5 py-0.5 rounded-md bg-[#121C2D] border border-white/[0.07] text-[11px] font-bold text-white">
            A/D Ratio:{' '}
            <span
              className={
                activeBreadth.adRatio >= 1 ? 'text-[#00C995]' : 'text-[#FF526B]'
              }
            >
              {activeBreadth.adRatio.toFixed(2)}x
            </span>
          </div>

          <span className="inline-flex items-center gap-1 font-extrabold text-[#FF526B]">
            {activeBreadth.declines} DECLINES ({decPct.toFixed(0)}%)
            <TrendingDown className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="w-full h-3 bg-[#121C2D] rounded-full overflow-hidden flex p-0.5 gap-0.5">
          <div
            className="h-full bg-gradient-to-r from-[#00C995] to-[#00D6A0] rounded-l-full transition-all duration-500"
            style={{ width: `${Math.max(4, advPct)}%` }}
          />
          <div
            className="h-full bg-[#8B9BB4]/30 transition-all duration-500"
            style={{ width: `${Math.max(1, 100 - advPct - decPct)}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-[#FF526B] to-[#E11D48] rounded-r-full transition-all duration-500"
            style={{ width: `${Math.max(4, decPct)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

