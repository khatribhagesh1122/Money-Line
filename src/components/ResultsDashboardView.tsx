import React, { useState, useEffect, useMemo } from 'react';
import { ResultItem, GlobalInstrumentFilter, Stock, QuarterlyFinancialRow } from '../types/market';
import { marketDataService } from '../services/marketDataService';
import {
  CalendarDays,
  Flame,
  Search,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  CalendarClock,
  Table2,
  FileText,
  X,
  Building2,
} from 'lucide-react';

interface ResultsDashboardViewProps {
  results: ResultItem[];
  stocks: Stock[];
  onSelectStock: (symbol: string) => void;
  instrumentFilter: GlobalInstrumentFilter;
  onInstrumentFilterChange: (filter: GlobalInstrumentFilter) => void;
  isFlashMode?: boolean;
  lastUpdatedTime?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
}

function formatDisplayDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (monthIdx < 0 || monthIdx > 11 || isNaN(day) || isNaN(year)) return isoDate;
  return `${String(day).padStart(2, '0')} ${months[monthIdx]} ${year}`;
}

export const ResultsDashboardView: React.FC<ResultsDashboardViewProps> = ({
  results,
  stocks,
  onSelectStock,
  instrumentFilter,
  onInstrumentFilterChange,
  isFlashMode = false,
  lastUpdatedTime,
  isLoading = false,
  onRefresh,
}) => {
  const [activePeriod, setActivePeriod] = useState<
    'all' | 'yesterday' | 'today' | 'tomorrow' | 'upcoming' | 'declared'
  >(isFlashMode ? 'declared' : 'today');
  const [searchQuery, setSearchQuery] = useState('');
  const [reactionFilter, setReactionFilter] = useState<
    'ALL' | 'Declared' | 'Beat' | 'Miss' | 'In line' | 'Pending'
  >('ALL');
  const [confirmationFilter, setConfirmationFilter] = useState<
    'ALL' | 'Confirmed' | 'Estimated' | 'Revised'
  >('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(150);

  // Screener.in-Style 5-Quarter Financial Comparison State
  const [selectedFinancialItem, setSelectedFinancialItem] = useState<ResultItem | null>(null);
  const [reportType, setReportType] = useState<'Consolidated' | 'Standalone'>('Consolidated');
  const [fetchedFinancials, setFetchedFinancials] = useState<{
    consolidated: QuarterlyFinancialRow[];
    standalone: QuarterlyFinancialRow[];
    nseFilingLink?: string;
    bseFilingLink?: string;
    xbrlFilingLink?: string;
  } | null>(null);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState<boolean>(false);

  // Synchronize default period filter when switching between Results Calendar and Results Flash
  useEffect(() => {
    setActivePeriod(isFlashMode ? 'declared' : 'today');
    setVisibleCount(150);
  }, [isFlashMode]);

  useEffect(() => {
    setVisibleCount(150);
  }, [activePeriod, searchQuery, reactionFilter, confirmationFilter, instrumentFilter]);

  const handleOpenScreenerModal = async (item: ResultItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFinancialItem(item);
    setReportType(item.reportType || 'Consolidated');

    if (item.consolidatedHistory && item.consolidatedHistory.length > 0) {
      setFetchedFinancials({
        consolidated: item.consolidatedHistory,
        standalone: item.standaloneHistory || [],
        nseFilingLink: item.filingLink,
        bseFilingLink: item.bseFilingLink,
        xbrlFilingLink: item.xbrlFilingLink,
      });
      return;
    }

    setIsLoadingFinancials(true);
    const data = await marketDataService.fetchCompanyFinancials(item.symbol);
    if (data) {
      setFetchedFinancials({
        consolidated: data.consolidated,
        standalone: data.standalone,
        nseFilingLink: data.nseFilingLink || item.filingLink,
        bseFilingLink: data.bseFilingLink || item.bseFilingLink,
        xbrlFilingLink: data.xbrlFilingLink || item.xbrlFilingLink,
      });
    } else {
      setFetchedFinancials(null);
    }
    setIsLoadingFinancials(false);
  };

  const counts = useMemo(() => {
    const yesterday = results.filter(r => r.period === 'yesterday').length;
    const today = results.filter(r => r.period === 'today').length;
    const tomorrow = results.filter(r => r.period === 'tomorrow').length;
    const upcoming = results.filter(
      r =>
        r.status === 'Scheduled' &&
        (r.period === 'today' ||
          r.period === 'tomorrow' ||
          r.period === 'next2days' ||
          r.period === 'upcoming' ||
          r.period === 'calendar')
    ).length;
    const declared = results.filter(r => r.status === 'Declared' || r.reaction !== 'Pending').length;
    return { yesterday, today, tomorrow, upcoming, declared };
  }, [results]);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    const matching = results.filter(item => {
      const isDeclared = item.status === 'Declared' || item.reaction !== 'Pending';
      const isUpcoming =
        item.status === 'Scheduled' &&
        (item.period === 'today' ||
          item.period === 'tomorrow' ||
          item.period === 'next2days' ||
          item.period === 'upcoming' ||
          item.period === 'calendar');

      // When user searches a stock symbol/name, search across ALL periods if activePeriod would hide it
      const hasSearch = searchQuery.trim().length > 0;
      if (!hasSearch) {
        if (activePeriod === 'yesterday' && item.period !== 'yesterday') return false;
        if (activePeriod === 'today' && item.period !== 'today') return false;
        if (activePeriod === 'tomorrow' && item.period !== 'tomorrow') return false;
        if (activePeriod === 'upcoming' && !isUpcoming) return false;
        if (activePeriod === 'declared' && !isDeclared) return false;
      }

      // Reaction / Outcome filter
      if (reactionFilter === 'Declared' && !isDeclared) return false;
      if (reactionFilter === 'Pending' && item.status !== 'Scheduled') return false;
      if (
        reactionFilter !== 'ALL' &&
        reactionFilter !== 'Declared' &&
        reactionFilter !== 'Pending' &&
        item.reaction !== reactionFilter
      ) {
        return false;
      }

      // Confirmation / Revision filter
      const effectiveDateStatus = item.dateStatus || 'Confirmed';
      if (confirmationFilter === 'Confirmed' && effectiveDateStatus !== 'Confirmed') return false;
      if (confirmationFilter === 'Estimated' && effectiveDateStatus !== 'Estimated') return false;
      if (confirmationFilter === 'Revised' && !item.isRevised) return false;

      // Search query
      if (hasSearch) {
        const q = searchQuery.trim().toLowerCase();
        const matchSym = item.symbol.toLowerCase().includes(q);
        const matchName = item.company.toLowerCase().includes(q);
        const matchNotes = item.notes?.toLowerCase().includes(q);
        const matchFiling = item.filingReference?.toLowerCase().includes(q);
        if (!matchSym && !matchName && !matchNotes && !matchFiling) return false;
      }

      // Instrument filter (F&O vs Cash)
      const stock = stocks.find(s => s.symbol === item.symbol);
      const isFO = stock ? stock.isFO : item.isFO;
      if (instrumentFilter === 'FO' && !isFO) return false;
      if (instrumentFilter === 'NON_FO' && isFO) return false;

      return true;
    });

    // Sort: within each date/period, prioritize F&O stocks and Declared results first so major stocks (e.g. TITAN, BHARTIARTL, M&M, BRITANNIA, ONGC, LICI) appear at the top
    return [...matching].sort((a, b) => {
      const aFo = a.isFO ? 1 : 0;
      const bFo = b.isFO ? 1 : 0;

      if (activePeriod === 'today') {
        if (aFo !== bFo) return bFo - aFo;
        const aDecl = a.status === 'Declared' ? 1 : 0;
        const bDecl = b.status === 'Declared' ? 1 : 0;
        if (aDecl !== bDecl) return bDecl - aDecl;
        return a.symbol.localeCompare(b.symbol);
      }

      if (activePeriod === 'upcoming' || activePeriod === 'tomorrow') {
        if (a.resultDate !== b.resultDate) return a.resultDate.localeCompare(b.resultDate);
        if (aFo !== bFo) return bFo - aFo;
        return a.symbol.localeCompare(b.symbol);
      }

      if (activePeriod === 'declared' || activePeriod === 'yesterday') {
        if (a.resultDate !== b.resultDate) return b.resultDate.localeCompare(a.resultDate);
        if (aFo !== bFo) return bFo - aFo;
        return a.symbol.localeCompare(b.symbol);
      }

      const periodRank: Record<string, number> = {
        today: 1,
        yesterday: 2,
        tomorrow: 3,
        next2days: 4,
        upcoming: 5,
        calendar: 6,
        declared: 7,
      };
      const rankDiff = (periodRank[a.period] || 9) - (periodRank[b.period] || 9);
      if (rankDiff !== 0) return rankDiff;
      if (aFo !== bFo) return bFo - aFo;
      return a.status === 'Scheduled'
        ? a.resultDate.localeCompare(b.resultDate)
        : b.resultDate.localeCompare(a.resultDate);
    });
  }, [results, activePeriod, reactionFilter, confirmationFilter, searchQuery, stocks, instrumentFilter]);

  const visibleResults = useMemo(
    () => filteredResults.slice(0, visibleCount),
    [filteredResults, visibleCount]
  );

  const getPeriodLabelBadge = (item: ResultItem) => {
    if (item.period === 'today') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 uppercase">
          TODAY
        </span>
      );
    }
    if (item.period === 'yesterday') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 uppercase">
          YESTERDAY
        </span>
      );
    }
    if (item.period === 'tomorrow') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 uppercase">
          TOMORROW
        </span>
      );
    }
    if (item.status === 'Scheduled' || item.period === 'next2days' || item.period === 'upcoming') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase">
          UPCOMING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
        DECLARED
      </span>
    );
  };

  const getDateStatusBadge = (item: ResultItem) => {
    const isEstimated = item.dateStatus === 'Estimated';
    return (
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {isEstimated ? (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            title={item.filingReference || 'Estimated earnings window — Reg. 29 board meeting notice awaited'}
          >
            <CalendarClock className="w-2.5 h-2.5" />
            ESTIMATED DATE
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            title={item.filingReference || 'Confirmed via NSE/BSE SEBI Reg. 29/33 Exchange Filing'}
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            {item.status === 'Declared' ? 'CONFIRMED • REG. 33' : 'CONFIRMED • REG. 29'}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20">
          {item.reportType || 'Consolidated'}
        </span>
        {item.isRevised && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
            title={item.revisionNote || `Schedule revised from ${item.previousDate}`}
          >
            <AlertCircle className="w-2.5 h-2.5" />
            REVISED {item.previousDate ? `(Was ${formatDisplayDate(item.previousDate)})` : ''}
          </span>
        )}
      </div>
    );
  };

  const getReactionBadge = (reaction: ResultItem['reaction'], status?: ResultItem['status']) => {
    switch (reaction) {
      case 'Beat':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <TrendingUp className="w-2.5 h-2.5" />
            BEAT ESTIMATES
          </span>
        );
      case 'Miss':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <TrendingDown className="w-2.5 h-2.5" />
            MISS
          </span>
        );
      case 'In line':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            IN LINE
          </span>
        );
      case 'Pending':
      default:
        if (status === 'Declared') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-2.5 h-2.5" />
              DECLARED • REG. 33
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
            <Clock className="w-2.5 h-2.5" />
            SCHEDULED
          </span>
        );
    }
  };

  const activeFinancialRows: QuarterlyFinancialRow[] = useMemo(() => {
    if (!fetchedFinancials) return [];
    return reportType === 'Consolidated' ? fetchedFinancials.consolidated : fetchedFinancials.standalone;
  }, [fetchedFinancials, reportType]);

  return (
    <div className="space-y-2.5">
      {/* Compact Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              {isFlashMode ? <Flame className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isFlashMode ? 'Results Flash Wire (Declared Filings)' : 'Corporate Earnings & Results Calendar'}
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Reg. 29 &amp; 33 Verified
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/30">
                <Table2 className="w-2.5 h-2.5" />
                5Q Financials
              </span>
              {lastUpdatedTime && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hidden lg:flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-purple-400" />
                  {lastUpdatedTime}
                </span>
              )}
            </div>
          </div>

          {/* Instrument Filter & Refresh Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => onInstrumentFilterChange('ALL')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  instrumentFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => onInstrumentFilterChange('FO')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  instrumentFilter === 'FO'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                F&amp;O
              </button>
              <button
                onClick={() => onInstrumentFilterChange('NON_FO')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  instrumentFilter === 'NON_FO'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Cash
              </button>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Periods & Filter Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {[
              { id: 'all', label: `All (${results.length})` },
              { id: 'yesterday', label: `Yesterday (${counts.yesterday})` },
              { id: 'today', label: `Today (${counts.today})` },
              { id: 'tomorrow', label: `Tomorrow (${counts.tomorrow})` },
              { id: 'upcoming', label: `Upcoming (${counts.upcoming})` },
              { id: 'declared', label: `Declared (${counts.declared})` },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setActivePeriod(p.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activePeriod === p.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search symbol or company..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 w-36 sm:w-44 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Confirmation Status Filter */}
            <select
              value={confirmationFilter}
              onChange={e => setConfirmationFilter(e.target.value as any)}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium cursor-pointer"
            >
              <option value="ALL">All Dates</option>
              <option value="Confirmed">Confirmed Only</option>
              <option value="Estimated">Estimated</option>
              <option value="Revised">Revised</option>
            </select>

            {/* Reaction Filter */}
            <select
              value={reactionFilter}
              onChange={e => setReactionFilter(e.target.value as any)}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium cursor-pointer"
            >
              <option value="ALL">All Outcomes</option>
              <option value="Declared">Declared Only</option>
              <option value="Pending">Scheduled Only</option>
              <option value="Beat">Beats Only</option>
              <option value="Miss">Misses Only</option>
              <option value="In line">In Line</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Flash Alert Stream */}
      {isFlashMode ? (
        <div className="space-y-3">
          {filteredResults.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500">
              No corporate filings match the selected filter criteria.
            </div>
          ) : (
            visibleResults.map(item => {
              const stock = stocks.find(s => s.symbol === item.symbol);
              const isFO = stock ? stock.isFO : item.isFO;
              return (
                <div
                  key={item.id || item.symbol}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-purple-300 dark:hover:border-purple-800/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                      {item.symbol.substring(0, 4)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onSelectStock(item.symbol)}
                          className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {item.symbol}
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                        <span className="text-xs text-slate-500 font-medium">({item.company})</span>
                        {isFO ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                            F&O
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                            CASH
                          </span>
                        )}
                        {item.quarter && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-semibold">
                            {item.quarter}
                          </span>
                        )}
                        {getPeriodLabelBadge(item)}
                        {getReactionBadge(item.reaction, item.status)}
                      </div>

                      {getDateStatusBadge(item)}

                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {item.notes || 'Quarterly financial performance disclosure'}
                      </p>

                      {item.revisionNote && (
                        <p className="text-[11px] font-mono text-rose-500 dark:text-rose-400">
                          • Schedule Revision: {item.revisionNote}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs font-mono">
                        {item.actualRevenue !== undefined ? (
                          <span className="text-slate-600 dark:text-slate-300">
                            Revenue: <strong className="text-slate-900 dark:text-slate-100">₹{item.actualRevenue.toLocaleString()} Cr</strong>
                            {item.yoyRevenueGrowth !== undefined && (
                              <span className={item.yoyRevenueGrowth >= 0 ? ' text-emerald-500 ml-1' : ' text-rose-500 ml-1'}>
                                ({item.yoyRevenueGrowth >= 0 ? '+' : ''}{item.yoyRevenueGrowth}% YoY)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Est. Revenue: <strong>₹{item.expectedRevenue?.toLocaleString() || '—'} Cr</strong>
                          </span>
                        )}

                        {item.actualNetProfit !== undefined ? (
                          <span className="text-slate-600 dark:text-slate-300">
                            Net Profit: <strong className="text-slate-900 dark:text-slate-100">₹{item.actualNetProfit.toLocaleString()} Cr</strong>
                            {item.yoyProfitGrowth !== undefined && (
                              <span className={item.yoyProfitGrowth >= 0 ? ' text-emerald-500 ml-1' : ' text-rose-500 ml-1'}>
                                ({item.yoyProfitGrowth >= 0 ? '+' : ''}{item.yoyProfitGrowth}% YoY)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Est. Profit: <strong>₹{item.expectedNetProfit?.toLocaleString() || '—'} Cr</strong>
                          </span>
                        )}

                        {item.actualEps !== undefined ? (
                          <span className="text-slate-600 dark:text-slate-300">
                            EPS: <strong className="text-slate-900 dark:text-slate-100">₹{item.actualEps.toFixed(2)}</strong>{' '}
                            <span className="text-slate-400">(Est ₹{item.expectedEps.toFixed(2)})</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Est. EPS: <strong>₹{item.expectedEps.toFixed(2)}</strong>
                          </span>
                        )}

                        {item.operatingProfit !== undefined && (
                          <span className="text-slate-600 dark:text-slate-300">
                            Op. Profit: <strong className="text-slate-900 dark:text-slate-100">₹{item.operatingProfit.toLocaleString()} Cr</strong>
                          </span>
                        )}

                        {item.opmPercent !== undefined && (
                          <span className="text-slate-600 dark:text-slate-300">
                            OPM: <strong className="text-indigo-500">{item.opmPercent}%</strong>
                          </span>
                        )}

                        {item.ebitda !== undefined && (
                          <span className="text-slate-600 dark:text-slate-300">
                            EBITDA: <strong className="text-slate-900 dark:text-slate-100">₹{item.ebitda.toLocaleString()} Cr</strong>
                          </span>
                        )}

                        {item.qoqProfitGrowth !== undefined && (
                          <span className="text-slate-600 dark:text-slate-300">
                            QoQ PAT:{' '}
                            <strong className={item.qoqProfitGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                              {item.qoqProfitGrowth >= 0 ? '+' : ''}{item.qoqProfitGrowth}%
                            </strong>
                          </span>
                        )}

                        {item.surprisePercent !== undefined && (
                          <span className={item.surprisePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                            Surprise: <strong>{item.surprisePercent >= 0 ? '+' : ''}{item.surprisePercent}%</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-mono text-slate-400">
                        <span>
                          {item.status === 'Declared'
                            ? `Filed: ${item.filingTimestamp || formatDisplayDate(item.resultDate)}`
                            : `Scheduled: ${formatDisplayDate(item.resultDate)} (${item.resultDate}) • ${item.expectedTime || 'TBA'}`}
                        </span>
                        {item.filingReference && <span>• Ref: {item.filingReference}</span>}
                        {item.source && <span>• Source: {item.source}</span>}
                        <a
                          href={item.filingLink || 'https://www.nseindia.com/companies-listing/corporate-filings-financial-results'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          NSE Reg. 33 Filing
                        </a>
                        {item.bseFilingLink && (
                          <a
                            href={item.bseFilingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            BSE Filing
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 shrink-0 border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-100 dark:border-slate-800 w-full md:w-auto">
                    {stock && (
                      <div className="text-left md:text-right mr-1">
                        <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                          ₹{stock.price.toFixed(2)}
                        </p>
                        <p
                          className={`text-xs font-mono font-semibold ${
                            stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {stock.change >= 0 ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={e => handleOpenScreenerModal(item, e)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Table2 className="w-3.5 h-3.5" />
                        5Q Financials
                      </button>
                      <button
                        onClick={() => onSelectStock(item.symbol)}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Analyze Stock
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Results Calendar View: Responsive Cards on Mobile/Tablet/Compact Laptop (<xl) + Fitted Sticky-Action Table on Desktop (>=xl) */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          {/* Mobile, Tablet & Compact Screen Card Grid (< 1280px) - Fits 100% of screen width with zero cutoff */}
          <div className="xl:hidden">
            {filteredResults.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No quarterly results found for this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-2.5 bg-slate-50/50 dark:bg-slate-950/40">
                {visibleResults.map(item => {
                  const stock = stocks.find(s => s.symbol === item.symbol);
                  const isFO = stock ? stock.isFO : item.isFO;
                  const isProfitUp = (item.yoyProfitGrowth || 0) >= 0;

                  return (
                    <div
                      key={`mob-${item.id || item.symbol}`}
                      onClick={() => handleOpenScreenerModal(item)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5 shadow-2xs hover:border-purple-500/40 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      {/* Top Row: Symbol, Badges & Live CMP */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1 font-mono">
                              <span>{item.symbol}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                            </span>
                            {isFO ? (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-semibold border border-indigo-500/20">
                                F&amp;O
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                                CASH
                              </span>
                            )}
                            {item.quarter && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
                                {item.quarter}
                              </span>
                            )}
                            {getPeriodLabelBadge(item)}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {item.company}
                          </p>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          {stock ? (
                            <>
                              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                ₹{stock.price.toFixed(2)}
                              </div>
                              <div
                                className={`text-[10px] font-semibold tabular-nums ${
                                  stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                }`}
                              >
                                {stock.change >= 0 ? '+' : ''}
                                {stock.changePercent.toFixed(2)}%
                              </div>
                            </>
                          ) : (
                            <span className="text-[10px] text-indigo-500 font-semibold">Quote →</span>
                          )}
                        </div>
                      </div>

                      {/* Middle Row: 2x2 / 4-Col Financial Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 font-mono text-[11px]">
                        <div>
                          <span className="text-[9px] uppercase text-slate-400 block">Result Date</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {formatDisplayDate(item.resultDate)}
                          </span>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block truncate">
                            {item.status === 'Declared' ? 'Reg. 33 Filed' : item.expectedTime || 'Scheduled'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] uppercase text-slate-400 block">Revenue</span>
                          {item.actualRevenue !== undefined ? (
                            <>
                              <span className="font-bold text-slate-800 dark:text-slate-200 block tabular-nums">
                                ₹{item.actualRevenue.toLocaleString()} Cr
                              </span>
                              {item.yoyRevenueGrowth !== undefined && (
                                <span
                                  className={`text-[9px] font-semibold block ${
                                    item.yoyRevenueGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                  }`}
                                >
                                  YoY {item.yoyRevenueGrowth >= 0 ? '+' : ''}
                                  {item.yoyRevenueGrowth}%
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400 block">
                              Est ₹{item.expectedRevenue?.toLocaleString() || '—'}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[9px] uppercase text-slate-400 block">Net Profit</span>
                          {item.actualNetProfit !== undefined ? (
                            <>
                              <span className="font-bold text-slate-800 dark:text-slate-200 block tabular-nums">
                                ₹{item.actualNetProfit.toLocaleString()} Cr
                              </span>
                              <span className="text-[9px] text-slate-400 block">
                                Est ₹{item.expectedNetProfit?.toLocaleString() || '—'}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 block">
                              Est ₹{item.expectedNetProfit?.toLocaleString() || '—'}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[9px] uppercase text-slate-400 block">YoY PAT / EPS</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.yoyProfitGrowth !== undefined ? (
                              <span
                                className={`font-bold tabular-nums ${
                                  isProfitUp ? 'text-emerald-500' : 'text-rose-500'
                                }`}
                              >
                                {isProfitUp ? '+' : ''}
                                {item.yoyProfitGrowth.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 block tabular-nums">
                            EPS: ₹
                            {item.actualEps !== undefined
                              ? item.actualEps.toFixed(2)
                              : item.expectedEps.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Reaction Badge & Always-Visible Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {getReactionBadge(item.reaction, item.status)}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={e => handleOpenScreenerModal(item, e)}
                            className="px-2.5 py-1 rounded-md bg-indigo-500/15 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-300 font-mono text-[10px] font-semibold border border-indigo-500/30 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Table2 className="w-3 h-3" />
                            5Q Table
                          </button>
                          <a
                            href={
                              item.filingLink ||
                              'https://www.nseindia.com/companies-listing/corporate-filings-financial-results'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white font-mono text-[10px] font-semibold border border-purple-500/30 transition-colors inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            Filing
                          </a>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onSelectStock(item.symbol);
                            }}
                            className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 text-slate-700 dark:text-slate-300 font-semibold text-[10px] transition-colors cursor-pointer"
                          >
                            Chart
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop Full Table (>= 1280px) with Sticky Left Symbol & Sticky Right Action Column */}
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase">
                  <th className="py-2.5 px-2.5 font-semibold sticky left-0 z-10 bg-slate-50 dark:bg-slate-800">
                    Company / Symbol
                  </th>
                  <th className="py-2.5 px-2 font-semibold text-right">Live CMP</th>
                  <th className="py-2.5 px-2 font-semibold">Result Date &amp; Filing</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Revenue (₹ Cr)</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Net Profit (₹ Cr)</th>
                  <th className="py-2.5 px-2 font-semibold text-right">YoY PAT %</th>
                  <th className="py-2.5 px-2 font-semibold text-right">EPS / Surprise</th>
                  <th className="py-2.5 px-2 font-semibold text-center">Status / Reaction</th>
                  <th className="py-2.5 px-2.5 font-semibold text-right sticky right-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-[-4px_0_8px_rgba(0,0,0,0.06)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      No quarterly results found for this filter.
                    </td>
                  </tr>
                ) : (
                  visibleResults.map(item => {
                    const stock = stocks.find(s => s.symbol === item.symbol);
                    const isFO = stock ? stock.isFO : item.isFO;
                    const isProfitUp = (item.yoyProfitGrowth || 0) >= 0;

                    return (
                      <tr
                        key={item.id || item.symbol}
                        onClick={() => handleOpenScreenerModal(item)}
                        className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-2.5 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/90">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-slate-100 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1">
                              <span>{item.symbol}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </span>
                            {isFO ? (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                                F&amp;O
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                                CASH
                              </span>
                            )}
                            {item.quarter && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 font-semibold">
                                {item.quarter}
                              </span>
                            )}
                            {getPeriodLabelBadge(item)}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-[190px] mt-0.5">{item.company}</p>
                        </td>

                        <td className="py-2.5 px-2 font-mono text-right whitespace-nowrap">
                          {stock ? (
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                ₹{stock.price.toFixed(2)}
                              </div>
                              <div
                                className={`text-[10px] font-semibold ${
                                  stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                }`}
                              >
                                {stock.change >= 0 ? '+' : ''}
                                {stock.changePercent.toFixed(2)}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-indigo-500 font-semibold">Open Quote →</span>
                          )}
                        </td>

                        <td className="py-2.5 px-2 font-mono text-slate-600 dark:text-slate-400">
                          <div className="font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {formatDisplayDate(item.resultDate)}{' '}
                            <span className="text-[10px] font-normal text-slate-400">({item.resultDate})</span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[165px]">
                            {item.status === 'Declared'
                              ? item.filingTimestamp || 'Filed with Exchange'
                              : item.expectedTime || 'Post-Market Hours'}
                          </div>
                          {getDateStatusBadge(item)}
                        </td>

                        <td className="py-2.5 px-2 font-mono text-right text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {item.actualRevenue !== undefined ? (
                            <>
                              <div className="font-semibold">₹{item.actualRevenue.toLocaleString()} Cr</div>
                              {item.yoyRevenueGrowth !== undefined && (
                                <div
                                  className={`text-[10px] ${
                                    item.yoyRevenueGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                  }`}
                                >
                                  YoY: {item.yoyRevenueGrowth >= 0 ? '+' : ''}{item.yoyRevenueGrowth}%
                                </div>
                              )}
                            </>
                          ) : (
                            <div>
                              <span className="text-slate-400">Est. ₹{item.expectedRevenue?.toLocaleString() || '—'}</span>
                              {item.prevQtrRevenue && (
                                <div className="text-[10px] text-slate-400">
                                  Prev: ₹{item.prevQtrRevenue.toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-2 font-mono text-right font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {item.actualNetProfit !== undefined ? (
                            <div>
                              <div>₹{item.actualNetProfit.toLocaleString()} Cr</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                Est: ₹{item.expectedNetProfit?.toLocaleString() || '—'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="text-slate-400">Est. ₹{item.expectedNetProfit?.toLocaleString() || '—'}</span>
                              {item.prevQtrNetProfit && (
                                <div className="text-[10px] text-slate-400 font-normal">
                                  Prev: ₹{item.prevQtrNetProfit.toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-2 font-mono text-right whitespace-nowrap">
                          {item.yoyProfitGrowth !== undefined ? (
                            <span
                              className={`font-bold ${
                                isProfitUp ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {isProfitUp ? '+' : ''}
                              {item.yoyProfitGrowth.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-2 font-mono text-right whitespace-nowrap">
                          {item.actualEps !== undefined ? (
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                ₹{item.actualEps.toFixed(2)}
                              </span>
                              {item.surprisePercent !== undefined && (
                                <div
                                  className={`text-[10px] font-bold ${
                                    item.surprisePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                  }`}
                                >
                                  {item.surprisePercent >= 0 ? '+' : ''}{item.surprisePercent}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Est. ₹{item.expectedEps.toFixed(2)}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          {getReactionBadge(item.reaction, item.status)}
                        </td>

                        <td className="py-2.5 px-2.5 text-right whitespace-nowrap sticky right-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/90 shadow-[-4px_0_8px_rgba(0,0,0,0.06)]">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={e => handleOpenScreenerModal(item, e)}
                              className="px-2 py-1 rounded bg-indigo-500/15 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-300 font-mono text-[10px] font-semibold border border-indigo-500/30 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Open 5-Quarter Screener.in-Style Financial Statement"
                            >
                              <Table2 className="w-2.5 h-2.5" />
                              5Q Table
                            </button>
                            <a
                              href={item.filingLink || 'https://www.nseindia.com/companies-listing/corporate-filings-financial-results'}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="px-2 py-1 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white font-mono text-[10px] font-semibold border border-purple-500/30 transition-colors inline-flex items-center gap-1"
                              title="Open official NSE Reg. 33 filing"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Filing
                            </a>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onSelectStock(item.symbol);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 text-slate-700 dark:text-slate-300 font-semibold text-[10px] transition-colors cursor-pointer"
                            >
                              Chart
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Load More / Show All Footer when filteredResults > visibleCount */}
      {filteredResults.length > visibleCount && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-900 dark:text-slate-100">{visibleResults.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-slate-100">{filteredResults.length}</strong> NSE/BSE corporate results
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVisibleCount(prev => prev + 250)}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Show Next 250 Stocks
            </button>
            <button
              onClick={() => setVisibleCount(filteredResults.length)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              Show All ({filteredResults.length})
            </button>
          </div>
        </div>
      )}

      {/* Screener.in-Style 5-Quarter Financial Comparison Modal */}
      {selectedFinancialItem && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
          onClick={() => setSelectedFinancialItem(null)}
        >
          <div
            className="bg-white dark:bg-[#0E1424] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0B0F17]/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-500 border border-indigo-500/30 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      {selectedFinancialItem.company} ({selectedFinancialItem.symbol})
                    </h2>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                      {selectedFinancialItem.status === 'Declared' ? 'REG. 33 DECLARED' : 'REG. 29 SCHEDULED'}
                    </span>
                    {getReactionBadge(selectedFinancialItem.reaction)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    Quarterly Results Comparison (Figures in ₹ Crores except EPS &amp; Margins)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                {/* Consolidated vs Standalone Toggle */}
                <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700">
                  <button
                    onClick={() => setReportType('Consolidated')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reportType === 'Consolidated'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    Consolidated
                  </button>
                  <button
                    onClick={() => setReportType('Standalone')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      reportType === 'Standalone'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    Standalone
                  </button>
                </div>

                <button
                  onClick={() => setSelectedFinancialItem(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 5-Quarter Financial Table Body */}
            <div className="p-2.5 sm:p-4 overflow-x-auto overflow-y-auto flex-1 min-h-0">
              {isLoadingFinancials ? (
                <div className="py-12 text-center text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Loading 5-Quarter {reportType} Financial Statements from Exchange Filings...</span>
                </div>
              ) : activeFinancialRows.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  No 5-quarter financial history available for {selectedFinancialItem.symbol}.
                </div>
              ) : (
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-2.5 text-left font-bold uppercase tracking-wider min-w-[135px] sm:min-w-[175px] sticky left-0 z-10 bg-slate-50 dark:bg-slate-900">
                        Particulars ({reportType})
                      </th>
                      {activeFinancialRows.map(q => (
                        <th key={q.quarter} className="py-2 px-2.5 text-right font-bold text-slate-800 dark:text-slate-200">
                          <div>{q.quarter}</div>
                          <div className="text-[10px] font-normal text-slate-400">{q.periodEnded}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    <tr className="bg-indigo-50/30 dark:bg-indigo-950/15 font-bold text-slate-900 dark:text-slate-100">
                      <td className="py-2 px-2.5 sticky left-0 z-10 bg-white dark:bg-[#0E1424]">Sales / Revenue (₹ Cr)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-2.5 text-right tabular-nums">
                          ₹{q.revenue.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-600 dark:text-slate-400">
                      <td className="py-2 px-3">Total Expenses (₹ Cr)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-3 text-right tabular-nums">
                          ₹{q.expenses.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="font-bold text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-900/40">
                      <td className="py-2.5 px-3">Operating Profit (₹ Cr)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2.5 px-3 text-right tabular-nums">
                          ₹{q.operatingProfit.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-indigo-600 dark:text-indigo-400 font-semibold">
                      <td className="py-2 px-3">OPM %</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-3 text-right tabular-nums">
                          {q.opmPercent.toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-600 dark:text-slate-400">
                      <td className="py-2 px-3">EBITDA (₹ Cr)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                          ₹{q.ebitda.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-600 dark:text-slate-400">
                      <td className="py-2 px-3">Other Income (₹ Cr)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-3 text-right tabular-nums">
                          ₹{q.otherIncome.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-600 dark:text-slate-400">
                      <td className="py-2 px-3">Interest / Finance Cost (₹ Cr)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-3 text-right tabular-nums">
                          ₹{q.interest.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-600 dark:text-slate-400">
                      <td className="py-2 px-3">Depreciation (₹ Cr)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-3 text-right tabular-nums">
                          ₹{q.depreciation.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-50/60 dark:bg-slate-900/40">
                      <td className="py-2 px-3">Profit Before Tax (PBT) (₹ Cr)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-3 text-right tabular-nums">
                          ₹{q.profitBeforeTax.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-500 dark:text-slate-400">
                      <td className="py-2 px-3">Tax %</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-3 text-right tabular-nums">
                          {q.taxPercent.toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-emerald-50/40 dark:bg-emerald-950/20 font-bold text-slate-900 dark:text-slate-100 text-sm">
                      <td className="py-2.5 px-3">Net Profit (PAT) (₹ Cr)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2.5 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          ₹{q.netProfit.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="font-bold text-slate-800 dark:text-slate-200">
                      <td className="py-2 px-3">EPS in Rs (₹)</td>
                      {activeFinancialRows.map(q => (
                        <td key={q.quarter} className="py-2 px-3 text-right tabular-nums">
                          ₹{q.eps.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-600 dark:text-slate-400">
                      <td className="py-2 px-3">YoY Sales Growth %</td>
                      {activeFinancialRows.map(q => (
                        <td
                          key={q.quarter}
                          className={`py-2 px-3 text-right tabular-nums font-semibold ${
                            (q.yoyRevenueGrowth ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {q.yoyRevenueGrowth !== undefined ? `${q.yoyRevenueGrowth >= 0 ? '+' : ''}${q.yoyRevenueGrowth}%` : '—'}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-600 dark:text-slate-400">
                      <td className="py-2 px-3">YoY Net Profit Growth %</td>
                      {activeFinancialRows.map(q => (
                        <td
                          key={q.quarter}
                          className={`py-2 px-3 text-right tabular-nums font-semibold ${
                            (q.yoyPatGrowth ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {q.yoyPatGrowth !== undefined ? `${q.yoyPatGrowth >= 0 ? '+' : ''}${q.yoyPatGrowth}%` : '—'}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-600 dark:text-slate-400">
                      <td className="py-2 px-3">QoQ Net Profit Growth %</td>
                      {activeFinancialRows.map(q => (
                        <td
                          key={q.quarter}
                          className={`py-2 px-3 text-right tabular-nums font-semibold ${
                            (q.qoqPatGrowth ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {q.qoqPatGrowth !== undefined ? `${q.qoqPatGrowth >= 0 ? '+' : ''}${q.qoqPatGrowth}%` : '—'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer with Official Exchange Links */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0B0F17]/90 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={
                    fetchedFinancials?.nseFilingLink ||
                    selectedFinancialItem.filingLink ||
                    `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(selectedFinancialItem.symbol)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-600 hover:text-white font-semibold transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  NSE Reg. 33 Filing PDF
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={
                    fetchedFinancials?.bseFilingLink ||
                    selectedFinancialItem.bseFilingLink ||
                    'https://www.bseindia.com/corporates/Comp_Resultsnew.aspx'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-600 hover:text-white font-semibold transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  BSE Corporate Filing
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={
                    fetchedFinancials?.xbrlFilingLink ||
                    selectedFinancialItem.xbrlFilingLink ||
                    `https://www.nseindia.com/companies-listing/corporate-filings-financial-results`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white font-semibold transition-colors"
                >
                  <Table2 className="w-3.5 h-3.5" />
                  NSE XBRL Statement
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const sym = selectedFinancialItem.symbol;
                    setSelectedFinancialItem(null);
                    onSelectStock(sym);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors cursor-pointer"
                >
                  Open Technical Chart →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


