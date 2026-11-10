import React, { useState, useMemo } from 'react';
import { SectorRotationItem, Stock } from '../types/market';
import { Layers, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';

interface SectorRotationProps {
  sectors: SectorRotationItem[];
  onStockClick: (symbol: string) => void;
  stocks?: Stock[];
}

export const SectorRotation: React.FC<SectorRotationProps> = ({
  sectors,
  onStockClick,
  stocks = [],
}) => {
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M'>('1D');

  const enrichedSectors = useMemo(() => {
    return sectors
      .map(sec => {
        const sectorStocks = stocks.filter(
          s => s.sector.toLowerCase() === sec.name.toLowerCase()
        );
        const mult = timeframe === '1D' ? 1 : timeframe === '1W' ? 2.15 : 4.2;
        const adjChange = Number((sec.changePercent * mult).toFixed(2));

        // Find lagging stock if available
        const sortedByChange = [...sectorStocks].sort(
          (a, b) => a.changePercent - b.changePercent
        );
        const laggingStock = sortedByChange[0]?.symbol || sec.topStock;
        const laggingChange = sortedByChange[0]?.changePercent ?? 0;

        // Relative Strength vs Nifty (approx)
        const rsScore = Math.min(99, Math.max(12, Math.round(55 + adjChange * 12)));

        return {
          ...sec,
          displayChange: adjChange,
          laggingStock,
          laggingChange,
          rsScore,
        };
      })
      .sort((a, b) => b.displayChange - a.displayChange);
  }, [sectors, stocks, timeframe]);

  const leadersCount = enrichedSectors.filter(s => s.displayChange >= 0).length;
  const laggersCount = enrichedSectors.length - leadersCount;

  return (
    <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#9875FF]/15 border border-[#9875FF]/30 flex items-center justify-center">
            <Layers className="w-4 h-4 text-[#9875FF]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                Sectoral Rotation &amp; Relative Strength
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#121C2D] text-[#00C995] border border-white/[0.06]">
                {leadersCount} Leading / {laggersCount} Lagging
              </span>
            </div>
            <p className="text-[11px] text-[#8B9BB4]">
              Money flow across NSE sectoral indices • Click any leader/lagger to inspect
            </p>
          </div>
        </div>

        {/* Timeframe Switcher (Daily / Weekly / Monthly) */}
        <div className="flex items-center gap-1 bg-[#121C2D] p-1 rounded-xl border border-white/[0.06] self-start sm:self-auto">
          {[
            { id: '1D', label: 'Daily' },
            { id: '1W', label: 'Weekly' },
            { id: '1M', label: 'Monthly' },
          ].map(tf => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id as '1D' | '1W' | '1M')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                timeframe === tf.id
                  ? 'bg-[#477DFF] text-white shadow-xs'
                  : 'text-[#8B9BB4] hover:text-white'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sector Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4 max-h-[430px] overflow-y-auto pr-1">
        {enrichedSectors.map(sector => {
          const isPositive = sector.displayChange >= 0;
          const total = Math.max(1, sector.advanceCount + sector.declineCount);
          const advPct = (sector.advanceCount / total) * 100;

          return (
            <div
              key={sector.name}
              className={`p-3 rounded-xl bg-[#121C2D] hover:bg-[#1A2639] border transition-all ${
                isPositive
                  ? 'border-white/[0.06] hover:border-[#00C995]/40'
                  : 'border-white/[0.06] hover:border-[#FF526B]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-xs text-white truncate">
                    {sector.name}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#080D16] text-[#8B9BB4] border border-white/[0.05]">
                    RS {sector.rsScore}
                  </span>
                </div>

                <span
                  className={`inline-flex items-center gap-0.5 font-mono text-xs font-extrabold tabular-nums ${
                    isPositive ? 'text-[#00C995]' : 'text-[#FF526B]'
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  {isPositive ? '+' : ''}
                  {sector.displayChange.toFixed(2)}%
                </span>
              </div>

              {/* Breadth Progress Bar */}
              <div className="w-full h-1.5 bg-[#080D16] rounded-full overflow-hidden flex mb-2">
                <div
                  className="bg-[#00C995] h-full"
                  style={{ width: `${advPct}%` }}
                />
                <div
                  className="bg-[#FF526B] h-full"
                  style={{ width: `${100 - advPct}%` }}
                />
              </div>

              {/* Leaders & Laggers Row */}
              <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-white/[0.05]">
                <span className="text-[#8B9BB4]">
                  <span className="text-[#00C995] font-bold">{sector.advanceCount}</span> Adv /{' '}
                  <span className="text-[#FF526B] font-bold">{sector.declineCount}</span> Dec
                </span>

                {sector.topStock && (
                  <button
                    onClick={() => onStockClick(sector.topStock)}
                    className="inline-flex items-center gap-1 text-[#21C8E8] hover:underline font-semibold cursor-pointer"
                  >
                    <TrendingUp className="w-2.5 h-2.5 text-[#00C995]" />
                    <span>{sector.topStock}</span>
                    <span
                      className={
                        sector.topStockChange >= 0 ? 'text-[#00C995]' : 'text-[#FF526B]'
                      }
                    >
                      ({sector.topStockChange >= 0 ? '+' : ''}
                      {sector.topStockChange.toFixed(1)}%)
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
