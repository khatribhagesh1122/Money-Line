import React, { useState, useMemo } from 'react';
import { Stock } from '../types/market';
import { evaluateIntradayScreener } from '../services/marketCalculators';
import {
  Flame,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Volume2,
  Zap,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';

interface MarketMoversViewProps {
  stocks: Stock[];
  segment: 'FO' | 'NON_FO';
  onStockClick: (symbol: string) => void;
}

type MoverLens =
  | 'SPLIT'
  | 'GAINERS'
  | 'LOSERS'
  | 'HIGH_VOLUME'
  | 'RVOL_SURGE'
  | 'RANGE_BREAKOUT'
  | 'MOMENTUM_LEADERS'
  | 'WEAKNESS_LEADERS';

export const MarketMoversView: React.FC<MarketMoversViewProps> = ({
  stocks,
  segment,
  onStockClick,
}) => {
  const [activeLens, setActiveLens] = useState<MoverLens>('SPLIT');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  const segmentStocks = useMemo(() => {
    return stocks
      .filter(s => (segment === 'FO' ? s.isFO : !s.isFO))
      .map(stock => {
        const evalObj = evaluateIntradayScreener(stock);
        const rvol =
          stock.avgVolume20D > 0 ? stock.volume / stock.avgVolume20D : 1;
        return {
          stock,
          evalObj,
          rvol,
        };
      });
  }, [stocks, segment]);

  const sectorsList = useMemo(() => {
    const set = new Set<string>();
    segmentStocks.forEach(s => {
      if (s.stock.sector) set.add(s.stock.sector);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [segmentStocks]);

  const filteredItems = useMemo(() => {
    return segmentStocks.filter(({ stock }) => {
      if (selectedSector !== 'ALL' && stock.sector !== selectedSector) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        return (
          stock.symbol.toLowerCase().includes(q) ||
          stock.name.toLowerCase().includes(q) ||
          stock.sector.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [segmentStocks, selectedSector, searchTerm]);

  const topGainers = useMemo(() => {
    return [...filteredItems]
      .filter(i => i.stock.changePercent >= 0)
      .sort((a, b) => b.stock.changePercent - a.stock.changePercent);
  }, [filteredItems]);

  const topLosers = useMemo(() => {
    return [...filteredItems]
      .filter(i => i.stock.changePercent < 0)
      .sort((a, b) => a.stock.changePercent - b.stock.changePercent);
  }, [filteredItems]);

  const lensItems = useMemo(() => {
    switch (activeLens) {
      case 'GAINERS':
        return topGainers;
      case 'LOSERS':
        return topLosers;
      case 'HIGH_VOLUME':
        return [...filteredItems].sort((a, b) => b.stock.volume - a.stock.volume);
      case 'RVOL_SURGE':
        return [...filteredItems].sort((a, b) => b.rvol - a.rvol);
      case 'RANGE_BREAKOUT':
        return [...filteredItems]
          .filter(i => i.stock.price >= i.stock.pdh || i.stock.price <= i.stock.pdl)
          .sort(
            (a, b) =>
              Math.abs(b.stock.changePercent) - Math.abs(a.stock.changePercent)
          );
      case 'MOMENTUM_LEADERS':
        return [...filteredItems].sort(
          (a, b) =>
            b.evalObj.buyPower - a.evalObj.buyPower ||
            b.stock.changePercent - a.stock.changePercent
        );
      case 'WEAKNESS_LEADERS':
        return [...filteredItems].sort(
          (a, b) =>
            b.evalObj.sellPower - a.evalObj.sellPower ||
            a.stock.changePercent - b.stock.changePercent
        );
      default:
        return filteredItems;
    }
  }, [activeLens, filteredItems, topGainers, topLosers]);

  const renderStockRow = (
    item: (typeof segmentStocks)[0],
    rank: number
  ) => {
    const { stock, evalObj, rvol } = item;
    const isUp = stock.changePercent >= 0;
    const rangeSpan = Math.max(0.01, stock.high - stock.low);
    const rangePct = Math.min(
      100,
      Math.max(5, ((stock.price - stock.low) / rangeSpan) * 100)
    );
    const dominantPower = Math.max(evalObj.buyPower, evalObj.sellPower);
    const isBull = evalObj.buyPower >= evalObj.sellPower;

    return (
      <tr
        key={stock.symbol}
        onClick={() => onStockClick(stock.symbol)}
        className="hover:bg-[#1A2639] transition-colors cursor-pointer group"
      >
        <td className="py-3 px-3 font-mono text-[11px] text-[#8B9BB4] w-9">
          #{rank}
        </td>
        <td className="py-3 px-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-extrabold text-xs text-white group-hover:text-[#21C8E8] transition-colors">
              {stock.symbol}
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-[#8B9BB4] hidden sm:inline">
              {stock.sector}
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-[#8B9BB4] block truncate max-w-[115px] sm:max-w-[180px]">
            {stock.name}
          </span>
        </td>

        {/* LTP & Net Change */}
        <td className="py-2.5 px-2 sm:px-3 text-right font-mono tabular-nums whitespace-nowrap">
          <div className="text-xs font-extrabold text-white">
            ₹{stock.price.toFixed(2)}
          </div>
          <div className="text-[10px] text-[#8B9BB4]">
            {stock.change >= 0 ? '+' : ''}
            {stock.change.toFixed(2)}
          </div>
        </td>

        {/* % Change */}
        <td className="py-2.5 px-2 sm:px-3 text-right font-mono tabular-nums whitespace-nowrap">
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-extrabold ${
              isUp
                ? 'bg-[#00C995]/15 text-[#00C995] border border-[#00C995]/30'
                : 'bg-[#FF526B]/15 text-[#FF526B] border border-[#FF526B]/30'
            }`}
          >
            {isUp ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {isUp ? '+' : ''}
            {stock.changePercent.toFixed(2)}%
          </span>
        </td>

        {/* Intraday High / Low Range */}
        <td className="py-2.5 px-3 hidden sm:table-cell min-w-[130px]">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8B9BB4] tabular-nums mb-1">
            <span>L: ₹{stock.low.toFixed(0)}</span>
            <span>H: ₹{stock.high.toFixed(0)}</span>
          </div>
          <div className="w-full h-1.5 bg-[#080D16] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                isUp ? 'bg-[#00C995]' : 'bg-[#FF526B]'
              }`}
              style={{ width: `${rangePct}%` }}
            />
          </div>
        </td>

        {/* Volume & Relative Volume */}
        <td className="py-2.5 px-3 text-right font-mono tabular-nums hidden md:table-cell whitespace-nowrap">
          <div className="text-xs font-bold text-white">
            {(stock.volume / 100000).toFixed(2)}L
          </div>
          <span
            className={`text-[10px] font-bold ${
              rvol >= 1.5 ? 'text-[#E9B949]' : 'text-[#8B9BB4]'
            }`}
          >
            {rvol.toFixed(2)}x RVOL
          </span>
        </td>

        {/* 7-Parameter Trend Alignment */}
        <td className="py-2.5 px-3 text-center font-mono hidden lg:table-cell whitespace-nowrap">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isBull
                ? 'bg-[#00C995]/15 text-[#00C995]'
                : 'bg-[#FF526B]/15 text-[#FF526B]'
            }`}
          >
            {dominantPower}/7 {isBull ? 'BULL' : 'BEAR'}
          </span>
        </td>

        {/* Quick Action */}
        <td className="py-2.5 px-2 sm:px-3 text-right whitespace-nowrap">
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#477DFF] group-hover:text-[#21C8E8]">
            <span className="hidden xs:inline sm:inline">Inspect</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Compact Header Banner */}
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-3 sm:p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${
                segment === 'FO'
                  ? 'bg-[#E9B949]/15 border-[#E9B949]/30 text-[#E9B949]'
                  : 'bg-[#477DFF]/15 border-[#477DFF]/30 text-[#477DFF]'
              }`}
            >
              {segment === 'FO' ? (
                <Flame className="w-4 h-4" />
              ) : (
                <BarChart3 className="w-4 h-4" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {segment === 'FO'
                  ? 'F&O Derivatives Market Movers'
                  : 'Non-F&O Cash Market Movers'}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#121C2D] text-[#00C995] border border-white/10 font-bold">
                {topGainers.length} Adv / {topLosers.length} Dec
              </span>
            </div>
          </div>

          {/* Search & Sector Filter */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-[#8B9BB4] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search symbol..."
                className="w-full pl-8 pr-3 py-1 rounded-lg bg-[#080D16] border border-white/[0.08] text-xs text-white placeholder-[#8B9BB4] focus:outline-none focus:border-[#477DFF]"
              />
            </div>

            <select
              value={selectedSector}
              onChange={e => setSelectedSector(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-[#080D16] border border-white/[0.08] text-xs text-white font-medium focus:outline-none focus:border-[#477DFF]"
            >
              {sectorsList.map(sec => (
                <option key={sec} value={sec}>
                  {sec === 'ALL' ? 'All Sectors' : sec}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Lens Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-[#080D16] p-1 rounded-lg border border-white/[0.06]">
          {[
            { id: 'SPLIT', label: 'Side-by-Side (Gainers / Losers)' },
            { id: 'GAINERS', label: `Top Gainers (${topGainers.length})` },
            { id: 'LOSERS', label: `Top Losers (${topLosers.length})` },
            { id: 'HIGH_VOLUME', label: 'Highest Volume' },
            { id: 'RVOL_SURGE', label: 'RVOL Surges' },
            { id: 'RANGE_BREAKOUT', label: 'Range Breakouts' },
            { id: 'MOMENTUM_LEADERS', label: 'Momentum Leaders' },
            { id: 'WEAKNESS_LEADERS', label: 'Weakness Leaders' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveLens(tab.id as MoverLens)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeLens === tab.id
                  ? 'bg-[#477DFF] text-white shadow-[0_2px_10px_rgba(71,125,255,0.35)]'
                  : 'text-[#8B9BB4] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content View */}
      {activeLens === 'SPLIT' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Top Gainers Panel */}
          <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-white/[0.07] bg-[#00C995]/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#00C995]" />
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                  Top Gainers ({topGainers.length})
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#00C995] font-bold">
                BULLISH MOMENTUM
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080D16] text-[#8B9BB4] font-mono text-[10px] uppercase border-b border-white/[0.06]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Stock</th>
                    <th className="py-2.5 px-3 text-right">LTP</th>
                    <th className="py-2.5 px-3 text-right">% Chg</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">Day Range</th>
                    <th className="py-2.5 px-3 text-right hidden md:table-cell">Volume</th>
                    <th className="py-2.5 px-3 text-center hidden lg:table-cell">Power</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {topGainers.slice(0, 20).map((item, idx) =>
                    renderStockRow(item, idx + 1)
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Losers Panel */}
          <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-white/[0.07] bg-[#FF526B]/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-[#FF526B]" />
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                  Top Losers ({topLosers.length})
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#FF526B] font-bold">
                BEARISH PRESSURE
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080D16] text-[#8B9BB4] font-mono text-[10px] uppercase border-b border-white/[0.06]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Stock</th>
                    <th className="py-2.5 px-3 text-right">LTP</th>
                    <th className="py-2.5 px-3 text-right">% Chg</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">Day Range</th>
                    <th className="py-2.5 px-3 text-right hidden md:table-cell">Volume</th>
                    <th className="py-2.5 px-3 text-center hidden lg:table-cell">Power</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {topLosers.slice(0, 20).map((item, idx) =>
                    renderStockRow(item, idx + 1)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#080D16] text-[#8B9BB4] font-mono text-[10px] uppercase border-b border-white/[0.06]">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Stock</th>
                  <th className="py-3 px-3 text-right">LTP (₹)</th>
                  <th className="py-3 px-3 text-right">% Change</th>
                  <th className="py-3 px-3 hidden sm:table-cell">Intraday Range</th>
                  <th className="py-3 px-3 text-right hidden md:table-cell">Vol &amp; RVOL</th>
                  <th className="py-3 px-3 text-center hidden lg:table-cell">Trend Power</th>
                  <th className="py-3 px-3 text-right">Intelligence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {lensItems.map((item, idx) => renderStockRow(item, idx + 1))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
