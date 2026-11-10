import React, { useMemo } from 'react';
import { Stock, GlobalInstrumentFilter, NavigationTab } from '../types/market';
import { evaluateIntradayScreener } from '../services/marketCalculators';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  SlidersHorizontal,
} from 'lucide-react';

interface RightNowRadarProps {
  stocks: Stock[];
  instrumentFilter: GlobalInstrumentFilter;
  onInstrumentFilterChange: (filter: GlobalInstrumentFilter) => void;
  onStockClick: (symbol: string) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const RightNowRadar: React.FC<RightNowRadarProps> = ({
  stocks,
  instrumentFilter,
  onInstrumentFilterChange,
  onStockClick,
  onNavigate,
}) => {
  const filteredStocks = useMemo(() => {
    if (instrumentFilter === 'FO') return stocks.filter(s => s.isFO);
    if (instrumentFilter === 'NON_FO') return stocks.filter(s => !s.isFO);
    return stocks;
  }, [stocks, instrumentFilter]);

  const evaluated = useMemo(() => {
    return filteredStocks.map(stock => ({
      stock,
      eval: evaluateIntradayScreener(stock),
    }));
  }, [filteredStocks]);

  const topBullish = useMemo(() => {
    return [...evaluated]
      .filter(r => r.eval.buyPower >= 4 || r.stock.changePercent > 0)
      .sort(
        (a, b) =>
          b.eval.buyPower - a.eval.buyPower ||
          b.stock.changePercent - a.stock.changePercent
      )
      .slice(0, 5);
  }, [evaluated]);

  const topBearish = useMemo(() => {
    return [...evaluated]
      .filter(r => r.eval.sellPower >= 4 || r.stock.changePercent < 0)
      .sort(
        (a, b) =>
          b.eval.sellPower - a.eval.sellPower ||
          a.stock.changePercent - b.stock.changePercent
      )
      .slice(0, 5);
  }, [evaluated]);

  const volumeSurges = useMemo(() => {
    return [...filteredStocks]
      .map(s => ({
        stock: s,
        rvol: s.avgVolume20D > 0 ? s.volume / s.avgVolume20D : 1,
      }))
      .sort((a, b) => b.rvol - a.rvol)
      .slice(0, 5);
  }, [filteredStocks]);

  return (
    <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#E9B949]/15 border border-[#E9B949]/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#E9B949]" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
              Right-Now Intraday Momentum &amp; Setup Radar
            </h2>
            <p className="text-[11px] text-[#8B9BB4]">
              Highest 7-parameter alignment setups &amp; relative volume breakouts happening right now
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#121C2D] p-1 rounded-xl border border-white/[0.06]">
            {[
              { id: 'ALL', label: 'All Equities' },
              { id: 'FO', label: 'F&O Only' },
              { id: 'NON_FO', label: 'Cash Only' },
            ].map(seg => (
              <button
                key={seg.id}
                onClick={() =>
                  onInstrumentFilterChange(seg.id as GlobalInstrumentFilter)
                }
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  instrumentFilter === seg.id
                    ? 'bg-[#477DFF] text-white'
                    : 'text-[#8B9BB4] hover:text-white'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => onNavigate('screener')}
            className="px-3 py-1.5 rounded-xl bg-[#121C2D] hover:bg-[#1A2639] text-[#21C8E8] border border-[#21C8E8]/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Open 16-Col Screener</span>
          </button>
        </div>
      </div>

      {/* 3-Column Radar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Bullish Power Leaders */}
        <div className="rounded-xl bg-[#121C2D] border border-white/[0.06] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#00C995]" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                Bullish Power Setups
              </span>
            </div>
            <button
              onClick={() => onNavigate('bullish')}
              className="text-[10px] font-mono font-bold text-[#00C995] hover:underline cursor-pointer"
            >
              View All →
            </button>
          </div>

          <div className="space-y-1.5">
            {topBullish.map(({ stock, eval: ev }) => (
              <div
                key={stock.symbol}
                onClick={() => onStockClick(stock.symbol)}
                className="p-2.5 rounded-xl bg-[#0D1422] hover:bg-[#1A2639] border border-white/[0.05] hover:border-[#00C995]/40 transition-all cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-extrabold text-xs text-white">
                      {stock.symbol}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#00C995]/15 text-[#00C995] font-bold">
                      {ev.buyPower}/7 BULL
                    </span>
                    {ev.execute === 'BUY' && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#00C995] text-[#080D16] font-extrabold">
                        BUY
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#8B9BB4] block truncate mt-0.5">
                    Supp: ₹{ev.dailySupport.toFixed(1)} • SL: ₹
                    {ev.stopLoss > 0 ? ev.stopLoss.toFixed(1) : (stock.price * 0.99).toFixed(1)}
                  </span>
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-xs font-extrabold text-white">
                    ₹{stock.price.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-bold text-[#00C995] flex items-center justify-end gap-0.5">
                    <ArrowUpRight className="w-3 h-3" />
                    {stock.changePercent >= 0 ? '+' : ''}
                    {stock.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Bearish Power Leaders */}
        <div className="rounded-xl bg-[#121C2D] border border-white/[0.06] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-[#FF526B]" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                Bearish Breakdown Setups
              </span>
            </div>
            <button
              onClick={() => onNavigate('bearish')}
              className="text-[10px] font-mono font-bold text-[#FF526B] hover:underline cursor-pointer"
            >
              View All →
            </button>
          </div>

          <div className="space-y-1.5">
            {topBearish.map(({ stock, eval: ev }) => (
              <div
                key={stock.symbol}
                onClick={() => onStockClick(stock.symbol)}
                className="p-2.5 rounded-xl bg-[#0D1422] hover:bg-[#1A2639] border border-white/[0.05] hover:border-[#FF526B]/40 transition-all cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-extrabold text-xs text-white">
                      {stock.symbol}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#FF526B]/15 text-[#FF526B] font-bold">
                      {ev.sellPower}/7 BEAR
                    </span>
                    {ev.execute === 'SELL' && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#FF526B] text-white font-extrabold">
                        SELL
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#8B9BB4] block truncate mt-0.5">
                    Res: ₹{ev.dailyResistance.toFixed(1)} • SL: ₹
                    {ev.stopLoss > 0 ? ev.stopLoss.toFixed(1) : (stock.price * 1.01).toFixed(1)}
                  </span>
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-xs font-extrabold text-white">
                    ₹{stock.price.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-bold text-[#FF526B] flex items-center justify-end gap-0.5">
                    <ArrowDownRight className="w-3 h-3" />
                    {stock.changePercent >= 0 ? '+' : ''}
                    {stock.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Relative Volume & Participation Surges */}
        <div className="rounded-xl bg-[#121C2D] border border-white/[0.06] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#E9B949]" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                Relative Volume Surges
              </span>
            </div>
            <button
              onClick={() => onNavigate('fo_movers')}
              className="text-[10px] font-mono font-bold text-[#E9B949] hover:underline cursor-pointer"
            >
              Movers →
            </button>
          </div>

          <div className="space-y-1.5">
            {volumeSurges.map(({ stock, rvol }) => {
              const isPos = stock.changePercent >= 0;
              return (
                <div
                  key={stock.symbol}
                  onClick={() => onStockClick(stock.symbol)}
                  className="p-2.5 rounded-xl bg-[#0D1422] hover:bg-[#1A2639] border border-white/[0.05] hover:border-[#E9B949]/40 transition-all cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-extrabold text-xs text-white">
                        {stock.symbol}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#E9B949]/15 text-[#E9B949] font-bold">
                        {rvol.toFixed(1)}x RVOL
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8B9BB4] block truncate mt-0.5">
                      Vol: {(stock.volume / 100000).toFixed(1)}L • {stock.sector}
                    </span>
                  </div>

                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-xs font-extrabold text-white">
                      ₹{stock.price.toFixed(2)}
                    </div>
                    <div
                      className={`text-[10px] font-bold ${
                        isPos ? 'text-[#00C995]' : 'text-[#FF526B]'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {stock.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
