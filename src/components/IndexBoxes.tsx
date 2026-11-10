import React, { useMemo } from 'react';
import { MarketIndex, GlobalMarketItem } from '../types/market';
import { ArrowUpRight, ArrowDownRight, Globe, Flame, Landmark, Activity } from 'lucide-react';

interface IndexBoxesProps {
  indices: MarketIndex[];
  globalOverviewItems?: GlobalMarketItem[];
  onIndexClick?: (index: MarketIndex) => void;
  onGlobalItemClick?: (item: GlobalMarketItem) => void;
}

export const IndexBoxes: React.FC<IndexBoxesProps> = ({
  indices,
  globalOverviewItems = [],
  onIndexClick,
  onGlobalItemClick,
}) => {
  // Primary Indian Benchmarks (Section 5.A)
  const indianIndices = useMemo(() => {
    const primaryOrder = [
      'NIFTY 50',
      'BANK NIFTY',
      'SENSEX',
      'NIFTY MIDCAP',
      'INDIA VIX',
      'GIFT NIFTY',
      'NIFTY FIN SERVICE',
      'NIFTY IT',
    ];
    const indian = indices.filter(idx => idx.category === 'Indian' || idx.symbol.includes('NIFTY') || idx.symbol.includes('SENSEX') || idx.symbol.includes('VIX'));
    return [...indian].sort((a, b) => {
      const idxA = primaryOrder.findIndex(k => a.symbol.toUpperCase().includes(k) || a.name.toUpperCase().includes(k));
      const idxB = primaryOrder.findIndex(k => b.symbol.toUpperCase().includes(k) || b.name.toUpperCase().includes(k));
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
  }, [indices]);

  // Global Markets & Commodities (Section 5.B) - Excludes Indian domestic indices already shown above
  const globalTiles = useMemo(() => {
    const excludedSet = new Set([
      'NIFTY50',
      'NIFTY 50',
      '^NSEI',
      'BANKNIFTY',
      'BANK NIFTY',
      '^NSEBANK',
      'SENSEX',
      'BSE SENSEX',
      '^BSESN',
      'MIDCAP_NIFTY',
      'MIDCPNIFTY',
      'MIDCAP NIFTY',
    ]);
    const isExcluded = (id?: string, symbol?: string, name?: string) => {
      const i = (id || '').toUpperCase().trim();
      const s = (symbol || '').toUpperCase().trim();
      const n = (name || '').toUpperCase().trim();
      return excludedSet.has(i) || excludedSet.has(s) || excludedSet.has(n);
    };

    if (globalOverviewItems && globalOverviewItems.length > 0) {
      return globalOverviewItems.filter(
        item => !isExcluded(item.id, item.symbol, item.name)
      );
    }
    return indices
      .filter(
        idx =>
          (idx.category === 'Global' || idx.category === 'Commodity') &&
          !isExcluded(idx.symbol, idx.symbol, idx.name)
      )
      .map(idx => ({
        id: idx.symbol,
        symbol: idx.symbol,
        name: idx.name,
        category: idx.category === 'Commodity' ? ('Commodity' as const) : ('US' as const),
        currency: idx.currency || (idx.category === 'Indian' ? 'INR' : 'USD'),
        exchange: idx.exchange || 'GLOBAL',
        price: idx.level,
        level: idx.level,
        change: idx.change,
        changePercent: idx.changePercent,
        prevClose: idx.prevClose || idx.level - idx.change,
        status: idx.status || 'LIVE',
        lastUpdated: idx.lastUpdated || null,
        sparks: idx.sparks || [idx.level],
      }));
  }, [globalOverviewItems, indices]);

  const renderSparkline = (sparks: number[], isPositive: boolean, id: string, height = 34) => {
    const valid = sparks && sparks.length >= 2 ? sparks : [100, 101];
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    const width = 110;

    const points = valid
      .map((val, idx) => {
        const x = (idx / Math.max(1, valid.length - 1)) * width;
        const y = height - 4 - ((val - min) / range) * (height - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const areaPoints = `0,${height} ${points} ${width},${height}`;
    const strokeColor = isPositive ? '#00C995' : '#FF526B';

    return (
      <svg className="w-24 h-8 shrink-0 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#grad-${id})`} />
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* SECTION A: INDIAN BENCHMARK INDICES (LARGE PROMINENT CARDS) */}
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-3 sm:p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#477DFF]/15 border border-[#477DFF]/30 flex items-center justify-center">
              <Landmark className="w-3.5 h-3.5 text-[#477DFF]" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                Indian Benchmark Indices
              </h2>
              <span className="text-[11px] text-[#8B9BB4] hidden md:inline">
                • Click any index for deep chart &amp; constituents
              </span>
            </div>
          </div>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#121C2D] border border-white/[0.07] ${
              indianIndices.some(i => i.status === 'LIVE') ? 'text-[#00C995]' : 'text-[#8B9BB4]'
            }`}
          >
            {indianIndices.some(i => i.status === 'LIVE') ? 'LIVE MARKET PULSE' : 'MARKET SETTLED'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {indianIndices.slice(0, 6).map((idx, i) => {
            const isVix = idx.symbol.toUpperCase().includes('VIX');
            const isPositive = idx.change >= 0;
            const prevClose = idx.prevClose || idx.level - idx.change;
            const sparks = idx.sparks && idx.sparks.length > 1 ? idx.sparks : [prevClose, idx.level];
            const dayHigh = Math.max(...sparks, idx.level, prevClose * 1.003);
            const dayLow = Math.min(...sparks, idx.level, prevClose * 0.997);
            const rangeSpan = Math.max(0.01, dayHigh - dayLow);
            const rangePos = Math.min(100, Math.max(4, ((idx.level - dayLow) / rangeSpan) * 100));

            return (
              <div
                key={idx.symbol}
                onClick={() => onIndexClick?.(idx)}
                className={`group relative rounded-xl p-3.5 bg-[#121C2D] hover:bg-[#1A2639] border transition-all duration-200 cursor-pointer overflow-hidden ${
                  isPositive
                    ? 'border-white/[0.07] hover:border-[#00C995]/40'
                    : 'border-white/[0.07] hover:border-[#FF526B]/40'
                }`}
              >
                {/* Subtle top edge highlight */}
                <div
                  className={`absolute top-0 left-0 right-0 h-[2px] ${
                    isVix
                      ? 'bg-gradient-to-r from-[#E9B949] to-[#9875FF]'
                      : isPositive
                      ? 'bg-gradient-to-r from-[#00C995] to-[#21C8E8]'
                      : 'bg-gradient-to-r from-[#FF526B] to-[#E9B949]'
                  }`}
                />

                {/* Top Row: Index Name + Status Badge */}
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <div className="min-w-0">
                    <span className="text-xs font-extrabold tracking-tight text-white block truncate group-hover:text-[#21C8E8] transition-colors">
                      {idx.symbol}
                    </span>
                    <span className="text-[10px] text-[#8B9BB4] block truncate">
                      {idx.exchange || 'NSE'} •{' '}
                      <span className={idx.status === 'LIVE' ? 'text-[#00C995] font-semibold' : 'text-[#8B9BB4]'}>
                        {idx.status || 'CLOSED'}
                      </span>
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold tabular-nums shrink-0 ${
                      isPositive
                        ? 'bg-[#00C995]/15 text-[#00C995] border border-[#00C995]/30'
                        : 'bg-[#FF526B]/15 text-[#FF526B] border border-[#FF526B]/30'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {isPositive ? '+' : ''}
                    {idx.changePercent.toFixed(2)}%
                  </span>
                </div>

                {/* Middle Row: Prominent Index Price (22px+) & Sparkline */}
                <div className="flex items-end justify-between gap-2 my-2">
                  <div className="font-mono tabular-nums">
                    <div className="text-xl sm:text-[22px] font-extrabold text-white tracking-tight leading-none">
                      {idx.level.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div
                      className={`text-[11px] font-semibold mt-1 ${
                        isPositive ? 'text-[#00C995]' : 'text-[#FF526B]'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {idx.change.toFixed(2)} pts
                    </div>
                  </div>

                  {renderSparkline(sparks, isPositive, `ind-${i}`)}
                </div>

                {/* Day High / Low Range Bar & Previous Close */}
                <div className="pt-2 mt-2 border-t border-white/[0.06] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#8B9BB4] tabular-nums">
                    <span>L: {dayLow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    <span>Prev: {prevClose.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    <span>H: {dayHigh.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#080D16] rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full ${
                        isPositive ? 'bg-[#00C995]' : 'bg-[#FF526B]'
                      }`}
                      style={{ width: `${rangePos}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION B: GLOBAL MARKETS, COMMODITIES & FOREX STRIP */}
      {globalTiles.length > 0 && (
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#21C8E8]" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Global Markets, Commodities &amp; Macro Cues
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#8B9BB4]">
              US INDICES • MCX / COMEX COMMODITIES • USD/INR
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-2.5">
            {globalTiles.slice(0, 8).map((item, idx) => {
              const val = item.price ?? item.level ?? 0;
              const chgPct = item.changePercent ?? 0;
              const chg = item.change ?? 0;
              const isPos = chgPct >= 0;
              const isCommodity = item.category === 'Commodity' || item.category === 'MCX';

              return (
                <div
                  key={item.id || item.symbol}
                  onClick={() => onGlobalItemClick?.(item)}
                  className="rounded-xl p-2.5 bg-[#121C2D] hover:bg-[#1A2639] border border-white/[0.06] hover:border-[#477DFF]/40 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-white truncate">
                      {item.name || item.symbol}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold shrink-0 ${
                        isCommodity
                          ? 'bg-[#E9B949]/15 text-[#E9B949]'
                          : 'bg-[#477DFF]/15 text-[#477DFF]'
                      }`}
                    >
                      {item.exchange || item.category}
                    </span>
                  </div>

                  <div className="my-1.5 flex items-baseline justify-between gap-1 font-mono tabular-nums">
                    <span className="text-sm font-extrabold text-white">
                      {item.currency === 'INR' ? '₹' : item.currency === 'USD' ? '$' : ''}
                      {val > 0
                        ? val.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '—'}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        isPos ? 'text-[#00C995]' : 'text-[#FF526B]'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {chgPct.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-[#8B9BB4] pt-1 border-t border-white/[0.05]">
                    <span>
                      {chg >= 0 ? '+' : ''}
                      {chg.toFixed(2)}
                    </span>
                    <span
                      className={`uppercase text-[8px] font-bold ${
                        item.status === 'LIVE' ? 'text-[#00C995]' : 'text-[#8B9BB4]'
                      }`}
                    >
                      {item.status || 'CLOSED'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
