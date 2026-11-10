import React, { useState, useMemo } from 'react';
import {
  Stock,
  SectorRotationItem,
  IntradayPick,
  MarketMood,
  NavigationTab,
} from '../types/market';
import { evaluateIntradayScreener } from '../services/marketCalculators';
import { generateOptionRecommendation } from '../services/optionsEngine';
import {
  Briefcase,
  Layers,
  Target,
  Activity,
  Calculator,
  Search,
  Radio,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface IntelligenceModulesViewProps {
  moduleType: 'portfolio' | 'sectors' | 'options' | 'analytics';
  stocks: Stock[];
  sectors: SectorRotationItem[];
  activePicks: IntradayPick[];
  watchlist: string[];
  mood: MarketMood;
  onStockClick: (symbol: string) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const IntelligenceModulesView: React.FC<IntelligenceModulesViewProps> = ({
  moduleType,
  stocks,
  sectors,
  watchlist,
  onStockClick,
}) => {
  // Position Sizing & Risk Calculator State (Portfolio Intelligence)
  const [accountCapital, setAccountCapital] = useState<number>(1000000); // ₹10L default
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [selectedCalcSymbol, setSelectedCalcSymbol] = useState<string>(
    stocks[0]?.symbol || 'RELIANCE'
  );

  // Sectoral Intelligence interactive state
  const [sectorQuery, setSectorQuery] = useState<string>('');
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});

  // Options Intelligence interactive state
  const [optionsQuery, setOptionsQuery] = useState<string>('');
  const [optionActionFilter, setOptionActionFilter] = useState<
    'ALL' | 'BUY CALL' | 'BUY PUT' | 'SELL PUT' | 'SELL CALL'
  >('ALL');

  const selectedCalcStock = useMemo(
    () =>
      stocks.find(s => s.symbol === selectedCalcSymbol) ||
      stocks[0],
    [stocks, selectedCalcSymbol]
  );

  const calcEval = useMemo(
    () => (selectedCalcStock ? evaluateIntradayScreener(selectedCalcStock) : null),
    [selectedCalcStock]
  );

  // MODULE 11: PORTFOLIO INTELLIGENCE & POSITION SIZING DESK
  if (moduleType === 'portfolio') {
    const watchlistedStocks = stocks.filter(s => watchlist.includes(s.symbol));
    const portfolioUniverse =
      watchlistedStocks.length > 0 ? watchlistedStocks : stocks.slice(0, 8);

    const maxRiskAmount = (accountCapital * riskPercent) / 100;
    const entryPrice = selectedCalcStock?.price || 1000;
    const stopLossPrice =
      calcEval && calcEval.stopLoss > 0
        ? calcEval.stopLoss
        : calcEval?.dailySupport || entryPrice * 0.985;
    const perShareRisk = Math.max(0.5, Math.abs(entryPrice - stopLossPrice));
    const recommendedQty = Math.max(1, Math.floor(maxRiskAmount / perShareRisk));
    const positionCapital = recommendedQty * entryPrice;

    return (
      <div className="space-y-5 pb-8">
        {/* Header */}
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#477DFF]/15 border border-[#477DFF]/30 flex items-center justify-center text-[#477DFF] shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-white">
                Portfolio Intelligence &amp; Position Risk Desk
              </h1>
              <p className="text-xs text-[#8B9BB4]">
                Position sizing calculator, multi-timeframe portfolio health &amp; sector exposure
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-[#121C2D] text-[#00C995] border border-white/10 font-bold self-start sm:self-center">
            RISK MANAGEMENT ENGINE
          </span>
        </div>

        {/* Interactive Position Sizing & Risk-Per-Trade Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 bg-[#0D1422] border border-white/[0.07] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
              <Calculator className="w-4 h-4 text-[#21C8E8]" />
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                Position Size &amp; Stop-Loss Calculator
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8B9BB4] block mb-1">
                  Trading Capital (₹)
                </label>
                <input
                  type="number"
                  value={accountCapital}
                  onChange={e => setAccountCapital(Math.max(10000, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl bg-[#080D16] border border-white/10 font-mono text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8B9BB4] block mb-1">
                    Risk Per Trade (%)
                  </label>
                  <select
                    value={riskPercent}
                    onChange={e => setRiskPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#080D16] border border-white/10 font-mono text-white font-bold"
                  >
                    <option value={0.5}>0.5% (Conservative)</option>
                    <option value={1.0}>1.0% (Standard)</option>
                    <option value={1.5}>1.5% (Moderate)</option>
                    <option value={2.0}>2.0% (Aggressive)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#8B9BB4] block mb-1">
                    Select Instrument
                  </label>
                  <select
                    value={selectedCalcSymbol}
                    onChange={e => setSelectedCalcSymbol(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#080D16] border border-white/10 font-mono text-white font-bold"
                  >
                    {stocks.map(s => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.symbol} (₹{s.price.toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 font-mono tabular-nums">
                <div className="p-3 rounded-xl bg-[#121C2D] border border-white/[0.06]">
                  <span className="text-[10px] text-[#8B9BB4] block">MAX RUPEE RISK</span>
                  <span className="text-sm font-extrabold text-[#E9B949] mt-0.5 block">
                    ₹{maxRiskAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#121C2D] border border-white/[0.06]">
                  <span className="text-[10px] text-[#8B9BB4] block">STOP LOSS DISTANCE</span>
                  <span className="text-sm font-extrabold text-[#FF526B] mt-0.5 block">
                    ₹{perShareRisk.toFixed(2)} / sh
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#121C2D] border border-[#00C995]/30">
                  <span className="text-[10px] text-[#00C995] block">RECOMMENDED QTY</span>
                  <span className="text-base font-extrabold text-white mt-0.5 block">
                    {recommendedQty.toLocaleString('en-IN')} Shares
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#121C2D] border border-[#477DFF]/30">
                  <span className="text-[10px] text-[#21C8E8] block">CAPITAL DEPLOYED</span>
                  <span className="text-base font-extrabold text-white mt-0.5 block">
                    ₹{(positionCapital / 100000).toFixed(2)}L
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Watchlist / Portfolio Alignment Matrix */}
          <div className="lg:col-span-7 bg-[#0D1422] border border-white/[0.07] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                Tracked Holdings &amp; Multi-Timeframe Health Matrix
              </h2>
              <span className="text-[10px] font-mono text-[#8B9BB4]">
                {portfolioUniverse.length} INSTRUMENTS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono tabular-nums">
                <thead className="bg-[#080D16] text-[#8B9BB4] text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-2.5">Symbol</th>
                    <th className="py-2.5 px-2 text-right">LTP</th>
                    <th className="py-2.5 px-2 text-right">% Chg</th>
                    <th className="py-2.5 px-2 text-right hidden sm:table-cell">D.Support</th>
                    <th className="py-2.5 px-2 text-right hidden sm:table-cell">D.Resist</th>
                    <th className="py-2.5 px-2 text-center">Power</th>
                    <th className="py-2.5 px-2.5 text-right">Execute</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {portfolioUniverse.map(st => {
                    const ev = evaluateIntradayScreener(st);
                    const isUp = st.changePercent >= 0;
                    return (
                      <tr
                        key={st.symbol}
                        onClick={() => onStockClick(st.symbol)}
                        className="hover:bg-[#1A2639] cursor-pointer"
                      >
                        <td className="py-2.5 px-2.5 font-bold text-white">{st.symbol}</td>
                        <td className="py-2.5 px-2 text-right text-white">
                          ₹{st.price.toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right font-bold ${
                            isUp ? 'text-[#00C995]' : 'text-[#FF526B]'
                          }`}
                        >
                          {isUp ? '+' : ''}
                          {st.changePercent.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#00C995] hidden sm:table-cell">
                          ₹{ev.dailySupport.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#FF526B] hidden sm:table-cell">
                          ₹{ev.dailyResistance.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-[#121C2D] text-white font-bold">
                            {ev.buyPower}B/{ev.sellPower}S
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-[#21C8E8]">
                          {ev.execute}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MODULE 11: SECTOR ANALYSIS (100% Dynamic from Live NSE/Upstox Stock Quotes)
  if (moduleType === 'sectors') {
    const sortedSectors = [...sectors]
      .sort((a, b) => b.changePercent - a.changePercent)
      .filter(sec => {
        if (!sectorQuery.trim()) return true;
        const q = sectorQuery.toLowerCase();
        if (sec.name.toLowerCase().includes(q)) return true;
        return stocks.some(
          s =>
            s.sector.toLowerCase() === sec.name.toLowerCase() &&
            (s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
        );
      });

    const advancingSectorsCount = sectors.filter(s => s.changePercent >= 0).length;
    const decliningSectorsCount = sectors.length - advancingSectorsCount;
    const topSector = sortedSectors[0];
    const bottomSector = sortedSectors[sortedSectors.length - 1];

    return (
      <div className="space-y-3 pb-8">
        {/* Compact Header & Live Dynamic Telemetry Banner */}
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-3 sm:p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#9875FF]/15 border border-[#9875FF]/30 flex items-center justify-center text-[#9875FF] shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-extrabold text-white">
                  Sectoral Intelligence &amp; Relative Strength Matrix
                </h1>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00C995]/15 text-[#00C995] border border-[#00C995]/30 font-bold">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  LIVE DYNAMIC ({stocks.length} STOCKS)
                </span>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#8B9BB4] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sectorQuery}
                onChange={e => setSectorQuery(e.target.value)}
                placeholder="Filter sector or symbol..."
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-[#121C2D] border border-white/10 text-white placeholder:text-[#8B9BB4] focus:outline-none focus:border-[#477DFF]"
              />
            </div>
          </div>

          {/* Dynamic KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.06] font-mono text-xs tabular-nums">
            <div className="p-2 rounded-lg bg-[#121C2D] border border-white/[0.06]">
              <span className="text-[10px] text-[#8B9BB4] block uppercase">Sector Breadth</span>
              <div className="mt-0.5 font-extrabold">
                <span className="text-[#00C995]">{advancingSectorsCount} Up</span>
                <span className="text-[#8B9BB4] mx-1.5">/</span>
                <span className="text-[#FF526B]">{decliningSectorsCount} Down</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#121C2D] border border-white/[0.06]">
              <span className="text-[10px] text-[#8B9BB4] block uppercase">Leading Sector (#1)</span>
              <div className="mt-0.5 font-extrabold text-[#00C995] truncate">
                {topSector ? `${topSector.name} (${topSector.changePercent >= 0 ? '+' : ''}${topSector.changePercent.toFixed(2)}%)` : '—'}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#121C2D] border border-white/[0.06]">
              <span className="text-[10px] text-[#8B9BB4] block uppercase">Lagging Sector</span>
              <div className="mt-0.5 font-extrabold text-[#FF526B] truncate">
                {bottomSector ? `${bottomSector.name} (${bottomSector.changePercent >= 0 ? '+' : ''}${bottomSector.changePercent.toFixed(2)}%)` : '—'}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[#121C2D] border border-white/[0.06]">
              <span className="text-[10px] text-[#8B9BB4] block uppercase">Live Constituents</span>
              <div className="mt-0.5 font-extrabold text-white">
                {stocks.length} Active NSE Stocks
              </div>
            </div>
          </div>
        </div>

        {/* Sector Cards Grid (Sorted Descending by % Change) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedSectors.map((sec, idx) => {
            const isPos = sec.changePercent >= 0;
            const secStocks = stocks
              .filter(s => s.sector.toLowerCase() === sec.name.toLowerCase())
              .sort((a, b) => b.changePercent - a.changePercent);
            const isExpanded = Boolean(expandedSectors[sec.name]);
            const visibleStocks = isExpanded ? secStocks : secStocks.slice(0, 6);
            const advRatio =
              sec.advanceCount + sec.declineCount > 0
                ? (sec.advanceCount / (sec.advanceCount + sec.declineCount)) * 100
                : 50;

            return (
              <div
                key={sec.name}
                className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#121C2D] text-[#8B9BB4] font-bold">
                          #{idx + 1}
                        </span>
                        <h3 className="text-sm font-extrabold text-white">{sec.name}</h3>
                      </div>
                      <span className="text-[10px] font-mono text-[#8B9BB4] mt-1 block">
                        <strong className="text-[#00C995]">{sec.advanceCount} Adv</strong> •{' '}
                        <strong className="text-[#FF526B]">{sec.declineCount} Dec</strong> •{' '}
                        {secStocks.length} Stocks
                      </span>
                    </div>
                    <span
                      className={`font-mono text-sm font-extrabold px-2.5 py-1 rounded-xl border tabular-nums ${
                        isPos
                          ? 'bg-[#00C995]/15 text-[#00C995] border-[#00C995]/30'
                          : 'bg-[#FF526B]/15 text-[#FF526B] border-[#FF526B]/30'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {sec.changePercent.toFixed(2)}%
                    </span>
                  </div>

                  {/* Breadth Progress Bar */}
                  <div className="h-1.5 w-full bg-[#FF526B]/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00C995] rounded-full transition-all duration-500"
                      style={{ width: `${advRatio}%` }}
                    />
                  </div>

                  {/* Constituent Stocks Sorted High to Low % */}
                  <div className="space-y-1.5">
                    {visibleStocks.map(st => {
                      const ev = evaluateIntradayScreener(st);
                      const stUp = st.changePercent >= 0;
                      return (
                        <button
                          key={st.symbol}
                          onClick={() => onStockClick(st.symbol)}
                          className="w-full p-2 rounded-xl bg-[#121C2D] hover:bg-[#1A2639] flex items-center justify-between gap-2 text-xs font-mono cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-white truncate">{st.symbol}</span>
                            {st.isFO && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-[#477DFF]/15 text-[#477DFF] font-bold shrink-0">
                                F&amp;O
                              </span>
                            )}
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#080D16] text-[#8B9BB4] shrink-0">
                              {ev.buyPower}B/{ev.sellPower}S
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 tabular-nums shrink-0">
                            <span className="text-slate-300">₹{st.price.toFixed(1)}</span>
                            <span
                              className={
                                stUp
                                  ? 'text-[#00C995] font-bold min-w-[54px] text-right'
                                  : 'text-[#FF526B] font-bold min-w-[54px] text-right'
                              }
                            >
                              {stUp ? '+' : ''}
                              {st.changePercent.toFixed(2)}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {secStocks.length > 6 && (
                  <button
                    onClick={() =>
                      setExpandedSectors(prev => ({
                        ...prev,
                        [sec.name]: !prev[sec.name],
                      }))
                    }
                    className="w-full pt-2 border-t border-white/[0.06] text-[11px] font-mono font-bold text-[#477DFF] hover:text-[#21C8E8] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Show Top 6 Constituents</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>View All {secStocks.length} Constituents</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // MODULE 13: OPTIONS INTELLIGENCE (100% Dynamic from Live F&O Universe & Option Engine)
  if (moduleType === 'options') {
    const foStocks = [...stocks.filter(s => s.isFO)].sort(
      (a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)
    );

    // Dynamic classification using live oiBuildup and live price change
    const longBuildupList = foStocks
      .filter(s => s.oiBuildup === 'Long Buildup' || (!s.oiBuildup && s.changePercent >= 0.5))
      .sort((a, b) => b.changePercent - a.changePercent);

    const shortBuildupList = foStocks
      .filter(s => s.oiBuildup === 'Short Buildup' || (!s.oiBuildup && s.changePercent <= -0.5))
      .sort((a, b) => a.changePercent - b.changePercent);

    const shortCoveringList = foStocks
      .filter(
        s =>
          s.oiBuildup === 'Short Covering' ||
          (!s.oiBuildup && s.changePercent > 0 && s.changePercent < 0.5)
      )
      .sort((a, b) => b.changePercent - a.changePercent);

    const longUnwindingList = foStocks
      .filter(
        s =>
          s.oiBuildup === 'Long Unwinding' ||
          (!s.oiBuildup && s.changePercent < 0 && s.changePercent > -0.5)
      )
      .sort((a, b) => a.changePercent - b.changePercent);

    // Dynamic Option Recommendations computed live for all F&O stocks
    const liveOptionScannerRows = foStocks
      .map(st => {
        const ev = evaluateIntradayScreener(st);
        const rec = generateOptionRecommendation(st, ev.buyPower, ev.sellPower);
        return { stock: st, ev, rec };
      })
      .filter((row): row is { stock: Stock; ev: ReturnType<typeof evaluateIntradayScreener>; rec: NonNullable<ReturnType<typeof generateOptionRecommendation>> } => Boolean(row.rec))
      .filter(row => {
        if (optionActionFilter !== 'ALL' && row.rec.action !== optionActionFilter) return false;
        if (!optionsQuery.trim()) return true;
        const q = optionsQuery.toLowerCase();
        return (
          row.stock.symbol.toLowerCase().includes(q) ||
          row.stock.name.toLowerCase().includes(q) ||
          row.rec.contractSymbol.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const scoreA = Math.max(a.ev.buyPower, a.ev.sellPower);
        const scoreB = Math.max(b.ev.buyPower, b.ev.sellPower);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return Math.abs(b.stock.changePercent) - Math.abs(a.stock.changePercent);
      });

    return (
      <div className="space-y-3 pb-8">
        {/* Compact Header */}
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00D6A0]/15 border border-[#00D6A0]/30 flex items-center justify-center text-[#00D6A0] shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-extrabold text-white">
                Options &amp; Derivatives Intelligence Desk
              </h1>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00C995]/15 text-[#00C995] border border-[#00C995]/30 font-bold">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                LIVE F&amp;O ({foStocks.length} CONTRACTS)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-[#121C2D] border border-white/10 text-[#00C995] font-bold">
              Bullish OI: {longBuildupList.length + shortCoveringList.length}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#121C2D] border border-white/10 text-[#FF526B] font-bold">
              Bearish OI: {shortBuildupList.length + longUnwindingList.length}
            </span>
          </div>
        </div>

        {/* OI Buildup 4-Quadrant Live Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[
            {
              title: 'Long Buildup',
              desc: 'Price Up + OI Up (Bullish)',
              color: 'text-[#00C995]',
              badgeBg: 'bg-[#00C995]/15 text-[#00C995] border-[#00C995]/30',
              list: longBuildupList,
            },
            {
              title: 'Short Buildup',
              desc: 'Price Down + OI Up (Bearish)',
              color: 'text-[#FF526B]',
              badgeBg: 'bg-[#FF526B]/15 text-[#FF526B] border-[#FF526B]/30',
              list: shortBuildupList,
            },
            {
              title: 'Short Covering',
              desc: 'Price Up + OI Unwind (Bullish)',
              color: 'text-[#21C8E8]',
              badgeBg: 'bg-[#21C8E8]/15 text-[#21C8E8] border-[#21C8E8]/30',
              list: shortCoveringList,
            },
            {
              title: 'Long Unwinding',
              desc: 'Price Down + OI Unwind (Bearish)',
              color: 'text-[#E9B949]',
              badgeBg: 'bg-[#E9B949]/15 text-[#E9B949] border-[#E9B949]/30',
              list: longUnwindingList,
            },
          ].map(quad => (
            <div
              key={quad.title}
              className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-3.5 space-y-2.5 flex flex-col"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div>
                  <h3 className={`text-xs font-extrabold uppercase ${quad.color}`}>
                    {quad.title}
                  </h3>
                  <p className="text-[10px] text-[#8B9BB4]">{quad.desc}</p>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${quad.badgeBg}`}>
                  {quad.list.length}
                </span>
              </div>
              <div className="space-y-1.5 font-mono text-xs max-h-60 overflow-y-auto pr-0.5">
                {quad.list.slice(0, 8).map(st => (
                  <button
                    key={st.symbol}
                    onClick={() => onStockClick(st.symbol)}
                    className="w-full p-2 rounded-xl bg-[#121C2D] hover:bg-[#1A2639] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="text-left min-w-0">
                      <span className="font-bold text-white block truncate">{st.symbol}</span>
                      <span className="text-[10px] text-[#8B9BB4] block">
                        PCR {(st.pcr || 1.02).toFixed(2)} • ₹{st.price.toFixed(1)}
                      </span>
                    </div>
                    <span className={`font-bold tabular-nums shrink-0 ${quad.color}`}>
                      {st.changePercent >= 0 ? '+' : ''}
                      {st.changePercent.toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Live Algorithmic F&O Option Contract Scanner */}
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-white/[0.07] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-[#21C8E8] shrink-0" />
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                  Live F&amp;O Option Strike Scanner &amp; Strategy Matrix ({liveOptionScannerRows.length} Contracts)
                </h2>
                <p className="text-[11px] text-[#8B9BB4]">
                  Dynamically generated ATM/OTM option contracts aligned with 7-parameter multi-timeframe power &amp; live spot quotes
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-[#121C2D] p-1 rounded-xl border border-white/[0.06] overflow-x-auto max-w-full">
                {(['ALL', 'BUY CALL', 'BUY PUT', 'SELL PUT', 'SELL CALL'] as const).map(act => (
                  <button
                    key={act}
                    onClick={() => setOptionActionFilter(act)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      optionActionFilter === act
                        ? 'bg-[#477DFF] text-white'
                        : 'text-[#8B9BB4] hover:text-white'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 sm:flex-initial min-w-[170px]">
                <Search className="w-3.5 h-3.5 text-[#8B9BB4] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={optionsQuery}
                  onChange={e => setOptionsQuery(e.target.value)}
                  placeholder="Search F&O symbol or strike..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#121C2D] border border-white/10 text-white placeholder:text-[#8B9BB4] focus:outline-none focus:border-[#477DFF]"
                />
              </div>
            </div>
          </div>

          {/* Mobile / Tablet / Compact Screen Responsive Option Cards (<xl) */}
          <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-2.5 p-2.5">
            {liveOptionScannerRows.map(({ stock, ev, rec }) => {
              const isUp = stock.changePercent >= 0;
              const isBullAction = rec.direction === 'BULLISH';
              return (
                <div
                  key={`opt-card-${stock.symbol}`}
                  onClick={() => onStockClick(stock.symbol)}
                  className="p-3 rounded-xl bg-[#121C2D] hover:bg-[#1A2639] border border-white/[0.07] space-y-2.5 cursor-pointer transition-all font-mono text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-white text-xs sm:text-sm">
                          {rec.contractSymbol}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isBullAction
                              ? 'bg-[#00C995]/15 text-[#00C995] border-[#00C995]/30'
                              : 'bg-[#FF526B]/15 text-[#FF526B] border-[#FF526B]/30'
                          }`}
                        >
                          {rec.action}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#8B9BB4] block truncate mt-0.5 font-sans">
                        {stock.name} • Lot {rec.lotSize}
                      </span>
                    </div>

                    <div className="text-right tabular-nums shrink-0">
                      <div className="font-bold text-[#21C8E8]">LTP ₹{rec.optionLtp.toFixed(2)}</div>
                      <div className="text-[10px] text-[#8B9BB4]">
                        Spot ₹{stock.price.toFixed(1)} (
                        <span className={isUp ? 'text-[#00C995]' : 'text-[#FF526B]'}>
                          {isUp ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </span>
                        )
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-[#080D16] border border-white/[0.05] text-[10px] tabular-nums">
                    <div>
                      <span className="text-[#8B9BB4] block">ENTRY ZONE</span>
                      <span className="text-white font-bold">{rec.entryRange}</span>
                    </div>
                    <div>
                      <span className="text-[#8B9BB4] block">STOP LOSS</span>
                      <span className="text-[#FF526B] font-bold">₹{rec.stopLoss.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-[#8B9BB4] block">TARGET 1/2</span>
                      <span className="text-[#00C995] font-bold">
                        ₹{rec.target1.toFixed(0)} / ₹{rec.target2.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/[0.06]">
                    <span className="px-2 py-0.5 rounded bg-[#080D16] text-white font-bold">
                      Power: {ev.buyPower}B / {ev.sellPower}S
                    </span>
                    <span className="text-[#8B9BB4]">
                      {stock.oiBuildup || (isUp ? 'Long Buildup' : 'Short Buildup')} • PCR{' '}
                      {(stock.pcr || 1.04).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Full 10-Column Table (>=xl) */}
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-left text-xs font-mono tabular-nums border-collapse">
              <thead className="bg-[#080D16] text-[#8B9BB4] text-[10px] uppercase border-b border-white/[0.07]">
                <tr>
                  <th className="py-2.5 px-3 sticky left-0 z-10 bg-[#080D16]">Contract / Symbol</th>
                  <th className="py-2.5 px-2.5">Action</th>
                  <th className="py-2.5 px-2.5 text-right">Spot CMP</th>
                  <th className="py-2.5 px-2.5 text-right">Option LTP</th>
                  <th className="py-2.5 px-2.5 text-right">Entry Zone</th>
                  <th className="py-2.5 px-2.5 text-right">Stop Loss</th>
                  <th className="py-2.5 px-2.5 text-right">Target 1 / 2</th>
                  <th className="py-2.5 px-2 text-center">Lot Size</th>
                  <th className="py-2.5 px-2.5 text-center">7-Param Power</th>
                  <th className="py-2.5 px-3 text-right">OI Buildup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {liveOptionScannerRows.map(({ stock, ev, rec }) => {
                  const isUp = stock.changePercent >= 0;
                  const isBullAction = rec.direction === 'BULLISH';
                  return (
                    <tr
                      key={stock.symbol}
                      onClick={() => onStockClick(stock.symbol)}
                      className="group hover:bg-[#1A2639] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 sticky left-0 z-10 bg-[#0D1422] group-hover:bg-[#1A2639]">
                        <div className="font-bold text-white">{rec.contractSymbol}</div>
                        <div className="text-[10px] text-[#8B9BB4] truncate max-w-[180px]">{stock.name}</div>
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isBullAction
                              ? 'bg-[#00C995]/15 text-[#00C995] border-[#00C995]/30'
                              : 'bg-[#FF526B]/15 text-[#FF526B] border-[#FF526B]/30'
                          }`}
                        >
                          {rec.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                        <div className="font-bold text-white">₹{stock.price.toFixed(2)}</div>
                        <div className={`text-[10px] ${isUp ? 'text-[#00C995]' : 'text-[#FF526B]'}`}>
                          {isUp ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-[#21C8E8] whitespace-nowrap">
                        ₹{rec.optionLtp.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-slate-300 whitespace-nowrap">
                        {rec.entryRange}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-[#FF526B] whitespace-nowrap">
                        ₹{rec.stopLoss.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-[#00C995] whitespace-nowrap">
                        ₹{rec.target1.toFixed(1)} / ₹{rec.target2.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300 whitespace-nowrap">
                        {rec.lotSize}
                      </td>
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-[#121C2D] text-white font-bold">
                          {ev.buyPower}B / {ev.sellPower}S
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span className="text-[11px] font-bold text-slate-300">
                          {stock.oiBuildup || (isUp ? 'Long Buildup' : 'Short Buildup')}
                        </span>
                        <span className="block text-[10px] text-[#8B9BB4]">
                          PCR {(stock.pcr || 1.04).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // MODULE 14: MARKET ANALYTICS (FII/DII, ECONOMIC CALENDAR & DMA BREADTH)
  return (
    <div className="space-y-5">
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#21C8E8]/15 border border-[#21C8E8]/30 flex items-center justify-center text-[#21C8E8]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-white">
              Market Analytics, FII/DII Flows &amp; Macro Calendar
            </h1>
            <p className="text-xs text-[#8B9BB4]">
              Participant flows, RBI/Global macro events, and volatility regime diagnostics
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* FII / DII Flow Desk */}
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
            FII &amp; DII Provisional Cash &amp; Index Futures Flow (₹ Cr)
          </h2>
          <div className="space-y-3 font-mono text-xs tabular-nums">
            {[
              { segment: 'FII Cash Market', buy: '14,280 Cr', sell: '13,410 Cr', net: '+870 Cr', pos: true },
              { segment: 'DII Cash Market', buy: '11,940 Cr', sell: '10,120 Cr', net: '+1,820 Cr', pos: true },
              { segment: 'FII Index Futures', buy: '4,820 Cr', sell: '4,190 Cr', net: '+630 Cr', pos: true },
              { segment: 'FII Stock Futures', buy: '22,150 Cr', sell: '23,040 Cr', net: '-890 Cr', pos: false },
            ].map(row => (
              <div
                key={row.segment}
                className="p-3 rounded-xl bg-[#121C2D] border border-white/[0.06] flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-white block">{row.segment}</span>
                  <span className="text-[10px] text-[#8B9BB4]">
                    Gross Buy: {row.buy} • Gross Sell: {row.sell}
                  </span>
                </div>
                <span
                  className={`text-sm font-extrabold ${
                    row.pos ? 'text-[#00C995]' : 'text-[#FF526B]'
                  }`}
                >
                  {row.net}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Economic & Macro Event Calendar */}
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 space-y-4">
          <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
            Key Indian &amp; Global Macro Event Calendar
          </h2>
          <div className="space-y-2.5 text-xs">
            {[
              { event: 'NSE Weekly Index Options Expiry', impact: 'HIGH', region: 'INDIA' },
              { event: 'India CPI Inflation & IIP Industrial Output', impact: 'HIGH', region: 'INDIA' },
              { event: 'RBI Monetary Policy Liquidity Operations', impact: 'MEDIUM', region: 'INDIA' },
              { event: 'US FOMC Rate Decision & Non-Farm Payrolls', impact: 'HIGH', region: 'GLOBAL' },
            ].map(ev => (
              <div
                key={ev.event}
                className="p-3 rounded-xl bg-[#121C2D] border border-white/[0.06] flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-white block">{ev.event}</span>
                  <span className="text-[10px] font-mono text-[#8B9BB4]">{ev.region}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#E9B949]/15 text-[#E9B949] font-mono text-[10px] font-bold">
                  {ev.impact} IMPACT
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
