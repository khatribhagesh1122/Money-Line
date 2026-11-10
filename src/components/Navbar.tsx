import React, { useState, useEffect, useRef } from 'react';
import {
  MarketStatus,
  GlobalInstrumentFilter,
  NavigationTab,
  NotificationItem,
  NotificationCategory,
  SearchInstrumentItem,
  Stock,
  MarketIndex,
} from '../types/market';
import {
  Search,
  Sun,
  Moon,
  TrendingUp,
  Menu,
  X,
  Loader2,
  Radio,
} from 'lucide-react';

interface NavbarProps {
  status: MarketStatus;
  istTimeStr: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchSuggestions: Array<{
    symbol: string;
    name: string;
    type: 'STOCK' | 'INDEX';
    price: number;
    changePercent: number;
    isFO?: boolean;
  }>;
  onSelectSuggestion: (symbol: string, type: 'STOCK' | 'INDEX', fullStockData?: Stock) => void;
  instrumentFilter: GlobalInstrumentFilter;
  onInstrumentFilterChange: (filter: GlobalInstrumentFilter) => void;
  onToggleMobileMenu: () => void;
  activeNav: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  stocks?: Stock[];
  indices?: MarketIndex[];
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  istTimeStr,
  soundEnabled,
  onToggleSound,
  darkMode,
  onToggleDark,
  searchQuery,
  onSearchChange,
  searchSuggestions,
  onSelectSuggestion,
  instrumentFilter,
  onInstrumentFilterChange,
  onToggleMobileMenu,
  activeNav,
  onNavigate,
  notifications,
  unreadNotificationCount,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<NotificationCategory>('all');
  const [liveResults, setLiveResults] = useState<SearchInstrumentItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut: '/' or 'Ctrl+K' focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      } else if (e.key === 'Escape') {
        setSearchFocused(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced live instrument search against full NSE/BSE master + live quote enricher
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setLiveResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/upstox/search?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        const items: SearchInstrumentItem[] = Array.isArray(data?.results) ? data.results : [];
        if (!cancelled) {
          setLiveResults(items);
          setIsSearching(false);
        }
      } catch {
        if (!cancelled) {
          setLiveResults([]);
          setIsSearching(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const filteredNotifications = notifications.filter(
    n => notifFilter === 'all' || n.category === notifFilter
  );

  const handleSelectLiveInstrument = (item: SearchInstrumentItem) => {
    const price = item.price || 100;
    const prevClose = item.prevClose || price;
    const synthesizedStock: Stock = {
      symbol: item.symbol,
      name: item.name,
      sector: item.sector || (item.isFO ? 'NSE F&O' : 'NSE Equity'),
      isFO: item.isFO,
      instrumentKey: item.instrumentKey,
      segment: item.segment,
      lotSize: item.lotSize,
      price,
      change: item.change || 0,
      changePercent: item.changePercent || 0,
      open: price,
      high: price * 1.012,
      low: price * 0.988,
      prevClose,
      volume: 250000,
      avgVolume20D: 200000,
      dma20: prevClose * 0.99,
      dma50: prevClose * 0.97,
      dma100: prevClose * 0.95,
      dma200: prevClose * 0.92,
      rsi14: 54,
      macd: 1.2,
      macdSignal: 0.9,
      macdHist: 0.3,
      atr14: price * 0.018,
      weekChange: (item.changePercent || 0) * 1.8,
      monthChange: (item.changePercent || 0) * 3.2,
      high52W: price * 1.25,
      low52W: price * 0.75,
      pdh: prevClose * 1.015,
      pdl: prevClose * 0.985,
      pwh: prevClose * 1.035,
      pwl: prevClose * 0.965,
      pmh: prevClose * 1.07,
      pml: prevClose * 0.93,
      prevDayOpen: prevClose * 0.995,
      lastWeekOpen: prevClose * 0.98,
      lastMonthOpen: prevClose * 0.95,
      currentHourlyOpen: price * 0.998,
      itCandles: [
        { open: prevClose, high: prevClose * 1.005, low: prevClose * 0.996, close: price },
        { open: price, high: price * 1.004, low: price * 0.997, close: price },
        { open: price, high: price * 1.003, low: price * 0.998, close: price },
      ],
      current15m: { open: price * 0.999, high: price * 1.002, low: price * 0.998, close: price },
      last3Completed15m: [
        { open: prevClose, high: prevClose * 1.004, low: prevClose * 0.997, close: price },
        { open: price, high: price * 1.004, low: price * 0.997, close: price },
        { open: price, high: price * 1.003, low: price * 0.998, close: price },
      ],
      isNR7: false,
      cpr: {
        p: prevClose,
        tc: prevClose * 1.001,
        bc: prevClose * 0.999,
        widthPercent: 0.2,
        r1: prevClose * 1.01,
        r2: prevClose * 1.02,
        s1: prevClose * 0.99,
        s2: prevClose * 0.98,
      },
      sparks: [prevClose, prevClose * 1.002, price],
    };

    const itemType = item.segment === 'INDICES' ? 'INDEX' : 'STOCK';
    onSelectSuggestion(item.symbol, itemType, synthesizedStock);
    setSearchFocused(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#080D16]/95 backdrop-blur-xl text-slate-100">
      <div className="max-w-[1920px] mx-auto px-2.5 sm:px-5 h-13 sm:h-14 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Mobile Menu & Brand Identity (Logo only on mobile, Logo + Name on laptop/desktop) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-400 hover:bg-[#121C2D] hover:text-white transition-colors cursor-pointer shrink-0"
            title="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#477DFF] via-[#21C8E8] to-[#00D6A0] p-[1px] shadow-[0_0_24px_rgba(71,125,255,0.3)] group-hover:shadow-[0_0_28px_rgba(33,200,232,0.45)] transition-all shrink-0">
              <div className="w-full h-full bg-[#080D16] rounded-[11px] flex items-center justify-center">
                <TrendingUp className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#21C8E8]" />
              </div>
            </div>
            <div className="hidden md:block">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  MONEYLINE
                </span>
                <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-gradient-to-r from-[#477DFF] to-[#21C8E8] text-white tracking-wider">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-[#8B9BB4] leading-none mt-0.5 font-medium tracking-wide">
                MARKET INTELLIGENCE
              </p>
            </div>
          </div>
        </div>

        {/* Center: Global Command Search */}
        <div className="flex items-center gap-2 flex-1 max-w-2xl mx-0.5 sm:mx-2 min-w-0">
          {/* Global Search Input with Command Palette Autocomplete */}
          <div ref={searchRef} className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8B9BB4] absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={e => {
                onSearchChange(e.target.value);
                setSearchFocused(true);
              }}
              placeholder="Search NSE / BSE ticker, F&O, index..."
              className="w-full pl-8 sm:pl-10 pr-7 sm:pr-14 py-1.5 sm:py-2 text-xs rounded-xl border border-white/[0.08] bg-[#0D1422] hover:bg-[#121C2D] focus:bg-[#121C2D] text-slate-100 placeholder-[#8B9BB4] focus:outline-none focus:border-[#477DFF] focus:ring-2 focus:ring-[#477DFF]/20 transition-all"
            />
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 text-[#477DFF] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            ) : searchQuery ? (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B9BB4] hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[#8B9BB4] bg-[#121C2D] border border-white/10 rounded">
                  /
                </kbd>
              </div>
            )}

            {/* Autocomplete Dropdown */}
            {searchFocused &&
              (liveResults.length > 0 || searchSuggestions.length > 0 || isSearching) && (
                <div className="fixed inset-x-2.5 top-16 sm:absolute sm:inset-x-0 sm:top-full sm:mt-2 bg-[#0D1422] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.75)] overflow-hidden z-50 max-h-[70dvh] sm:max-h-96 overflow-y-auto">
                  <div className="px-3.5 py-2 text-[10px] font-mono uppercase tracking-wider text-[#8B9BB4] bg-[#080D16]/90 border-b border-white/[0.06] flex items-center justify-between">
                    <span>NSE / BSE MASTER &amp; INDICES</span>
                    <span>{liveResults.length || searchSuggestions.length} MATCHES</span>
                  </div>

                  {liveResults.length > 0 ? (
                    liveResults.map(item => {
                      const isPositive = (item.changePercent || 0) >= 0;
                      return (
                        <button
                          key={`${item.instrumentKey}_${item.symbol}`}
                          onClick={() => handleSelectLiveInstrument(item)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-[#1A2639] flex items-center justify-between gap-2 transition-colors border-b border-white/[0.04] last:border-none cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-white font-mono">
                                {item.symbol}
                              </span>
                              {item.exchange && (
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                    item.exchange === 'BSE'
                                      ? 'bg-[#E9B949]/15 text-[#E9B949] border border-[#E9B949]/30'
                                      : 'bg-[#21C8E8]/15 text-[#21C8E8] border border-[#21C8E8]/30'
                                  }`}
                                >
                                  {item.exchange}
                                </span>
                              )}
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                                  item.segment === 'INDICES'
                                    ? 'bg-[#9875FF]/15 text-[#9875FF]'
                                    : item.isFO
                                    ? 'bg-[#477DFF]/15 text-[#477DFF]'
                                    : 'bg-white/5 text-[#8B9BB4]'
                                }`}
                              >
                                {item.segment === 'INDICES'
                                  ? 'INDEX'
                                  : item.isFO
                                  ? 'F&O'
                                  : 'CASH'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#8B9BB4] truncate mt-0.5">{item.name}</p>
                          </div>
                          <div className="text-right font-mono shrink-0 tabular-nums">
                            {item.price && item.price > 0 ? (
                              <>
                                <div className="text-xs font-bold text-white">
                                  ₹
                                  {item.price.toLocaleString('en-IN', {
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                                <div
                                  className={`text-[10px] font-semibold ${
                                    isPositive ? 'text-[#00C995]' : 'text-[#FF526B]'
                                  }`}
                                >
                                  {isPositive ? '+' : ''}
                                  {(item.changePercent || 0).toFixed(2)}%
                                </div>
                              </>
                            ) : (
                              <span className="text-[10px] text-[#477DFF] font-semibold">
                                Open Quote →
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    searchSuggestions.map(item => (
                      <button
                        key={`${item.type}_${item.symbol}`}
                        onClick={() => {
                          onSelectSuggestion(item.symbol, item.type);
                          setSearchFocused(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-[#1A2639] flex items-center justify-between gap-2 transition-colors border-b border-white/[0.04] last:border-none cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white font-mono">
                              {item.symbol}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                                item.type === 'INDEX'
                                  ? 'bg-[#9875FF]/15 text-[#9875FF]'
                                  : item.isFO
                                  ? 'bg-[#477DFF]/15 text-[#477DFF]'
                                  : 'bg-white/5 text-[#8B9BB4]'
                              }`}
                            >
                              {item.type === 'INDEX' ? 'INDEX' : item.isFO ? 'F&O' : 'CASH'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8B9BB4] truncate mt-0.5">{item.name}</p>
                        </div>
                        <div className="text-right font-mono shrink-0 tabular-nums">
                          <div className="text-xs font-bold text-white">
                            {item.type === 'STOCK' ? '₹' : ''}
                            {item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                          <div
                            className={`text-[10px] font-semibold ${
                              item.changePercent >= 0 ? 'text-[#00C995]' : 'text-[#FF526B]'
                            }`}
                          >
                            {item.changePercent >= 0 ? '+' : ''}
                            {item.changePercent.toFixed(2)}%
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Right: IST Clock & Theme */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Live Feed Indicator & Clock */}
          <div className="hidden xl:flex items-center gap-2 text-xs font-mono bg-[#0D1422] px-3 py-1.5 rounded-xl border border-white/[0.07] text-slate-200 tabular-nums">
            <Radio className="w-3.5 h-3.5 text-[#00C995]" />
            <span className="font-semibold">{istTimeStr}</span>
          </div>

          {/* Theme Mode Toggle */}
          <button
            onClick={onToggleDark}
            title={darkMode ? 'Switch Theme' : 'Switch to Dark Terminal'}
            className="p-1.5 sm:p-2 rounded-xl border border-white/[0.07] bg-[#0D1422] text-[#8B9BB4] hover:text-white hover:bg-[#121C2D] transition-all cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4 text-[#E9B949]" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
