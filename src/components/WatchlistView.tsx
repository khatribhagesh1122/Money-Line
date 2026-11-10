import React, { useState } from 'react';
import { Stock, GlobalInstrumentFilter } from '../types/market';
import { Sparkline } from './Sparkline';
import {
  Star,
  Search,
  TrendingUp,
  TrendingDown,
  Trash2,
  ExternalLink,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react';

interface WatchlistViewProps {
  watchlistSymbols: Set<string>;
  allStocks: Stock[];
  onToggleWatchlist: (symbol: string) => void;
  onSelectStock: (symbol: string) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  watchlistSymbols,
  allStocks,
  onToggleWatchlist,
  onSelectStock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [sortField, setSortField] = useState<'change' | 'price' | 'symbol' | 'volume'>('change');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter watchlist stocks
  const watchlistStocks = allStocks.filter(s => watchlistSymbols.has(s.symbol));

  const filteredWatchlist = watchlistStocks.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q);
  });

  // Sort
  const sortedWatchlist = [...filteredWatchlist].sort((a, b) => {
    let diff = 0;
    if (sortField === 'change') diff = a.changePercent - b.changePercent;
    else if (sortField === 'price') diff = a.price - b.price;
    else if (sortField === 'symbol') diff = a.symbol.localeCompare(b.symbol);
    else if (sortField === 'volume') diff = a.volume - b.volume;
    return sortOrder === 'desc' ? -diff : diff;
  });

  // Calculate stats
  const totalCount = watchlistStocks.length;
  const advancingCount = watchlistStocks.filter(s => s.change >= 0).length;
  const decliningCount = totalCount - advancingCount;
  const avgChange = totalCount > 0 ? watchlistStocks.reduce((acc, s) => acc + s.changePercent, 0) / totalCount : 0;

  // Un-added stocks for add dropdown
  const unaddedStocks = allStocks
    .filter(s => !watchlistSymbols.has(s.symbol))
    .filter(s => {
      if (!addSearchQuery.trim()) return true;
      const q = addSearchQuery.toLowerCase();
      return s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    })
    .slice(0, 8);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-2.5 pb-8">
      {/* Compact Top Banner & Toolbar */}
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-3 sm:p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E9B949]/15 border border-[#E9B949]/30 text-[#E9B949] flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 fill-[#E9B949]" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-extrabold text-white">
                Custom Watchlist
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#E9B949]/15 text-[#E9B949] font-semibold border border-[#E9B949]/30">
                {totalCount} Instruments
              </span>
              <span className="text-xs font-mono hidden sm:inline">
                <span className="font-bold text-[#00C995]">{advancingCount} Up</span>
                <span className="text-[#8B9BB4] mx-1">/</span>
                <span className="font-bold text-[#FF526B]">{decliningCount} Down</span>
                <span className="text-[#8B9BB4] mx-1.5">•</span>
                <span className={`font-bold ${avgChange >= 0 ? 'text-[#00C995]' : 'text-[#FF526B]'}`}>
                  Avg {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                </span>
              </span>
            </div>
          </div>

          {/* Search & Add Stock */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B9BB4]" />
              <input
                type="text"
                placeholder="Search watchlist..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs rounded-lg border border-white/10 bg-[#121C2D] text-white placeholder:text-[#8B9BB4] w-full focus:outline-none focus:border-[#477DFF]"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="px-3 py-1 rounded-lg bg-[#477DFF] hover:bg-[#3B66D6] text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stock</span>
              </button>

            {/* Quick Add Popover */}
            {showAddMenu && (
              <div
                className="fixed inset-x-3 top-28 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 bg-[#0D1422] border border-white/10 rounded-2xl shadow-2xl p-3.5 z-40 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Quick Add Stock</span>
                  <button
                    onClick={() => setShowAddMenu(false)}
                    className="text-[#8B9BB4] hover:text-white text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Type symbol or name..."
                  value={addSearchQuery}
                  onChange={e => setAddSearchQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-white/10 bg-[#121C2D] text-white placeholder:text-[#8B9BB4] focus:outline-none"
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {unaddedStocks.map(stock => (
                    <div
                      key={stock.symbol}
                      onClick={() => {
                        onToggleWatchlist(stock.symbol);
                        setAddSearchQuery('');
                      }}
                      className="p-2 rounded-xl hover:bg-[#1A2639] flex items-center justify-between cursor-pointer text-xs transition-colors"
                    >
                      <div>
                        <span className="font-bold text-white font-mono">{stock.symbol}</span>
                        <span className="text-[10px] text-[#8B9BB4] ml-1.5">{stock.sector}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-300">₹{stock.price.toFixed(2)}</span>
                        <Plus className="w-3.5 h-3.5 text-[#E9B949]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Watchlist Table */}
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#080D16] border-b border-white/[0.07] text-[#8B9BB4] font-mono text-[11px] uppercase">
                <th className="p-3 font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none" onClick={() => toggleSort('symbol')}>
                  <div className="flex items-center gap-1">
                    <span>Instrument</span>
                    {sortField === 'symbol' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-3 font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none" onClick={() => toggleSort('price')}>
                  <div className="flex items-center gap-1">
                    <span>CMP (₹)</span>
                    {sortField === 'price' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-3 font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none" onClick={() => toggleSort('change')}>
                  <div className="flex items-center gap-1">
                    <span>Change %</span>
                    {sortField === 'change' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-2.5 sm:p-3 font-semibold hidden md:table-cell">Day Range (L - H)</th>
                <th className="p-2.5 sm:p-3 font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none hidden lg:table-cell" onClick={() => toggleSort('volume')}>
                  <div className="flex items-center gap-1">
                    <span>Volume</span>
                    {sortField === 'volume' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="p-2.5 sm:p-3 font-semibold hidden sm:table-cell">Trend &amp; Sparkline</th>
                <th className="p-2.5 sm:p-3 font-semibold text-right sticky right-0 z-10 bg-[#080D16]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {sortedWatchlist.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-[#8B9BB4] space-y-2">
                    <Star className="w-8 h-8 text-[#8B9BB4]/40 mx-auto" />
                    <p className="font-semibold text-white">Your Watchlist is empty.</p>
                    <p className="text-xs text-[#8B9BB4]">
                      Click the star icon next to any stock across the dashboard or screeners to track it here.
                    </p>
                  </td>
                </tr>
              ) : (
                sortedWatchlist.map(stock => {
                  const isUp = stock.change >= 0;
                  const dayRangePercent = stock.high !== stock.low ? ((stock.price - stock.low) / (stock.high - stock.low)) * 100 : 50;

                  return (
                    <tr
                      key={stock.symbol}
                      className="group hover:bg-[#1A2639] transition-colors"
                    >
                      <td className="p-2.5 sm:p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onToggleWatchlist(stock.symbol)}
                            className="text-[#E9B949] hover:text-amber-400 transition-colors cursor-pointer shrink-0"
                            title="Remove from watchlist"
                          >
                            <Star className="w-4 h-4 fill-[#E9B949]" />
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => onSelectStock(stock.symbol)}
                                className="font-bold text-white hover:text-[#477DFF] transition-colors flex items-center gap-1 cursor-pointer font-mono"
                              >
                                <span>{stock.symbol}</span>
                                <ExternalLink className="w-3 h-3 text-[#8B9BB4]" />
                              </button>
                              {stock.isFO ? (
                                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#477DFF]/15 text-[#477DFF] border border-[#477DFF]/30">
                                  F&amp;O{stock.lotSize ? ` (Lot ${stock.lotSize})` : ''}
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#121C2D] text-[#8B9BB4]">
                                  NON-F&amp;O
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-[#8B9BB4] truncate max-w-[140px] sm:max-w-[200px]">
                              <span className="truncate" title={stock.name}>{stock.name}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="hidden sm:inline">{stock.sector}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-2.5 sm:p-3 font-mono tabular-nums whitespace-nowrap">
                        <div className="font-bold text-white">
                          ₹{stock.price.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#8B9BB4] font-normal">
                          Prev: ₹{stock.prevClose.toFixed(2)}
                        </div>
                      </td>

                      <td className="p-2.5 sm:p-3 font-mono tabular-nums whitespace-nowrap">
                        <div
                          className={`inline-flex items-center gap-1 font-bold ${
                            isUp ? 'text-[#00C995]' : 'text-[#FF526B]'
                          }`}
                        >
                          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>
                            {isUp ? '+' : ''}
                            {stock.changePercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="text-[10px] text-[#8B9BB4]">
                          {isUp ? '+' : ''}₹{stock.change.toFixed(2)}
                        </div>
                      </td>

                      <td className="p-2.5 sm:p-3 hidden md:table-cell">
                        <div className="w-28 sm:w-36 space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-[#8B9BB4] tabular-nums">
                            <span>₹{stock.low.toFixed(1)}</span>
                            <span>₹{stock.high.toFixed(1)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#121C2D] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isUp ? 'bg-[#00C995]' : 'bg-[#FF526B]'}`}
                              style={{ width: `${Math.min(Math.max(dayRangePercent, 5), 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="p-2.5 sm:p-3 font-mono text-slate-300 tabular-nums hidden lg:table-cell whitespace-nowrap">
                        <div>{(stock.volume / 100000).toFixed(2)} Lakhs</div>
                        <div className="text-[10px] text-[#8B9BB4]">
                          {(stock.volume / (stock.avgVolume20D || 1)).toFixed(1)}x 20DMA
                        </div>
                      </td>

                      <td className="p-2.5 sm:p-3 hidden sm:table-cell">
                        <div className="w-24 h-6">
                          <Sparkline
                            data={stock.sparks && stock.sparks.length > 0 ? stock.sparks : [stock.prevClose, stock.price]}
                            positive={isUp}
                            width={96}
                            height={24}
                          />
                        </div>
                      </td>

                      <td className="p-2.5 sm:p-3 text-right whitespace-nowrap sticky right-0 z-10 bg-[#0D1422] group-hover:bg-[#1A2639]">
                        <button
                          onClick={() => onSelectStock(stock.symbol)}
                          className="px-2 py-1 rounded-lg bg-[#121C2D] hover:bg-[#477DFF] hover:text-white text-white font-semibold text-[11px] transition-colors cursor-pointer mr-1.5"
                        >
                          Chart
                        </button>
                        <button
                          onClick={() => onToggleWatchlist(stock.symbol)}
                          className="p-1 rounded-lg text-[#8B9BB4] hover:text-[#FF526B] hover:bg-[#FF526B]/10 transition-colors cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
