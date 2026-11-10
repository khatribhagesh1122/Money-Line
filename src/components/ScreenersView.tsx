import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Stock, DataSourceMode, GlobalInstrumentFilter } from '../types/market';
import {
  evaluateIntradayScreener,
  evaluateNarrowCprBreakout,
  getISTDate,
  get15MinIntervalInfo,
  ScreenerEvaluation,
} from '../services/marketCalculators';
import {
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Columns,
  LayoutGrid,
  Table as TableIcon,
  SlidersHorizontal,
  Flame,
  Target,
} from 'lucide-react';
import { ScreenerPresetsState } from '../services/marketDataService';

interface ScreenersViewProps {
  stocks: Stock[];
  mode: DataSourceMode;
  onStockClick: (symbol: string) => void;
  instrumentFilter: GlobalInstrumentFilter;
  onInstrumentFilterChange: (filter: GlobalInstrumentFilter) => void;
  initialDirection?: 'UP' | 'DOWN';
  screenerPresets?: ScreenerPresetsState;
  onUpdateScreenerPresets?: (partial: Partial<ScreenerPresetsState>) => void;
  viewVariant?: 'screener' | 'bullish' | 'bearish';
}

type SetupLens =
  | 'ALL'
  | 'STRONGEST'
  | 'FRESH_BREAKOUT'
  | 'VOLUME_BREAKOUT'
  | 'MA_ALIGNMENT';

export const ScreenersView: React.FC<ScreenersViewProps> = ({
  stocks,
  onStockClick,
  instrumentFilter,
  onInstrumentFilterChange,
  initialDirection = 'UP',
  screenerPresets,
  viewVariant = 'screener',
}) => {
  const [activeTab, setActiveTab] = useState<'trend' | 'cpr' | 'volume'>('trend');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'UP' | 'DOWN'>(
    viewVariant === 'bullish' ? 'UP' : viewVariant === 'bearish' ? 'DOWN' : initialDirection
  );
  const [qualifiedOnly, setQualifiedOnly] = useState<boolean>(false);
  const [setupLens, setSetupLens] = useState<SetupLens>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'table' | 'split'>('table');
  const [colMenuOpen, setColMenuOpen] = useState<boolean>(false);

  // Column group visibility controls (all visible by default)
  const [visibleCols, setVisibleCols] = useState({
    htfTrends: true, // Cols 2, 3, 4, 5
    htfCloses: true, // Cols 6, 7, 8
    srLevels: true, // Cols 9, 10
    intradayTrends: true, // Cols 12, 13
    stopLoss: true, // Col 14
  });

  // Sync direction when initialDirection or viewVariant changes
  useEffect(() => {
    if (viewVariant === 'bullish') {
      setDirectionFilter('UP');
    } else if (viewVariant === 'bearish') {
      setDirectionFilter('DOWN');
    } else if (initialDirection === 'UP' || initialDirection === 'DOWN') {
      setDirectionFilter(initialDirection);
    }
  }, [initialDirection, viewVariant]);

  // Sort State
  const [sortCol, setSortCol] = useState<'symbol' | 'cmp' | 'change' | 'power' | 'execute'>('power');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleToggleSort = (col: 'symbol' | 'cmp' | 'change' | 'power' | 'execute') => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  // Screener 2 & 3 settings
  const [cprWidthLimit, setCprWidthLimit] = useState<number>(screenerPresets?.cprWidthLimit ?? 0.30);
  const [volSpikeThreshold, setVolSpikeThreshold] = useState<number>(screenerPresets?.volSpikeThreshold ?? 1.2);

  useEffect(() => {
    if (!screenerPresets) return;
    setCprWidthLimit(screenerPresets.cprWidthLimit);
    setVolSpikeThreshold(screenerPresets.volSpikeThreshold);
  }, [screenerPresets]);

  // IST Market Time status
  const { hours, minutes } = getISTDate();
  const currentMinute = hours * 60 + minutes;
  const isAfter10AmIST = currentMinute >= 10 * 60;

  // 15-Minute Interval Engine State for Intraday Stocks Screener (Bullish & Bearish)
  const [screenerSnapshotStocks, setScreenerSnapshotStocks] = useState<Stock[]>(stocks);
  const [intervalCountdown, setIntervalCountdown] = useState<string>('');
  const [isTradingWindow, setIsTradingWindow] = useState<boolean>(false);
  const [sessionStatusLabel, setSessionStatusLabel] = useState<string>('');
  const lastSnapshotKeyRef = useRef<string>('');

  useEffect(() => {
    const mergeHydratedStocks = (snapshot: Stock[], latestStocks: Stock[], lockLivePrices: boolean): Stock[] => {
      if (snapshot.length === 0) return latestStocks;
      const snapshotMap = new Map<string, Stock>();
      snapshot.forEach(s => snapshotMap.set(s.symbol, s));

      let changed = snapshot.length !== latestStocks.length;
      const merged = latestStocks.map(latest => {
        const snap = snapshotMap.get(latest.symbol);
        if (!snap) {
          changed = true;
          return latest;
        }
        // If snapshot was captured before full screener candles or universe prices hydrated, upgrade its candle structure
        if ((!snap.dailyClose && latest.dailyClose) || (!snap.hasScreenerData && latest.hasScreenerData)) {
          changed = true;
          return lockLivePrices ? { ...latest, price: snap.price, change: snap.change, changePercent: snap.changePercent } : latest;
        }
        if (!lockLivePrices && (snap.price !== latest.price || snap.prevClose !== latest.prevClose)) {
          changed = true;
          return latest;
        }
        return snap;
      });

      return changed ? merged : snapshot;
    };

    const updateSnapshotState = () => {
      const info = get15MinIntervalInfo();
      setIntervalCountdown(info.formattedCountdown);
      setIsTradingWindow(info.isTradingWindow);
      setSessionStatusLabel(info.sessionStatusLabel);

      if (info.isTradingWindow) {
        // Market is OPEN (09:15 AM - 15:30 PM IST): refresh snapshot at 09:15 AM and on every 15-minute boundary
        if (info.intervalKey !== lastSnapshotKeyRef.current || screenerSnapshotStocks.length === 0) {
          lastSnapshotKeyRef.current = info.intervalKey;
          setScreenerSnapshotStocks(stocks);
        } else {
          // Keep 15-minute prices locked for existing stocks, but immediately include newly hydrated universe stocks
          setScreenerSnapshotStocks(prev => mergeHydratedStocks(prev, stocks, true));
        }
      } else {
        // Market is CLOSED: always display screener stocks based on previous day close
        lastSnapshotKeyRef.current = info.intervalKey;
        setScreenerSnapshotStocks(stocks);
      }
    };

    updateSnapshotState();
    const timer = setInterval(updateSnapshotState, 1000);
    return () => clearInterval(timer);
  }, [stocks, screenerSnapshotStocks.length]);

  const activeScreenerStocks = screenerSnapshotStocks.length > 0 ? screenerSnapshotStocks : stocks;

  // Complete Intraday Scanner Universe: All F&O + All Liquid Cash Stocks (no artificial 50-stock truncation)
  const allFoStocks = useMemo(() => {
    return activeScreenerStocks.filter(s => s.isFO);
  }, [activeScreenerStocks]);

  const allNonFoStocks = useMemo(() => {
    return activeScreenerStocks.filter(s => !s.isFO);
  }, [activeScreenerStocks]);

  const allScannerUniverse = useMemo(() => {
    return [...allFoStocks, ...allNonFoStocks];
  }, [allFoStocks, allNonFoStocks]);

  const filteredStocks = useMemo(() => {
    if (instrumentFilter === 'FO') return allFoStocks;
    if (instrumentFilter === 'NON_FO') return allNonFoStocks;
    return allScannerUniverse;
  }, [instrumentFilter, allFoStocks, allNonFoStocks, allScannerUniverse]);

  // Evaluate every stock using strict completed-candle Screener engine
  const evaluatedRows = useMemo(() => {
    return filteredStocks.map(stock => {
      const evaluation = evaluateIntradayScreener(stock);
      const rvol = stock.avgVolume20D > 0 ? stock.volume / stock.avgVolume20D : 1;
      return {
        stock,
        evaluation,
        rvol,
      };
    });
  }, [filteredStocks]);

  // Pagination State (20 stocks per page)
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [instrumentFilter, directionFilter, qualifiedOnly, setupLens, searchTerm, sortCol, sortDir]);

  // Counts for top status chips
  const buySignalsCount = evaluatedRows.filter(r => r.evaluation.execute === 'BUY').length;
  const sellSignalsCount = evaluatedRows.filter(r => r.evaluation.execute === 'SELL').length;
  const fullBullPowerCount = evaluatedRows.filter(r => r.evaluation.buyPower >= 6).length;
  const fullBearPowerCount = evaluatedRows.filter(r => r.evaluation.sellPower >= 6).length;

  // Filter and sort rows
  const displayedRows = useMemo(() => {
    let list = evaluatedRows;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        r =>
          r.stock.symbol.toLowerCase().includes(q) ||
          r.stock.name.toLowerCase().includes(q) ||
          r.stock.sector.toLowerCase().includes(q)
      );
    }

    // Direction Filter
    if (directionFilter === 'UP') {
      list = list.filter(
        r =>
          r.evaluation.buyPower > r.evaluation.sellPower ||
          r.evaluation.execute === 'BUY' ||
          (r.evaluation.buyPower === r.evaluation.sellPower && r.stock.changePercent >= 0)
      );
    } else if (directionFilter === 'DOWN') {
      list = list.filter(
        r =>
          r.evaluation.sellPower > r.evaluation.buyPower ||
          r.evaluation.execute === 'SELL' ||
          (r.evaluation.sellPower === r.evaluation.buyPower && r.stock.changePercent < 0)
      );
    }

    // Specialized Setup Lenses (Section 7)
    if (setupLens === 'STRONGEST') {
      list = list.filter(r => Math.max(r.evaluation.buyPower, r.evaluation.sellPower) >= 6);
    } else if (setupLens === 'FRESH_BREAKOUT') {
      list = list.filter(
        r => r.stock.price > r.stock.pdh || r.stock.price < r.stock.pdl
      );
    } else if (setupLens === 'VOLUME_BREAKOUT') {
      list = list.filter(r => r.rvol >= 1.25);
    } else if (setupLens === 'MA_ALIGNMENT') {
      list = list.filter(
        r =>
          (r.stock.price > r.stock.dma20 && r.stock.dma20 > r.stock.dma50) ||
          (r.stock.price < r.stock.dma20 && r.stock.dma20 < r.stock.dma50)
      );
    }

    // Qualified signals only toggle
    if (qualifiedOnly) {
      list = list.filter(
        r => r.evaluation.execute === 'BUY' || r.evaluation.execute === 'SELL'
      );
    }

    return [...list].sort((a, b) => {
      let diff = 0;
      if (sortCol === 'symbol') {
        diff = a.stock.symbol.localeCompare(b.stock.symbol);
      } else if (sortCol === 'cmp') {
        diff = a.stock.price - b.stock.price;
      } else if (sortCol === 'change') {
        diff = a.stock.changePercent - b.stock.changePercent;
      } else if (sortCol === 'power') {
        const powerA =
          directionFilter === 'DOWN' ? a.evaluation.sellPower : a.evaluation.buyPower;
        const powerB =
          directionFilter === 'DOWN' ? b.evaluation.sellPower : b.evaluation.buyPower;
        diff = powerA - powerB || a.stock.changePercent - b.stock.changePercent;
      } else if (sortCol === 'execute') {
        const scoreRank = (status: ScreenerEvaluation['execute']) => {
          if (status === 'BUY') return 4;
          if (status === 'SELL') return 3;
          if (status === 'NO TRADE') return 2;
          return 1;
        };
        diff = scoreRank(a.evaluation.execute) - scoreRank(b.evaluation.execute);
      }
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [evaluatedRows, searchTerm, directionFilter, setupLens, qualifiedOnly, sortCol, sortDir]);

  // Pagination Calculations (20 stocks per page)
  const totalPages = Math.max(1, Math.ceil(displayedRows.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, displayedRows.length);

  const paginatedRows = useMemo(() => {
    return displayedRows.slice(startIndex, endIndex);
  }, [displayedRows, startIndex, endIndex]);

  // Helper for trend badge
  const renderTrendBadge = (trend: 'UP' | 'DOWN' | 'NEUTRAL', tooltip: string) => {
    if (trend === 'UP') {
      return (
        <span
          title={tooltip}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold font-mono bg-[#00C995]/15 text-[#00C995] border border-[#00C995]/30 cursor-help"
        >
          <ArrowUp className="w-3 h-3" />
          <span>BULL</span>
        </span>
      );
    }
    if (trend === 'DOWN') {
      return (
        <span
          title={tooltip}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold font-mono bg-[#FF526B]/15 text-[#FF526B] border border-[#FF526B]/30 cursor-help"
        >
          <ArrowDown className="w-3 h-3" />
          <span>BEAR</span>
        </span>
      );
    }
    return (
      <span
        title={tooltip}
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-medium font-mono bg-[#121C2D] text-[#8B9BB4] border border-white/10 cursor-help"
      >
        <Minus className="w-2.5 h-2.5" />
        <span>NEUT</span>
      </span>
    );
  };

  // Helper for Execute badge
  const renderExecuteBadge = (evalObj: ScreenerEvaluation) => {
    const { execute, executeTooltip, stopLoss } = evalObj;

    if (execute === 'BUY') {
      return (
        <div className="flex flex-col items-end cursor-help" title={executeTooltip}>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black font-mono tracking-wider bg-[#00C995] text-[#080D16] shadow-[0_0_16px_rgba(0,201,149,0.4)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>BUY</span>
          </span>
          <span className="text-[10px] font-mono text-[#00C995] font-semibold mt-0.5">
            SL ₹{stopLoss.toFixed(2)}
          </span>
        </div>
      );
    }
    if (execute === 'SELL') {
      return (
        <div className="flex flex-col items-end cursor-help" title={executeTooltip}>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black font-mono tracking-wider bg-[#FF526B] text-white shadow-[0_0_16px_rgba(255,82,107,0.4)]">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>SELL</span>
          </span>
          <span className="text-[10px] font-mono text-[#FF526B] font-semibold mt-0.5">
            SL ₹{stopLoss.toFixed(2)}
          </span>
        </div>
      );
    }
    if (execute === 'NO DATA') {
      return (
        <span
          title={executeTooltip}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-[#E9B949]/15 text-[#E9B949] border border-[#E9B949]/30 cursor-help"
        >
          <HelpCircle className="w-3 h-3" />
          <span>NO DATA</span>
        </span>
      );
    }
    return (
      <span
        title={executeTooltip}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-[#121C2D] text-[#8B9BB4] border border-white/10 cursor-help"
      >
        <span>NO TRADE</span>
      </span>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Compact Command Header & Screener Controls */}
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-2.5 sm:p-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Screener Engine Tabs */}
          <div className="flex items-center gap-1 bg-[#080D16] p-1 rounded-lg border border-white/[0.06] overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('trend')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'trend'
                  ? 'bg-[#477DFF] text-white shadow-[0_2px_10px_rgba(71,125,255,0.35)]'
                  : 'text-[#8B9BB4] hover:text-white'
              }`}
            >
              1. 16-Col Trend Screener
            </button>

            <button
              onClick={() => setActiveTab('cpr')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'cpr'
                  ? 'bg-[#477DFF] text-white shadow-[0_2px_10px_rgba(71,125,255,0.35)]'
                  : 'text-[#8B9BB4] hover:text-white'
              }`}
            >
              2. Narrow CPR + Breakout
            </button>

            <button
              onClick={() => setActiveTab('volume')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'volume'
                  ? 'bg-[#477DFF] text-white shadow-[0_2px_10px_rgba(71,125,255,0.35)]'
                  : 'text-[#8B9BB4] hover:text-white'
              }`}
            >
              3. Volume &amp; OI Surge
            </button>
          </div>

          {/* Right: Segment & Direction Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Segment Toggle */}
            <div className="flex items-center gap-0.5 bg-[#080D16] p-0.5 rounded-lg border border-white/[0.06]">
              <button
                onClick={() => onInstrumentFilterChange('ALL')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  instrumentFilter === 'ALL'
                    ? 'bg-[#1A2639] text-white border border-white/10'
                    : 'text-[#8B9BB4] hover:text-white'
                }`}
              >
                All ({allScannerUniverse.length})
              </button>
              <button
                onClick={() => onInstrumentFilterChange('FO')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  instrumentFilter === 'FO'
                    ? 'bg-[#1A2639] text-white border border-white/10'
                    : 'text-[#8B9BB4] hover:text-white'
                }`}
              >
                F&amp;O ({allFoStocks.length})
              </button>
              <button
                onClick={() => onInstrumentFilterChange('NON_FO')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  instrumentFilter === 'NON_FO'
                    ? 'bg-[#1A2639] text-white border border-white/10'
                    : 'text-[#8B9BB4] hover:text-white'
                }`}
              >
                Cash ({allNonFoStocks.length})
              </button>
            </div>

            {/* Direction Filter */}
            <div className="flex items-center gap-0.5 bg-[#080D16] p-0.5 rounded-lg border border-white/[0.06]">
              <button
                onClick={() => setDirectionFilter('ALL')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  directionFilter === 'ALL'
                    ? 'bg-[#1A2639] text-white border border-white/10'
                    : 'text-[#8B9BB4] hover:text-white'
                }`}
              >
                ALL
              </button>
              <button
                onClick={() => setDirectionFilter('UP')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md flex items-center gap-0.5 transition-all cursor-pointer ${
                  directionFilter === 'UP'
                    ? 'bg-[#00C995] text-[#080D16] font-extrabold'
                    : 'text-[#8B9BB4] hover:text-white'
                }`}
              >
                <ArrowUp className="w-3 h-3" />
                <span>BULLISH</span>
              </button>
              <button
                onClick={() => setDirectionFilter('DOWN')}
                className={`px-2 py-1 text-[11px] font-bold rounded-md flex items-center gap-0.5 transition-all cursor-pointer ${
                  directionFilter === 'DOWN'
                    ? 'bg-[#FF526B] text-white font-extrabold'
                    : 'text-[#8B9BB4] hover:text-white'
                }`}
              >
                <ArrowDown className="w-3 h-3" />
                <span>BEARISH</span>
              </button>
            </div>
          </div>
        </div>

        {/* Second Control Bar: Search, Setup Lenses, Quick Metrics, Column Controls & Layout Mode */}
        {activeTab === 'trend' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
            {/* Search + Setup Lenses */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative w-44 sm:w-52">
                <Search className="w-3.5 h-3.5 text-[#8B9BB4] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filter symbol or sector..."
                  className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-[#080D16] border border-white/[0.08] text-xs text-white placeholder-[#8B9BB4] focus:outline-none focus:border-[#477DFF]"
                />
              </div>

              <div className="flex items-center gap-0.5 bg-[#080D16] p-0.5 rounded-lg border border-white/[0.06] overflow-x-auto max-w-full">
                {[
                  { id: 'ALL', label: 'All Setups' },
                  { id: 'STRONGEST', label: 'Power 6-7/7' },
                  { id: 'FRESH_BREAKOUT', label: 'PDH/PDL Breakout' },
                  { id: 'VOLUME_BREAKOUT', label: 'Vol Surge' },
                  { id: 'MA_ALIGNMENT', label: 'DMA Aligned' },
                ].map(lens => (
                  <button
                    key={lens.id}
                    onClick={() => setSetupLens(lens.id as SetupLens)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      setupLens === lens.id
                        ? 'bg-[#477DFF]/20 text-[#21C8E8] border border-[#477DFF]/40'
                        : 'text-[#8B9BB4] hover:text-white'
                    }`}
                  >
                    {lens.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Execute Summary + Qualified Filter + Columns + View Mode */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div
                title={sessionStatusLabel}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#080D16] border border-white/[0.06] text-[10px] font-mono text-[#8B9BB4]"
              >
                <RefreshCw className={`w-2.5 h-2.5 text-[#21C8E8] ${isTradingWindow ? 'animate-spin' : ''}`} />
                <span>{isTradingWindow ? `15m Next: ${intervalCountdown}` : 'Prev Day Close (Refresh 09:15 AM)'}</span>
                <span className="text-white/20">•</span>
                <span className="text-[#00C995] font-extrabold">{buySignalsCount} BUY</span>
                <span className="text-[#FF526B] font-extrabold">{sellSignalsCount} SELL</span>
              </div>

              <button
                type="button"
                onClick={() => setQualifiedOnly(v => !v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  qualifiedOnly
                    ? 'bg-[#477DFF] text-white shadow-[0_2px_10px_rgba(71,125,255,0.4)]'
                    : 'bg-[#121C2D] text-slate-200 border border-white/[0.07] hover:bg-[#1A2639]'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span>{qualifiedOnly ? 'Qualified Only' : 'Only BUY/SELL'}</span>
              </button>

              {/* Column Visibility Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setColMenuOpen(v => !v)}
                  className="px-2.5 py-1 rounded-lg bg-[#121C2D] hover:bg-[#1A2639] border border-white/[0.07] text-[11px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Columns className="w-3 h-3 text-[#21C8E8]" />
                  <span>Cols (16)</span>
                </button>
                {colMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#0D1422] border border-white/10 rounded-xl p-3 shadow-2xl z-30 space-y-2 text-xs">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#8B9BB4] pb-1 border-b border-white/[0.06]">
                      Toggle Column Groups
                    </div>
                    {[
                      { key: 'htfTrends', label: '2-5. HTF Trends (M/W/D/1H)' },
                      { key: 'htfCloses', label: '6-8. HTF Closes (M/W/D)' },
                      { key: 'srLevels', label: '9-10. Daily Support & Resist' },
                      { key: 'intradayTrends', label: '12-13. 15m & 45m Trends' },
                      { key: 'stopLoss', label: '14. Stop Loss Column' },
                    ].map(col => (
                      <label
                        key={col.key}
                        className="flex items-center justify-between gap-2 py-1 cursor-pointer text-slate-200 hover:text-white"
                      >
                        <span>{col.label}</span>
                        <input
                          type="checkbox"
                          checked={visibleCols[col.key as keyof typeof visibleCols]}
                          onChange={() =>
                            setVisibleCols(prev => ({
                              ...prev,
                              [col.key]: !prev[col.key as keyof typeof visibleCols],
                            }))
                          }
                          className="accent-[#477DFF] rounded cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-0.5 bg-[#080D16] p-0.5 rounded-lg border border-white/[0.06]">
                <button
                  onClick={() => setDisplayMode('table')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                    displayMode === 'table'
                      ? 'bg-[#1A2639] text-white'
                      : 'text-[#8B9BB4] hover:text-white'
                  }`}
                  title="16-Column Table"
                >
                  <TableIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  onClick={() => setDisplayMode('split')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                    displayMode === 'split'
                      ? 'bg-[#1A2639] text-white'
                      : 'text-[#8B9BB4] hover:text-white'
                  }`}
                  title="Setup Cards + Table View"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: 16-COLUMN INTRADAY TREND SCREENER */}
      {activeTab === 'trend' && (
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-2.5 sm:p-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)] space-y-2.5">

          {/* Setup Cards Grid: Always visible on mobile/tablet (<lg) for 100% screen fit, or on all screens when Cards mode is toggled */}
          {paginatedRows.length > 0 && (
            <div
              className={`${
                displayMode === 'split' ? 'grid' : 'grid lg:hidden'
              } grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-2`}
            >
              {paginatedRows.map(({ stock, evaluation, rvol }) => {
                const isBull = evaluation.buyPower >= evaluation.sellPower;
                const dominantPower = Math.max(evaluation.buyPower, evaluation.sellPower);
                const sl =
                  evaluation.stopLoss > 0
                    ? evaluation.stopLoss
                    : isBull
                    ? stock.first45mLow || stock.price * 0.988
                    : stock.first45mHigh || stock.price * 1.012;
                const risk = Math.max(stock.price * 0.004, Math.abs(stock.price - sl));
                const target1 = isBull ? stock.price + risk * 1.5 : stock.price - risk * 1.5;
                const target2 = isBull ? stock.price + risk * 2.5 : stock.price - risk * 2.5;

                return (
                  <div
                    key={`card-${stock.symbol}`}
                    onClick={() => onStockClick(stock.symbol)}
                    className={`rounded-xl p-3.5 bg-[#121C2D] hover:bg-[#1A2639] border transition-all cursor-pointer space-y-2.5 ${
                      evaluation.execute === 'BUY'
                        ? 'border-[#00C995]/50 shadow-[0_0_24px_rgba(0,201,149,0.12)]'
                        : evaluation.execute === 'SELL'
                        ? 'border-[#FF526B]/50 shadow-[0_0_24px_rgba(255,82,107,0.12)]'
                        : 'border-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-extrabold text-sm text-white">
                            {stock.symbol}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300 font-semibold">
                            {stock.isFO ? 'F&O' : 'CASH'}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#E9B949]/15 text-[#E9B949] font-bold">
                            {rvol.toFixed(1)}x RVOL
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8B9BB4] truncate mt-0.5">
                          {stock.name} • {stock.sector}
                        </p>
                      </div>

                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="text-sm font-extrabold text-white">
                          ₹{stock.price.toFixed(2)}
                        </div>
                        <div
                          className={`text-[11px] font-bold ${
                            stock.changePercent >= 0 ? 'text-[#00C995]' : 'text-[#FF526B]'
                          }`}
                        >
                          {stock.changePercent >= 0 ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Multi-Timeframe Alignment Strip */}
                    <div className="grid grid-cols-6 gap-1 text-center font-mono text-[9px] bg-[#080D16] p-2 rounded-lg border border-white/[0.05]">
                      {[
                        { label: 'M', val: evaluation.monthlyTrend },
                        { label: 'W', val: evaluation.weeklyTrend },
                        { label: 'D', val: evaluation.dailyTrend },
                        { label: '1H', val: evaluation.hourlyTrend },
                        { label: '15m', val: evaluation.initialTrend },
                        { label: '45m', val: evaluation.biggestTrend },
                      ].map(t => (
                        <div key={t.label} className="space-y-0.5">
                          <span className="text-[#8B9BB4] block">{t.label}</span>
                          <span
                            className={`font-extrabold block ${
                              t.val === 'UP'
                                ? 'text-[#00C995]'
                                : t.val === 'DOWN'
                                ? 'text-[#FF526B]'
                                : 'text-[#8B9BB4]'
                            }`}
                          >
                            {t.val}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Support / Resistance / Target Levels */}
                    <div className="grid grid-cols-4 gap-2 text-[10px] font-mono tabular-nums">
                      <div>
                        <span className="text-[#8B9BB4] block">D.SUPPORT</span>
                        <span className="text-[#00C995] font-bold">
                          ₹{evaluation.dailySupport.toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8B9BB4] block">D.RESIST</span>
                        <span className="text-[#FF526B] font-bold">
                          ₹{evaluation.dailyResistance.toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8B9BB4] block">45M SL</span>
                        <span className="text-white font-bold">₹{sl.toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-[#8B9BB4] block">TARGET 1/2</span>
                        <span className="text-[#21C8E8] font-bold">
                          ₹{target1.toFixed(0)} / {target2.toFixed(0)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <div className="text-[10px] font-mono">
                        <span className="text-[#8B9BB4]">Power: </span>
                        <span
                          className={`font-extrabold ${
                            isBull ? 'text-[#00C995]' : 'text-[#FF526B]'
                          }`}
                        >
                          {dominantPower}/7 {isBull ? 'BULLISH' : 'BEARISH'}
                        </span>
                      </div>
                      {renderExecuteBadge(evaluation)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 16-Column Complete Screener Table */}
          {displayedRows.length === 0 ? (
            <div className="py-12 text-center text-[#8B9BB4] border border-dashed border-white/10 rounded-xl space-y-2">
              <p className="text-sm font-bold text-white">
                {qualifiedOnly
                  ? 'No stocks currently meet the strict BUY or SELL execution threshold'
                  : 'No stocks match the selected segment and filter criteria'}
              </p>
              <p className="text-xs text-[#8B9BB4] max-w-md mx-auto">
                BUY requires all 4 HTF trends Bullish + 45m Bullish + CMP &gt; Daily Support after 10:00 AM IST. SELL requires all 4 HTF trends Bearish + 45m Bearish + CMP &lt; Daily Resistance.
              </p>
              <button
                onClick={() => {
                  setQualifiedOnly(false);
                  setSetupLens('ALL');
                  setSearchTerm('');
                }}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-[#477DFF] text-white hover:bg-[#3B66E0] cursor-pointer"
              >
                Reset Filters ({evaluatedRows.length} Stocks)
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-[#080D16] text-[#8B9BB4] uppercase text-[10px] tracking-wider font-mono select-none">
                      {/* 1. Symbol */}
                      <th
                        onClick={() => handleToggleSort('symbol')}
                        className="py-2.5 px-2.5 cursor-pointer hover:text-white sticky left-0 z-20 bg-[#080D16]"
                      >
                        <div className="flex items-center gap-1">
                          <span>1. Stock</span>
                          {sortCol === 'symbol' &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#477DFF]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#477DFF]" />
                            ))}
                        </div>
                      </th>

                      {visibleCols.htfTrends && (
                        <>
                          <th className="py-2.5 px-1.5 text-center" title="Monthly Trend (Completed candle)">
                            2. M Trend
                          </th>
                          <th className="py-2.5 px-1.5 text-center" title="Weekly Trend (Completed candle)">
                            3. W Trend
                          </th>
                          <th className="py-2.5 px-1.5 text-center" title="Daily Trend (Completed candle)">
                            4. D Trend
                          </th>
                          <th className="py-2.5 px-1.5 text-center" title="Hourly Trend (Completed 4x15m NSE blocks)">
                            5. 1H Trend
                          </th>
                        </>
                      )}

                      {visibleCols.htfCloses && (
                        <>
                          <th className="py-2.5 px-1.5 text-right" title="Completed Monthly Close Price">
                            6. M Close
                          </th>
                          <th className="py-2.5 px-1.5 text-right" title="Completed Weekly Close Price">
                            7. W Close
                          </th>
                          <th className="py-2.5 px-1.5 text-right" title="Completed Daily Close Price">
                            8. D Close
                          </th>
                        </>
                      )}

                      {visibleCols.srLevels && (
                        <>
                          <th
                            className="py-2.5 px-1.5 text-right text-[#00C995]"
                            title="Daily Support: Open of latest qualifying completed bullish daily candle (Close > Open)"
                          >
                            9. D Support
                          </th>
                          <th
                            className="py-2.5 px-1.5 text-right text-[#FF526B]"
                            title="Daily Resistance: Open of latest qualifying completed bearish daily candle (Close < Open)"
                          >
                            10. D Resist
                          </th>
                        </>
                      )}

                      {/* 11. CMP & Change% */}
                      <th
                        onClick={() => handleToggleSort('cmp')}
                        className="py-2.5 px-2 text-right cursor-pointer hover:text-white"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>11. CMP</span>
                          {sortCol === 'cmp' &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#477DFF]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#477DFF]" />
                            ))}
                        </div>
                      </th>

                      {visibleCols.intradayTrends && (
                        <>
                          <th
                            className="py-2.5 px-1.5 text-center"
                            title="Initial Trend: First 15m Candle (09:15-09:30 IST)"
                          >
                            12. 15m Init
                          </th>
                          <th
                            className="py-2.5 px-1.5 text-center"
                            title="Biggest Trend: First 45-Minute Block (09:15-10:00 IST)"
                          >
                            13. 45m Big
                          </th>
                        </>
                      )}

                      {visibleCols.stopLoss && (
                        <th
                          className="py-2.5 px-1.5 text-right"
                          title="Stop Loss: 45m Low for BUY, 45m High for SELL"
                        >
                          14. Stop Loss
                        </th>
                      )}

                      {/* 15. Power Score */}
                      <th
                        onClick={() => handleToggleSort('power')}
                        className="py-2.5 px-2 text-center cursor-pointer hover:text-white"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>15. Power</span>
                          {sortCol === 'power' &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#477DFF]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#477DFF]" />
                            ))}
                        </div>
                      </th>

                      {/* 16. Execute Signal (Sticky Right so always visible on any screen width) */}
                      <th
                        onClick={() => handleToggleSort('execute')}
                        className="py-2.5 px-2.5 text-right cursor-pointer hover:text-white sticky right-0 z-20 bg-[#080D16] shadow-[-6px_0_12px_rgba(0,0,0,0.4)]"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>16. Execute</span>
                          {sortCol === 'execute' &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#477DFF]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#477DFF]" />
                            ))}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] font-mono text-xs">
                    {paginatedRows.map(({ stock, evaluation }) => {
                      const isUp = stock.changePercent >= 0;
                      const isBuy = evaluation.execute === 'BUY';
                      const isSell = evaluation.execute === 'SELL';
                      const dominantPower = Math.max(
                        evaluation.buyPower,
                        evaluation.sellPower
                      );
                      const isBullDominant =
                        evaluation.buyPower >= evaluation.sellPower;

                      return (
                        <tr
                          key={stock.symbol}
                          onClick={() => onStockClick(stock.symbol)}
                          className={`group hover:bg-[#1A2639]/70 cursor-pointer transition-colors ${
                            isBuy
                              ? 'bg-[#00C995]/[0.06]'
                              : isSell
                              ? 'bg-[#FF526B]/[0.06]'
                              : ''
                          }`}
                        >
                          {/* 1. Symbol */}
                          <td className="py-2 px-2.5 font-sans sticky left-0 z-10 bg-[#0D1422] group-hover:bg-[#1A2639]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-white font-mono">
                                {stock.symbol}
                              </span>
                              {stock.isFO ? (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#477DFF]/15 text-[#477DFF] font-bold border border-[#477DFF]/30">
                                  F&amp;O
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-[#8B9BB4] font-semibold">
                                  CASH
                                </span>
                              )}
                            </div>
                            <span
                              className="text-[10px] text-[#8B9BB4] block truncate max-w-[125px]"
                              title={stock.name}
                            >
                              {stock.name}
                            </span>
                          </td>

                          {visibleCols.htfTrends && (
                            <>
                              <td className="py-2 px-1.5 text-center">
                                {renderTrendBadge(
                                  evaluation.monthlyTrend,
                                  evaluation.monthlyTooltip
                                )}
                              </td>
                              <td className="py-2 px-1.5 text-center">
                                {renderTrendBadge(
                                  evaluation.weeklyTrend,
                                  evaluation.weeklyTooltip
                                )}
                              </td>
                              <td className="py-2 px-1.5 text-center">
                                {renderTrendBadge(
                                  evaluation.dailyTrend,
                                  evaluation.dailyTooltip
                                )}
                              </td>
                              <td className="py-2 px-1.5 text-center">
                                {renderTrendBadge(
                                  evaluation.hourlyTrend,
                                  evaluation.hourlyTooltip
                                )}
                              </td>
                            </>
                          )}

                          {visibleCols.htfCloses && (
                            <>
                              <td
                                className="py-2 px-1.5 text-right tabular-nums text-slate-300"
                                title={`Completed Monthly Close: ₹${evaluation.monthlyClose.toFixed(2)}`}
                              >
                                ₹{evaluation.monthlyClose.toFixed(2)}
                              </td>
                              <td
                                className="py-2 px-1.5 text-right tabular-nums text-slate-300"
                                title={`Completed Weekly Close: ₹${evaluation.weeklyClose.toFixed(2)}`}
                              >
                                ₹{evaluation.weeklyClose.toFixed(2)}
                              </td>
                              <td
                                className="py-2 px-1.5 text-right tabular-nums text-slate-300"
                                title={`Completed Daily Close: ₹${evaluation.dailyClose.toFixed(2)}`}
                              >
                                ₹{evaluation.dailyClose.toFixed(2)}
                              </td>
                            </>
                          )}

                          {visibleCols.srLevels && (
                            <>
                              <td
                                className="py-2 px-1.5 text-right tabular-nums font-bold text-[#00C995] cursor-help"
                                title={evaluation.dailySupportTooltip}
                              >
                                ₹{evaluation.dailySupport.toFixed(2)}
                              </td>
                              <td
                                className="py-2 px-1.5 text-right tabular-nums font-bold text-[#FF526B] cursor-help"
                                title={evaluation.dailyResistanceTooltip}
                              >
                                ₹{evaluation.dailyResistance.toFixed(2)}
                              </td>
                            </>
                          )}

                          {/* 11. CMP & Change% */}
                          <td className="py-2 px-2 text-right tabular-nums">
                            <div className="font-extrabold text-white">
                              ₹{stock.price.toFixed(2)}
                            </div>
                            <div
                              className={`text-[10px] font-bold ${
                                isUp ? 'text-[#00C995]' : 'text-[#FF526B]'
                              }`}
                            >
                              {isUp ? '+' : ''}
                              {stock.changePercent.toFixed(2)}%
                            </div>
                          </td>

                          {visibleCols.intradayTrends && (
                            <>
                              <td className="py-2 px-1.5 text-center">
                                {renderTrendBadge(
                                  evaluation.initialTrend,
                                  evaluation.initialTrendTooltip
                                )}
                              </td>
                              <td className="py-2 px-1.5 text-center">
                                {renderTrendBadge(
                                  evaluation.biggestTrend,
                                  evaluation.biggestTrendTooltip
                                )}
                              </td>
                            </>
                          )}

                          {visibleCols.stopLoss && (
                            <td
                              className="py-2 px-1.5 text-right tabular-nums font-mono text-[#8B9BB4] cursor-help"
                              title={evaluation.stopLossTooltip}
                            >
                              {evaluation.stopLoss > 0
                                ? `₹${evaluation.stopLoss.toFixed(2)}`
                                : ''}
                            </td>
                          )}

                          {/* 15. Power Score + Signal Strength Visual Bar */}
                          <td
                            className="py-2 px-2 text-center cursor-help"
                            title={evaluation.powerTooltip}
                          >
                            <div className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#121C2D] border border-white/10">
                              <span className="text-[#00C995] font-extrabold">
                                {evaluation.buyPower}
                              </span>
                              <span className="text-[#8B9BB4]">/</span>
                              <span className="text-[#FF526B] font-extrabold">
                                {evaluation.sellPower}
                              </span>
                            </div>
                            <div className="w-14 mx-auto h-1 bg-[#080D16] rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${
                                  isBullDominant ? 'bg-[#00C995]' : 'bg-[#FF526B]'
                                }`}
                                style={{ width: `${(dominantPower / 7) * 100}%` }}
                              />
                            </div>
                          </td>

                          {/* 16. Execute Signal (Sticky Right) */}
                          <td className="py-2 px-2.5 text-right sticky right-0 z-10 bg-[#0D1422] group-hover:bg-[#1A2639] shadow-[-6px_0_12px_rgba(0,0,0,0.4)]">
                            {renderExecuteBadge(evaluation)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Intraday Scanner Pagination Controls (20 stocks per page) */}
              {displayedRows.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 pb-1 border-t border-white/[0.06] text-xs">
                  <div className="text-[#8B9BB4] font-mono text-[11px] flex items-center gap-1.5 flex-wrap">
                    <span>Showing</span>
                    <span className="font-bold text-white tabular-nums">
                      {displayedRows.length > 0 ? startIndex + 1 : 0}–{endIndex}
                    </span>
                    <span>of</span>
                    <span className="font-bold text-white tabular-nums">
                      {displayedRows.length}
                    </span>
                    <span>stocks</span>
                    <span className="text-white/20">•</span>
                    <span className="text-[#21C8E8] font-semibold">20 stocks / page</span>
                    <span className="text-white/20">•</span>
                    <span>
                      Universe: {allFoStocks.length} F&amp;O + {allNonFoStocks.length}{' '}
                      Cash (Total {allScannerUniverse.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono flex-wrap justify-center">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#121C2D] text-slate-200 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1A2639] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    <div className="flex items-center gap-1 flex-wrap">
                      {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                        .filter(
                          pageNum =>
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            Math.abs(pageNum - safeCurrentPage) <= 2
                        )
                        .map((pageNum, idx, arr) => {
                          const prevPage = idx > 0 ? arr[idx - 1] : 0;
                          const showEllipsis = prevPage > 0 && pageNum - prevPage > 1;
                          const isActive = pageNum === safeCurrentPage;
                          return (
                            <React.Fragment key={pageNum}>
                              {showEllipsis && (
                                <span className="px-1 text-xs text-[#8B9BB4]">…</span>
                              )}
                              <button
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-[#477DFF] text-white shadow-xs'
                                    : 'bg-[#121C2D] text-[#8B9BB4] hover:bg-[#1A2639] hover:text-white'
                                }`}
                              >
                                {pageNum}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage === totalPages}
                      className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#121C2D] text-slate-200 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1A2639] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: NARROW CPR BREAKOUT */}
      {activeTab === 'cpr' && (
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase">
                Narrow CPR + Breakout Screener (KS Rules)
              </h2>
              <p className="text-xs text-[#8B9BB4]">
                CPR width &lt; {cprWidthLimit}% with breakout above R1/TC or breakdown below S1/BC
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-300">
                <span>CPR Width Max:</span>
                <select
                  value={cprWidthLimit}
                  onChange={e => setCprWidthLimit(Number(e.target.value))}
                  className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#121C2D] text-xs font-mono text-white"
                >
                  <option value={0.20}>0.20% (Ultra Narrow)</option>
                  <option value={0.30}>0.30% (Standard Narrow)</option>
                  <option value={0.50}>0.50% (Medium)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] text-[#8B9BB4] uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">LTP (₹)</th>
                  <th className="py-2.5 px-3">CPR Width %</th>
                  <th className="py-2.5 px-3">CPR (TC / P / BC)</th>
                  <th className="py-2.5 px-3">Breakout State</th>
                  <th className="py-2.5 px-3">NR7</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] font-mono">
                {filteredStocks
                  .map(s => ({
                    stock: s,
                    cprEval: evaluateNarrowCprBreakout(
                      s,
                      s.changePercent >= 0 ? 'UP' : 'DOWN',
                      cprWidthLimit
                    ),
                  }))
                  .filter(item => item.cprEval.isNarrow)
                  .map(({ stock, cprEval }) => {
                    const isBullCpr = stock.changePercent >= 0 && cprEval.signalsCount > 0;
                    const isBearCpr = stock.changePercent < 0 && cprEval.signalsCount > 0;
                    return (
                      <tr
                        key={stock.symbol}
                        onClick={() => onStockClick(stock.symbol)}
                        className="hover:bg-[#1A2639] cursor-pointer"
                      >
                        <td className="py-2.5 px-3 font-sans font-bold text-white">
                          {stock.symbol}
                        </td>
                        <td className="py-2.5 px-3 text-white font-semibold tabular-nums">
                          ₹{stock.price.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-[#477DFF]/15 text-[#21C8E8] font-bold">
                            {stock.cpr.widthPercent.toFixed(3)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#8B9BB4] tabular-nums">
                          {stock.cpr.tc.toFixed(1)} / {stock.cpr.p.toFixed(1)} /{' '}
                          {stock.cpr.bc.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isBullCpr
                                ? 'bg-[#00C995]/15 text-[#00C995]'
                                : isBearCpr
                                ? 'bg-[#FF526B]/15 text-[#FF526B]'
                                : 'bg-[#121C2D] text-[#8B9BB4]'
                            }`}
                          >
                            {isBullCpr
                              ? `BULL BREAKOUT (${cprEval.signalsCount}/3)`
                              : isBearCpr
                              ? `BEAR BREAKDOWN (${cprEval.signalsCount}/3)`
                              : 'INSIDE CPR RANGE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {stock.isNR7 ? (
                            <span className="px-2 py-0.5 rounded bg-[#E9B949]/15 text-[#E9B949] text-[10px] font-bold">
                              NR7 YES
                            </span>
                          ) : (
                            <span className="text-[#8B9BB4]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VOLUME & OI SURGE */}
      {activeTab === 'volume' && (
        <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase">
                Relative Volume &amp; Open Interest Surge Scanner
              </h2>
              <p className="text-xs text-[#8B9BB4]">
                Stocks trading above {volSpikeThreshold}x 20-Day Average Volume
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-300">
                <span>Min Volume Ratio:</span>
                <select
                  value={volSpikeThreshold}
                  onChange={e => setVolSpikeThreshold(Number(e.target.value))}
                  className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#121C2D] text-xs font-mono text-white"
                >
                  <option value={1.0}>1.0x (All Active)</option>
                  <option value={1.2}>1.2x (Moderate Surge)</option>
                  <option value={1.5}>1.5x (High Volume Surge)</option>
                  <option value={2.0}>2.0x (Extreme Breakout Vol)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] text-[#8B9BB4] uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">LTP (₹)</th>
                  <th className="py-2.5 px-3">Change %</th>
                  <th className="py-2.5 px-3">RVOL Multiple</th>
                  <th className="py-2.5 px-3">F&amp;O OI Buildup</th>
                  <th className="py-2.5 px-3">PCR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] font-mono">
                {filteredStocks
                  .map(s => ({
                    stock: s,
                    volRatio: s.avgVolume20D > 0 ? s.volume / s.avgVolume20D : 1,
                  }))
                  .filter(item => item.volRatio >= volSpikeThreshold)
                  .sort((a, b) => b.volRatio - a.volRatio)
                  .map(({ stock, volRatio }) => (
                    <tr
                      key={stock.symbol}
                      onClick={() => onStockClick(stock.symbol)}
                      className="hover:bg-[#1A2639] cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-sans font-bold text-white">
                        {stock.symbol}
                      </td>
                      <td className="py-2.5 px-3 text-white font-semibold tabular-nums">
                        ₹{stock.price.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-bold tabular-nums ${
                          stock.changePercent >= 0 ? 'text-[#00C995]' : 'text-[#FF526B]'
                        }`}
                      >
                        {stock.changePercent >= 0 ? '+' : ''}
                        {stock.changePercent.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-[#E9B949]/15 text-[#E9B949] font-bold">
                          {volRatio.toFixed(2)}x
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-[#121C2D] text-slate-200 text-[10px]">
                          {stock.oiBuildup || 'Spot Delivery'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {stock.pcr ? stock.pcr.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
