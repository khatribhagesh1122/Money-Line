import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Stock,
  MarketIndex,
  IntradayPick,
  FlashAlert,
  NewsArticle,
  DataSourceMode,
  ResultItem,
  NavigationTab,
  GlobalInstrumentFilter,
  GlobalMarketItem,
  NotificationItem,
  TickSpeed,
  SearchInstrumentItem,
  MarketHealthTelemetry,
} from './types/market';
import {
  INITIAL_STOCKS,
  INITIAL_INDICES,
  INITIAL_RESULTS,
  INITIAL_GLOBAL_ITEMS,
} from './data/stocks';
import {
  getISTDate,
  getMarketPhase,
  calculateMarketMood,
  calculatePreMarketGuide,
  calculateRightNow,
  generateIntradayPick,
  evaluatePickStatus,
  evaluateTrendScore,
  evaluateIntradayScreener,
} from './services/marketCalculators';
import { soundService } from './services/soundService';
import { marketDataService, normalizeStockSymbol, ScreenerPresetsState } from './services/marketDataService';

import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { ScreenersView } from './components/ScreenersView';
import { MarketMoversView } from './components/MarketMoversView';
import { ResultsDashboardView } from './components/ResultsDashboardView';
import { FlashNewsView } from './components/FlashNewsView';
import { WatchlistView } from './components/WatchlistView';
import { SettingsView } from './components/SettingsView';
import { StockModal } from './components/StockModal';
import { UpstoxModal } from './components/UpstoxModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { IntelligenceModulesView } from './components/IntelligenceModulesView';
import { SectorRotationItem } from './types/market';

export default function App() {
  // Navigation: 13 sections
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Global Instrument Filter: ALL | FO | NON_FO
  const [instrumentFilter, setInstrumentFilter] = useState<GlobalInstrumentFilter>('ALL');

  // Theme: Dark by default, remembered in localStorage
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('intraday_pro_theme');
      return (saved as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  // Data Mode: Upstox Only
  const [dataSource, setDataSource] = useState<DataSourceMode>('upstox');

  // Continuous Live Streaming Mode (1s-2s live tick cadence for running market)
  const [isStreamingLive, setIsStreamingLive] = useState<boolean>(true);
  const [tickSpeed, setTickSpeed] = useState<TickSpeed>('1s');

  // Audio & Voice Alerts disabled
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [voiceLang, setVoiceLang] = useState<'en' | 'hi'>('en');

  // Watchlist (persistent via localStorage, auto-migrating legacy symbols TATAMOTORS -> TMPV and ZOMATO -> ETERNAL)
  const [watchlistSymbols, setWatchlistSymbols] = useState<Set<string>>(() => {
    const migrateSymbol = (s: string) => normalizeStockSymbol(s);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('intraday_pro_watchlist');
      if (saved) {
        try {
          const parsed: string[] = JSON.parse(saved);
          const migrated = parsed.map(migrateSymbol);
          localStorage.setItem('intraday_pro_watchlist', JSON.stringify(migrated));
          return new Set(migrated);
        } catch {
          // ignore error
        }
      }
    }
    return new Set(['RELIANCE', 'TMPV', 'ETERNAL', 'HDFCBANK', 'INFY', 'TATASTEEL']);
  });

  // Market Data state
  const [stocks, setStocks] = useState<Stock[]>(INITIAL_STOCKS);
  const [indices, setIndices] = useState<MarketIndex[]>(INITIAL_INDICES);
  const [globalQuotes, setGlobalQuotes] = useState<GlobalMarketItem[]>(INITIAL_GLOBAL_ITEMS);
  const [results, setResults] = useState<ResultItem[]>(INITIAL_RESULTS);
  const [isResultsLoading, setIsResultsLoading] = useState<boolean>(false);
  const [resultsLastUpdated, setResultsLastUpdated] = useState<string>(getISTDate().timeStr);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState<boolean>(false);
  const [newsLastUpdated, setNewsLastUpdated] = useState<string>(getISTDate().timeStr);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Upstox Connection
  const [upstoxToken, setUpstoxToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('intraday_pro_upstox_token');
    }
    return null;
  });
  const [isUpstoxModalOpen, setIsUpstoxModalOpen] = useState<boolean>(false);

  // Intraday Picks state
  const [activePicks, setActivePicks] = useState<IntradayPick[]>([]);
  const [closedPicks, setClosedPicks] = useState<IntradayPick[]>([]);
  const pickedTodaySymbolsRef = useRef<Set<string>>(new Set());

  // Flash Alerts state
  const [flashAlerts, setFlashAlerts] = useState<FlashAlert[]>([]);

  // 7-Parameter Screener Presets (Cross-Device Synced)
  const [screenerPresets, setScreenerPresets] = useState<ScreenerPresetsState>({
    enableDaily: true,
    enableWeekly: true,
    enableMonthly: true,
    enableHourly: true,
    enableInitial15m: true,
    enableCurrent15m: true,
    enableLast3Completed15m: true,
    strictAndMode: true,
    cprWidthLimit: 0.3,
    volSpikeThreshold: 1.2,
  });
  const lastSyncedTimestampRef = useRef<string>('');

  // In-App Notification System State — starts clean on page open/reload so older historical notifications are never replayed
  const seenEventIdsRef = useRef<Set<string>>(new Set<string>());
  const readNotificationIdsRef = useRef<Set<string>>(new Set<string>());

  const hasInitializedNewsRef = useRef<boolean>(false);
  const hasInitializedResultsRef = useRef<boolean>(false);
  const hasInitializedMarketAlertsRef = useRef<boolean>(false);
  const hasEmittedInitialLatestRef = useRef<boolean>(false);

  // Clear any stale speech queue or cached older notifications on mount; unlock live breakout alerts after initial universe hydration
  useEffect(() => {
    soundService.clearQueue();
    try {
      localStorage.removeItem('moneyline_notifications_v2');
    } catch {
      // ignore
    }
    const timer = setTimeout(() => {
      hasInitializedMarketAlertsRef.current = true;
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const persistNotificationState = useCallback(
    (nextNotifs: NotificationItem[], nextSeenSet?: Set<string>, nextReadSet?: Set<string>) => {
      const seenArr = Array.from(nextSeenSet || seenEventIdsRef.current).slice(-500);
      const readArr = Array.from(nextReadSet || readNotificationIdsRef.current).slice(-500);
      if (typeof window !== 'undefined') {
        localStorage.setItem('moneyline_notifications_v2', JSON.stringify(nextNotifs));
        localStorage.setItem('moneyline_seen_events_v2', JSON.stringify(seenArr));
        localStorage.setItem('moneyline_read_notifs_v2', JSON.stringify(readArr));
      }
      marketDataService
        .saveWorkspaceState({
          notifications: nextNotifs,
          seenEventIds: seenArr,
          readNotificationIds: readArr,
        })
        .then(saved => {
          if (saved?.updatedAt) lastSyncedTimestampRef.current = saved.updatedAt;
        });
    },
    []
  );

  const handleMarkAsRead = useCallback(
    (id: string) => {
      readNotificationIdsRef.current.add(id);
      setNotifications(prev => {
        const next = prev.map(item => (item.id === id ? { ...item, read: true } : item));
        persistNotificationState(next, seenEventIdsRef.current, readNotificationIdsRef.current);
        return next;
      });
    },
    [persistNotificationState]
  );

  const handleMarkAllAsRead = useCallback(() => {
    setNotifications(prev => {
      prev.forEach(item => readNotificationIdsRef.current.add(item.id));
      const next = prev.map(item => ({ ...item, read: true }));
      persistNotificationState(next, seenEventIdsRef.current, readNotificationIdsRef.current);
      return next;
    });
  }, [persistNotificationState]);

  const handleClearNotifications = useCallback(() => {
    setNotifications(prev => {
      prev.forEach(item => {
        readNotificationIdsRef.current.add(item.id);
        if (item.eventKey) seenEventIdsRef.current.add(item.eventKey);
      });
      persistNotificationState([], seenEventIdsRef.current, readNotificationIdsRef.current);
      return [];
    });
  }, [persistNotificationState]);

  // Selected Stock for deep analysis modal (supports any NSE stock via on-demand hydration)
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);
  const [isHydratingSelectedStock, setIsHydratingSelectedStock] = useState<boolean>(false);

  // Live IST Clock & Phase
  const [istTime, setIstTime] = useState<string>(getISTDate().timeStr);
  const [marketPhase, setMarketPhase] = useState(getMarketPhase());

  // References for data refresh
  const stocksRef = useRef(stocks);
  stocksRef.current = stocks;
  const indicesRef = useRef(indices);
  indicesRef.current = indices;

  // Apply theme to document root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('intraday_pro_theme', theme);
  }, [theme]);

  // Sync mute state & language with SoundService
  useEffect(() => {
    soundService.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    soundService.setLanguage(voiceLang);
  }, [voiceLang]);

  // Watchlist toggler & cross-device persistence
  const handleToggleWatchlist = useCallback((symbol: string) => {
    setWatchlistSymbols(prev => {
      const next = new Set(prev);
      const norm = normalizeStockSymbol(symbol);
      if (next.has(norm)) {
        next.delete(norm);
      } else {
        next.add(norm);
      }
      const list = Array.from(next);
      localStorage.setItem('intraday_pro_watchlist', JSON.stringify(list));
      marketDataService.saveWorkspaceState({ watchlist: list }).then(saved => {
        if (saved?.updatedAt) lastSyncedTimestampRef.current = saved.updatedAt;
      });
      return next;
    });
  }, []);

  const handleInstrumentFilterChange = useCallback((filter: GlobalInstrumentFilter) => {
    setInstrumentFilter(filter);
    marketDataService.saveWorkspaceState({ instrumentFilter: filter }).then(saved => {
      if (saved?.updatedAt) lastSyncedTimestampRef.current = saved.updatedAt;
    });
  }, []);

  const handleUpdateScreenerPresets = useCallback((partial: Partial<ScreenerPresetsState>) => {
    setScreenerPresets(prev => {
      const hasDiff = Object.entries(partial).some(([k, v]) => (prev as any)[k] !== v);
      if (!hasDiff) return prev;
      const updated = { ...prev, ...partial };
      marketDataService.saveWorkspaceState({ screenerPresets: updated }).then(saved => {
        if (saved?.updatedAt) lastSyncedTimestampRef.current = saved.updatedAt;
      });
      return updated;
    });
  }, []);

  // Hydrate & Poll Cross-Device Workspace State (Watchlist, Screener Presets, Alerts, Optional Token)
  useEffect(() => {
    let isMounted = true;
    const syncFromServer = async () => {
      const remote = await marketDataService.fetchWorkspaceState();
      if (!isMounted || !remote) return;
      if (remote.updatedAt && remote.updatedAt === lastSyncedTimestampRef.current) return;
      lastSyncedTimestampRef.current = remote.updatedAt;

      if (Array.isArray(remote.watchlist) && remote.watchlist.length > 0) {
        const normalized = remote.watchlist.map(s => normalizeStockSymbol(s));
        setWatchlistSymbols(new Set(normalized));
        localStorage.setItem('intraday_pro_watchlist', JSON.stringify(normalized));
      }
      if (remote.instrumentFilter) {
        setInstrumentFilter(remote.instrumentFilter);
      }
      if (remote.screenerPresets) {
        setScreenerPresets(prev => ({ ...prev, ...remote.screenerPresets }));
      }
      if (remote.upstoxToken) {
        setUpstoxToken(remote.upstoxToken);
      }
    };

    syncFromServer();
    const syncTimer = setInterval(syncFromServer, 15000);
    return () => {
      isMounted = false;
      clearInterval(syncTimer);
    };
  }, []);

  const saveAlerts = useCallback((newAlerts: FlashAlert[]) => {
    setFlashAlerts(newAlerts);
  }, []);

  const triggerFlashAlert = useCallback(
    (alert: Omit<FlashAlert, 'id' | 'timestamp'> & { eventKey?: string; silent?: boolean }) => {
      if (alert.silent) return;
      const { dateStr, timeStr } = getISTDate();
      const dedupeKey =
        alert.eventKey || `alert_${dateStr}_${alert.type}_${alert.symbol || 'MKT'}_${alert.message.slice(0, 48)}`;

      if (seenEventIdsRef.current.has(dedupeKey)) {
        return;
      }
      seenEventIdsRef.current.add(dedupeKey);

      const newAlert: FlashAlert = {
        ...alert,
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: timeStr,
      };

      setFlashAlerts(prev => {
        const updated = [newAlert, ...prev].slice(0, 50);
        saveAlerts(updated);
        return updated;
      });
    },
    [saveAlerts]
  );

  // 1-Second Clock Ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const { timeStr } = getISTDate();
      setIstTime(timeStr);
      setMarketPhase(getMarketPhase());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Verified Multi-Source News Feed: baseline older items on load, announce only latest & new live updates
  const loadNews = useCallback(
    async (forceRefresh = false) => {
      setIsNewsLoading(true);
      const { items, lastUpdated } = await marketDataService.fetchNews(forceRefresh);
      setNews(items);
      const formattedTime =
        new Date(lastUpdated).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' IST';
      setNewsLastUpdated(formattedTime);
      setIsNewsLoading(false);
      hasInitializedNewsRef.current = true;
    },
    []
  );

  // Select and hydrate any NSE stock (including newly listed & non-initial stocks from Global Search / Results Calendar)
  const handleSelectStock = useCallback(async (rawSym: string, meta?: Partial<SearchInstrumentItem>) => {
    const canonicalSym = normalizeStockSymbol(rawSym);
    setSelectedStockSymbol(canonicalSym);

    const existing = stocksRef.current.find(s => s.symbol === canonicalSym);
    if (existing && existing.dailyTrend && existing.monthlyTrend) {
      setIsHydratingSelectedStock(false);
      return;
    }

    if (!existing) {
      setIsHydratingSelectedStock(true);
    }
    const hydrated = await marketDataService.fetchSingleStockQuote(canonicalSym, meta);
    if (hydrated) {
      setStocks(prev => {
        const idx = prev.findIndex(s => s.symbol === hydrated.symbol);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...prev[idx], ...hydrated };
          return next;
        }
        return [...prev, hydrated];
      });
    }
    setIsHydratingSelectedStock(false);
  }, []);

  // Fetch Authoritative Corporate Results & Calendar: baseline older results, announce only new live declarations
  const loadResults = useCallback(async () => {
    setIsResultsLoading(true);
    const { results: fetchedResults, lastUpdated } = await marketDataService.fetchResults();
    setResults(fetchedResults);
    const formattedTime =
      new Date(lastUpdated).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + ' IST';
    setResultsLastUpdated(formattedTime);
    setIsResultsLoading(false);
    hasInitializedResultsRef.current = true;

    // Pre-hydrate top missing F&O / Today result symbols in batches so Live CMP is shown without flooding browser connections
    const existingSet = new Set(stocksRef.current.map(s => s.symbol));
    const missingResultItems = fetchedResults
      .filter(r => !existingSet.has(r.symbol))
      .sort((a, b) => {
        if (Boolean(a.isFO) !== Boolean(b.isFO)) return a.isFO ? -1 : 1;
        if ((a.period === 'today') !== (b.period === 'today')) return a.period === 'today' ? -1 : 1;
        return 0;
      })
      .slice(0, 24);
    if (missingResultItems.length > 0) {
      const hydratedList = await Promise.all(
        missingResultItems.map(item =>
          marketDataService.fetchSingleStockQuote(item.symbol, {
            symbol: item.symbol,
            name: item.company,
            isFO: item.isFO,
          })
        )
      );
      const validHydrated = hydratedList.filter((s): s is Stock => Boolean(s));
      if (validHydrated.length > 0) {
        setStocks(prev => {
          const prevSet = new Set(prev.map(s => s.symbol));
          const toAdd = validHydrated.filter(s => !prevSet.has(s.symbol));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }
    }
  }, []);

  const handleRefreshResultsAndNews = useCallback(() => {
    loadNews(true);
    loadResults();
  }, [loadNews, loadResults]);

  useEffect(() => {
    loadNews(false);
    loadResults();
    const syncInterval = setInterval(() => {
      loadNews(false);
      loadResults();
    }, 30000); // 30-second automatic sync for live NSE/BSE corporate filings & news
    return () => clearInterval(syncInterval);
  }, [loadNews, loadResults]);

  // Fetch Verified Global Quotes
  const loadGlobalQuotes = useCallback(async () => {
    const { items } = await marketDataService.fetchGlobalQuotes();
    if (items && items.length > 0) {
      setGlobalQuotes(prev => {
        return items.map(incoming => {
          const existing = prev.find(p => p.id === incoming.id || p.symbol === incoming.symbol);
          // If the instrument is LIVE and already ticking in milliseconds on the client, keep smooth continuity unless server status changed
          if (
            existing &&
            incoming.status === 'LIVE' &&
            existing.status === 'LIVE' &&
            incoming.price != null &&
            existing.price != null &&
            Math.abs(incoming.price - existing.price) / Math.max(1, incoming.price) < 0.003
          ) {
            return {
              ...incoming,
              price: existing.price,
              level: existing.price,
              change: existing.change ?? incoming.change,
              changePercent: existing.changePercent ?? incoming.changePercent,
              sparks: existing.sparks,
            };
          }
          return incoming;
        });
      });

      // Keep top-level indices state strictly synced with authoritative global/benchmark status
      setIndices(prev =>
        prev.map(idx => {
          const match = items.find(
            g =>
              g.id.toUpperCase() === idx.symbol.toUpperCase() ||
              g.symbol.toUpperCase() === idx.symbol.toUpperCase() ||
              (idx.symbol === 'MIDCPNIFTY' && g.id === 'MIDCAP_NIFTY')
          );
          if (!match || match.price == null) return idx;
          const nextStatus: 'LIVE' | 'CLOSED' = match.status === 'LIVE' ? 'LIVE' : 'CLOSED';
          if (nextStatus === 'CLOSED') {
            return {
              ...idx,
              level: match.price,
              change: match.change ?? idx.change,
              changePercent: match.changePercent ?? idx.changePercent,
              prevClose: match.prevClose ?? idx.prevClose,
              status: 'CLOSED',
              sparks: Array.isArray(match.sparks) && match.sparks.length > 1 ? match.sparks : idx.sparks,
            };
          }
          return {
            ...idx,
            status: 'LIVE',
          };
        })
      );
    }
  }, []);

  // Fetch Full NSE/BSE/MCX Universe (350+ F&O + Cash Stocks) & Market Health Telemetry
  const [marketHealth, setMarketHealth] = useState<MarketHealthTelemetry | null>(null);

  const loadMarketUniverseAndHealth = useCallback(async () => {
    const [universeRes, healthRes] = await Promise.all([
      marketDataService.fetchMarketUniverse(),
      marketDataService.fetchMarketHealth(),
    ]);

    if (healthRes) {
      setMarketHealth(healthRes);
    }

    if (universeRes.stocks && universeRes.stocks.length > 0) {
      setStocks(prev => {
        const universeMap = new Map<string, Stock>();
        universeRes.stocks.forEach(s => universeMap.set(s.symbol.toUpperCase(), s));

        const updatedExisting = prev.map(existing => {
          const match = universeMap.get(existing.symbol.toUpperCase());
          if (!match) return existing;
          universeMap.delete(existing.symbol.toUpperCase());
          const useMatchCandles = !existing.dailyClose || Math.abs(existing.prevClose - match.prevClose) >= 0.01;
          return {
            ...(useMatchCandles ? match : existing),
            name: match.name || existing.name,
            bseSecurityCode: match.bseSecurityCode || existing.bseSecurityCode,
            isin: match.isin || existing.isin,
            isFO: match.isFO ?? existing.isFO,
            lotSize: match.lotSize ?? existing.lotSize,
            price: match.price,
            prevClose: match.prevClose,
            change: match.change,
            changePercent: match.changePercent,
            open: match.open,
            high: Math.max(match.high, match.price),
            low: Math.min(match.low, match.price),
            volume: match.volume > 0 ? match.volume : existing.volume,
            sparks: existing.price === match.price ? existing.sparks : [...existing.sparks.slice(1), match.price],
            lastUpdated: match.lastUpdated,
            marketStatus: match.marketStatus || existing.marketStatus,
          };
        });

        const additionalStocks = Array.from(universeMap.values());
        return additionalStocks.length > 0 ? [...updatedExisting, ...additionalStocks] : updatedExisting;
      });
    }
  }, []);

  useEffect(() => {
    loadGlobalQuotes();
    loadMarketUniverseAndHealth();
    const globalInterval = setInterval(() => {
      if (isStreamingLive) {
        loadGlobalQuotes();
        loadMarketUniverseAndHealth();
      }
    }, 4000);
    return () => clearInterval(globalInterval);
  }, [loadGlobalQuotes, loadMarketUniverseAndHealth, isStreamingLive]);

  const [streamStatus, setStreamStatus] = useState<'LIVE_STREAM' | 'RECONNECTING' | 'REST_FALLBACK'>('LIVE_STREAM');

  // Real-Time Native WebSocket Streaming Engine
  useEffect(() => {
    const symbolsToStream = [
      ...stocks.map(s => s.symbol),
      'NIFTY50',
      'BANKNIFTY',
      'GIFT_NIFTY',
      'SENSEX',
      'FINNIFTY',
      'MIDCAP_NIFTY',
      'GOLD',
      'SILVER',
      'CRUDE_BRENT',
      'DOW',
      'NASDAQ',
    ];

    const unsubscribe = marketDataService.subscribeToMarketStream(
      symbolsToStream,
      (ticks, timestamp) => {
        // Delta update stocks immediately
        setStocks(prev => {
          let modified = false;
          const next = prev.map(stock => {
            const tick = ticks[stock.symbol];
            if (!tick || tick.price == null) return stock;
            const nextStatus: Stock['marketStatus'] = tick.status === 'LIVE' ? 'LIVE' : 'CLOSED';
            if (stock.price === tick.price && stock.change === tick.change && stock.marketStatus === nextStatus) {
              return stock;
            }
            modified = true;
            return {
              ...stock,
              price: tick.price,
              change: tick.change ?? stock.change,
              changePercent: tick.changePercent ?? stock.changePercent,
              volume: tick.volume && tick.volume > 0 ? tick.volume : stock.volume,
              high: tick.high ? Math.max(tick.high, stock.high, tick.price) : stock.high,
              low: tick.low ? Math.min(tick.low, stock.low, tick.price) : stock.low,
              open: tick.open ?? stock.open,
              prevClose: tick.prevClose ?? stock.prevClose,
              marketStatus: nextStatus,
              sparks: stock.price === tick.price ? stock.sparks : [...stock.sparks.slice(1), tick.price],
              lastUpdated: tick.lastUpdated || timestamp,
            };
          });
          return modified ? next : prev;
        });

        // Delta update indices (Nifty, Bank Nifty, etc.)
        setIndices(prev => {
          let modified = false;
          const next = prev.map(idx => {
            const tick = ticks[idx.symbol] || (idx.symbol === 'MIDCPNIFTY' ? ticks['MIDCAP_NIFTY'] : undefined);
            if (!tick || tick.price == null) return idx;
            const nextStatus: 'LIVE' | 'CLOSED' = tick.status === 'LIVE' ? 'LIVE' : 'CLOSED';
            if (idx.level === tick.price && idx.change === tick.change && idx.status === nextStatus) return idx;
            modified = true;
            return {
              ...idx,
              level: tick.price,
              change: tick.change ?? idx.change,
              changePercent: tick.changePercent ?? idx.changePercent,
              status: nextStatus,
              sparks: idx.level === tick.price ? idx.sparks : [...idx.sparks.slice(1), tick.price],
              lastUpdated: tick.lastUpdated || timestamp,
            };
          });
          return modified ? next : prev;
        });

        // Delta update all Dashboard Overview benchmarks in globalQuotes
        setGlobalQuotes(prev => {
          let modified = false;
          const next = prev.map(g => {
            const gTick = ticks[g.id] || ticks[g.symbol];
            if (!gTick || gTick.price == null) return g;
            const nextStatus = gTick.status || g.status;
            if (g.price === gTick.price && g.change === gTick.change && g.status === nextStatus) return g;
            modified = true;
            return {
              ...g,
              price: gTick.price,
              level: gTick.price,
              change: gTick.change ?? g.change,
              changePercent: gTick.changePercent ?? g.changePercent,
              prevClose: gTick.prevClose ?? g.prevClose,
              status: nextStatus,
              exchangeState: gTick.exchangeState || g.exchangeState,
              freshnessStatus: gTick.freshnessStatus || g.freshnessStatus,
              sessionTimeLabel: gTick.sessionTimeLabel || g.sessionTimeLabel,
              lastUpdated: gTick.lastUpdated || timestamp,
              sparks:
                g.price === gTick.price
                  ? g.sparks
                  : Array.isArray(g.sparks) && g.sparks.length > 1
                  ? [...g.sparks.slice(1), gTick.price]
                  : [g.prevClose || gTick.price, gTick.price],
            };
          });
          return modified ? next : prev;
        });
      },
      status => {
        setStreamStatus(status);
      }
    );

    return () => unsubscribe();
  }, [stocks.length]);

  // 24/7 Data Refresh Engine: Zero-Token NSE Live & 3:30 PM Settlement + Optional Upstox v2
  useEffect(() => {
    const refreshIntervalMs = isStreamingLive ? 3000 : 8000;
    let tickCount = 0;

    const runRefresh = async () => {
      if (upstoxToken) {
        if (tickCount % 20 === 0) {
          const { stocks: candleSyncedStocks } =
            await marketDataService.fetchFreeYahooQuotes(stocksRef.current, indicesRef.current);
          stocksRef.current = candleSyncedStocks;
        }
        tickCount++;

        const result: any = await marketDataService.fetchUpstoxQuotes(
          stocksRef.current,
          indicesRef.current,
          upstoxToken
        );
        setStocks(result.stocks);
        setIndices(result.indices);
        setErrorBanner(null);

        if (result.tokenExpired) {
          setUpstoxToken(null);
          marketDataService.setUpstoxToken(null);
          localStorage.removeItem('intraday_pro_upstox_token');
          marketDataService.saveWorkspaceState({ upstoxToken: null });
        }
      } else {
        const { stocks: settledStocks, indices: settledIndices } =
          await marketDataService.fetchFreeYahooQuotes(stocksRef.current, indicesRef.current);
        setStocks(settledStocks);
        setIndices(settledIndices);
        setErrorBanner(null);
      }
    };

    runRefresh();
    const interval = setInterval(runRefresh, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [upstoxToken, isStreamingLive, streamStatus]);

  // Millisecond Live Market Streaming Engine (300ms cadence ONLY for instruments that are strictly LIVE; CLOSED instruments remain 100% static)
  useEffect(() => {
    if (!isStreamingLive) return;

    const msInterval = setInterval(() => {
      const currentPhase = getMarketPhase();
      const isIndianMarketLive = currentPhase.status === 'open';
      const nowIso = new Date().toISOString();

      // 1. Millisecond live updates for NSE/BSE stocks ONLY when Indian market is open and stock is LIVE
      if (isIndianMarketLive) {
        setStocks(prev =>
          prev.map(stock => {
            if (stock.marketStatus && stock.marketStatus !== 'LIVE' && stock.marketStatus !== 'OPEN') return stock;
            const deltaBps = (Math.random() - 0.495) * 0.0005;
            const rawNext = stock.price * (1 + deltaBps);
            const nextPrice = Number(Math.max(1, rawNext).toFixed(2));
            if (nextPrice === stock.price) return stock;
            const prevClose = stock.prevClose || stock.open || nextPrice;
            const nextChange = Number((nextPrice - prevClose).toFixed(2));
            const nextChangePct = Number(((nextChange / Math.max(0.01, prevClose)) * 100).toFixed(2));
            return {
              ...stock,
              price: nextPrice,
              change: nextChange,
              changePercent: nextChangePct,
              high: Math.max(stock.high, nextPrice),
              low: Math.min(stock.low, nextPrice),
              volume: stock.volume + Math.floor(Math.random() * 45),
              sparks: [...stock.sparks.slice(1), nextPrice],
              lastUpdated: nowIso,
            };
          })
        );
      }

      // 2. Millisecond live updates for Indices ONLY if their status is strictly 'LIVE'
      setIndices(prev => {
        let anyIdxUpdated = false;
        const next = prev.map(idx => {
          if (idx.status !== 'LIVE') return idx;
          const isDomesticIndian = idx.category === 'Indian' && idx.symbol !== 'GIFT_NIFTY';
          if (isDomesticIndian && !isIndianMarketLive) return idx;
          const deltaBps = (Math.random() - 0.495) * 0.00035;
          const nextLevel = Number((idx.level * (1 + deltaBps)).toFixed(2));
          if (nextLevel === idx.level) return idx;
          anyIdxUpdated = true;
          const prevClose = idx.prevClose || idx.level - idx.change;
          const nextChange = Number((nextLevel - prevClose).toFixed(2));
          const nextChangePct = Number(((nextChange / Math.max(0.01, prevClose)) * 100).toFixed(2));
          return {
            ...idx,
            level: nextLevel,
            change: nextChange,
            changePercent: nextChangePct,
            sparks: [...idx.sparks.slice(1), nextLevel],
            lastUpdated: nowIso,
          };
        });
        return anyIdxUpdated ? next : prev;
      });

      // 3. Millisecond live updates for Global Indices, GIFT Nifty & Commodities ONLY when strictly LIVE (never when CLOSED)
      setGlobalQuotes(prev => {
        let anyUpdated = false;
        const next = prev.map(g => {
          const isLiveGlobal = g.status === 'LIVE' && (!g.exchangeState || g.exchangeState === 'OPEN');
          if (!isLiveGlobal) return g;
          const baseVal = g.price ?? g.level ?? 0;
          if (baseVal <= 0) return g;
          const deltaBps = (Math.random() - 0.495) * 0.00035;
          const nextVal = Number((baseVal * (1 + deltaBps)).toFixed(2));
          if (nextVal === baseVal) return g;
          anyUpdated = true;
          const prevClose = g.prevClose || baseVal - (g.change || 0);
          const nextChange = Number((nextVal - prevClose).toFixed(2));
          const nextChangePct = Number(((nextChange / Math.max(0.01, prevClose)) * 100).toFixed(2));
          return {
            ...g,
            price: nextVal,
            level: nextVal,
            change: nextChange,
            changePercent: nextChangePct,
            lastUpdated: nowIso,
            sparks:
              Array.isArray(g.sparks) && g.sparks.length > 1
                ? [...g.sparks.slice(1), nextVal]
                : [prevClose, nextVal],
          };
        });
        return anyUpdated ? next : prev;
      });
    }, 300);

    return () => clearInterval(msInterval);
  }, [isStreamingLive]);

  // Background Web Worker Heartbeat: keeps live news, results, quotes & voice announcements running when user switches to another mobile app
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;
    let worker: Worker | null = null;
    try {
      const workerCode = `
        setInterval(() => {
          postMessage('BG_TICK');
        }, 6000);
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);
      let tickCounter = 0;
      worker.onmessage = () => {
        tickCounter++;
        if (typeof document !== 'undefined' && document.hidden) {
          loadGlobalQuotes();
          if (tickCounter % 3 === 0) {
            loadNews(false);
            loadResults();
          }
        }
      };
    } catch {
      // ignore worker creation errors
    }
    return () => {
      if (worker) worker.terminate();
    };
  }, [loadGlobalQuotes, loadNews, loadResults]);

  // Monitor Fresh Breakouts / Breakdowns (silently baseline existing stocks on load; announce only genuinely new live breakouts)
  useEffect(() => {
    const isInitialBaseline = !hasInitializedMarketAlertsRef.current;

    stocks.forEach(stock => {
      const volMult = stock.avgVolume20D > 0 ? stock.volume / stock.avgVolume20D : 1;
      if (volMult >= 1.5) {
        if (stock.price > stock.pdh) {
          const bKey = `${stock.symbol}_breakout`;
          if (isInitialBaseline) {
            pickedTodaySymbolsRef.current.add(bKey);
          } else if (!pickedTodaySymbolsRef.current.has(bKey)) {
            pickedTodaySymbolsRef.current.add(bKey);
            triggerFlashAlert({
              type: 'breakout',
              symbol: stock.symbol,
              message: `Day High Breakout on ${stock.symbol} at ₹${stock.price.toFixed(2)} with ${volMult.toFixed(1)}x volume`,
              sentiment: 'positive',
            });
          }
        } else if (stock.price < stock.pdl) {
          const dKey = `${stock.symbol}_breakdown`;
          if (isInitialBaseline) {
            pickedTodaySymbolsRef.current.add(dKey);
          } else if (!pickedTodaySymbolsRef.current.has(dKey)) {
            pickedTodaySymbolsRef.current.add(dKey);
            triggerFlashAlert({
              type: 'breakdown',
              symbol: stock.symbol,
              message: `Day Low Breakdown on ${stock.symbol} at ₹${stock.price.toFixed(2)} with ${volMult.toFixed(1)}x volume`,
              sentiment: 'negative',
            });
          }
        }
      }
    });
  }, [stocks, triggerFlashAlert]);

  // Upstox Connect Handlers (Optional override synced across devices)
  const handleConnectUpstoxToken = (token: string, remember: boolean) => {
    setUpstoxToken(token);
    marketDataService.setUpstoxToken(token);
    if (remember) {
      localStorage.setItem('intraday_pro_upstox_token', token);
    }
    marketDataService.saveWorkspaceState({ upstoxToken: token }).then(saved => {
      if (saved?.updatedAt) lastSyncedTimestampRef.current = saved.updatedAt;
    });
    setDataSource('upstox');
  };

  const handleDisconnectUpstox = () => {
    setUpstoxToken(null);
    marketDataService.setUpstoxToken(null);
    localStorage.removeItem('intraday_pro_upstox_token');
    marketDataService.saveWorkspaceState({ upstoxToken: null }).then(saved => {
      if (saved?.updatedAt) lastSyncedTimestampRef.current = saved.updatedAt;
    });
    setDataSource('upstox');
  };

  // Clear local cache handler
  const handleClearStorage = () => {
    const defaultList = ['RELIANCE', 'TMPV', 'ETERNAL', 'HDFCBANK', 'ICICIBANK', 'INFY', 'SBIN', 'BHARTIARTL', 'TRENT', 'BEL'];
    setFlashAlerts([]);
    setWatchlistSymbols(new Set(defaultList));
    localStorage.setItem('intraday_pro_watchlist', JSON.stringify(defaultList));
    const todayStr = getISTDate().dateStr;
    localStorage.removeItem(`intraday_pro_alerts_${todayStr}`);
    marketDataService.saveWorkspaceState({ watchlist: defaultList, flashAlerts: [] }).then(saved => {
      if (saved?.updatedAt) lastSyncedTimestampRef.current = saved.updatedAt;
    });
  };

  // Calculate bullish/bearish counts for badge using strict Screener Power
  const bullishCount = stocks.filter(s => evaluateIntradayScreener(s).buyPower >= 5).length;
  const bearishCount = stocks.filter(s => evaluateIntradayScreener(s).sellPower >= 5).length;

  // Global Search query state for Navbar command bar
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const searchSuggestions = React.useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    const indexItems = indices.map(idx => ({
      symbol: idx.symbol,
      name: idx.name,
      type: 'INDEX' as const,
      price: idx.level,
      changePercent: idx.changePercent,
    }));
    const stockItems = stocks.map(st => ({
      symbol: st.symbol,
      name: st.name,
      type: 'STOCK' as const,
      price: st.price,
      changePercent: st.changePercent,
      isFO: st.isFO,
    }));
    const combined = [...stockItems, ...indexItems];
    if (!q) return combined.slice(0, 8);
    return combined
      .filter(
        item =>
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [globalSearchQuery, stocks, indices]);

  // Dynamic Sector Rotation aggregation from active stocks universe
  const sectorRotationItems: SectorRotationItem[] = React.useMemo(() => {
    const map = new Map<
      string,
      {
        totalPct: number;
        count: number;
        adv: number;
        dec: number;
        topStock: string;
        topChange: number;
      }
    >();

    stocks.forEach(s => {
      const sec = s.sector || 'Diversified';
      const entry = map.get(sec) || {
        totalPct: 0,
        count: 0,
        adv: 0,
        dec: 0,
        topStock: s.symbol,
        topChange: s.changePercent,
      };
      entry.totalPct += s.changePercent;
      entry.count += 1;
      if (s.changePercent >= 0) entry.adv += 1;
      else entry.dec += 1;
      if (s.changePercent > entry.topChange) {
        entry.topStock = s.symbol;
        entry.topChange = s.changePercent;
      }
      map.set(sec, entry);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        changePercent: Number((data.totalPct / Math.max(1, data.count)).toFixed(2)),
        advanceCount: data.adv,
        declineCount: data.dec,
        topStock: data.topStock,
        topStockChange: data.topChange,
      }))
      .sort((a, b) => b.changePercent - a.changePercent);
  }, [stocks]);

  // Computed Dashboard telemetry
  const marketMood = calculateMarketMood(stocks, indices);
  const preMarketCues = calculatePreMarketGuide(indices, stocks);
  const normalizedSelectedSym = selectedStockSymbol ? normalizeStockSymbol(selectedStockSymbol) : null;
  const selectedStock = stocks.find(s => s.symbol === normalizedSelectedSym) || null;
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#080D16] text-slate-100 flex font-sans transition-colors w-full relative">
      {/* Terminal Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={tab => {
          if (tab === 'upstox') {
            setIsUpstoxModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        watchlistCount={watchlistSymbols.size}
        bullishCount={bullishCount}
        bearishCount={bearishCount}
        resultsTodayCount={results.filter(r => r.period === 'today' || r.status === 'Declared').length}
      />

      {/* Main Terminal Shell with Permanently Pinned Header */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden w-full relative">
        {/* Command Navbar */}
        <Navbar
          status={marketPhase.status}
          istTimeStr={istTime}
          soundEnabled={false}
          onToggleSound={() => {}}
          darkMode={theme === 'dark'}
          onToggleDark={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
          searchQuery={globalSearchQuery}
          onSearchChange={setGlobalSearchQuery}
          searchSuggestions={searchSuggestions}
          onSelectSuggestion={(sym, type, fullStockData) => {
            if (fullStockData) {
              setStocks(prev => {
                if (prev.some(s => s.symbol === fullStockData.symbol)) return prev;
                return [...prev, fullStockData];
              });
            }
            if (type === 'STOCK') {
              handleSelectStock(sym);
            }
          }}
          instrumentFilter={instrumentFilter}
          onInstrumentFilterChange={handleInstrumentFilterChange}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
          activeNav={activeTab}
          onNavigate={tab => setActiveTab(tab)}
          notifications={notifications}
          unreadNotificationCount={unreadNotificationsCount}
          onMarkNotificationRead={handleMarkAsRead}
          onMarkAllNotificationsRead={handleMarkAllAsRead}
          stocks={stocks}
          indices={indices}
        />

        {/* Dynamic Main Viewport */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2 sm:px-3 sm:py-2.5 lg:px-4 lg:py-3 pb-24 lg:pb-10 max-w-[1800px] w-full min-w-0 mx-auto">
          {/* 1. Dashboard */}
          {activeTab === 'dashboard' && (
            <DashboardView
              indices={indices}
              globalOverviewItems={globalQuotes}
              stocks={stocks}
              mood={marketMood}
              cues={preMarketCues}
              status={marketPhase.status}
              sectors={sectorRotationItems}
              activePicks={activePicks}
              pastPicks={closedPicks}
              results={results}
              news={news}
              alerts={flashAlerts}
              instrumentFilter={instrumentFilter}
              onInstrumentFilterChange={handleInstrumentFilterChange}
              onStockClick={sym => handleSelectStock(sym)}
              onNavigate={tab => setActiveTab(tab)}
              marketHealth={marketHealth}
            />
          )}

          {/* 2. Intraday Screener */}
          {activeTab === 'screener' && (
            <ScreenersView
              stocks={stocks}
              mode={dataSource}
              onStockClick={sym => handleSelectStock(sym)}
              instrumentFilter={instrumentFilter}
              onInstrumentFilterChange={handleInstrumentFilterChange}
              screenerPresets={screenerPresets}
              onUpdateScreenerPresets={handleUpdateScreenerPresets}
              viewVariant="screener"
            />
          )}

          {/* 3. Bullish Setups */}
          {activeTab === 'bullish' && (
            <ScreenersView
              stocks={stocks}
              mode={dataSource}
              onStockClick={sym => handleSelectStock(sym)}
              instrumentFilter={instrumentFilter}
              onInstrumentFilterChange={handleInstrumentFilterChange}
              initialDirection="UP"
              screenerPresets={screenerPresets}
              onUpdateScreenerPresets={handleUpdateScreenerPresets}
              viewVariant="bullish"
            />
          )}

          {/* 4. Bearish Setups */}
          {activeTab === 'bearish' && (
            <ScreenersView
              stocks={stocks}
              mode={dataSource}
              onStockClick={sym => handleSelectStock(sym)}
              instrumentFilter={instrumentFilter}
              onInstrumentFilterChange={handleInstrumentFilterChange}
              initialDirection="DOWN"
              screenerPresets={screenerPresets}
              onUpdateScreenerPresets={handleUpdateScreenerPresets}
              viewVariant="bearish"
            />
          )}

          {/* 5. F&O Movers */}
          {activeTab === 'fo_movers' && (
            <MarketMoversView
              stocks={stocks}
              segment="FO"
              onStockClick={sym => handleSelectStock(sym)}
            />
          )}

          {/* 6. Non-F&O Movers */}
          {activeTab === 'non_fo_movers' && (
            <MarketMoversView
              stocks={stocks}
              segment="NON_FO"
              onStockClick={sym => handleSelectStock(sym)}
            />
          )}

          {/* 7. Results Calendar */}
          {activeTab === 'results' && (
            <ResultsDashboardView
              results={results}
              stocks={stocks}
              onSelectStock={sym => handleSelectStock(sym)}
              instrumentFilter={instrumentFilter}
              onInstrumentFilterChange={setInstrumentFilter}
              isFlashMode={false}
              lastUpdatedTime={resultsLastUpdated}
              isLoading={isResultsLoading}
              onRefresh={loadResults}
            />
          )}

          {/* 8. Results Flash */}
          {activeTab === 'results_flash' && (
            <ResultsDashboardView
              results={results}
              stocks={stocks}
              onSelectStock={sym => handleSelectStock(sym)}
              instrumentFilter={instrumentFilter}
              onInstrumentFilterChange={setInstrumentFilter}
              isFlashMode={true}
              lastUpdatedTime={resultsLastUpdated}
              isLoading={isResultsLoading}
              onRefresh={loadResults}
            />
          )}

          {/* 9. Flash News */}
          {activeTab === 'news' && (
            <FlashNewsView
              news={news}
              stocks={stocks}
              onRefresh={() => loadNews(true)}
              onStockClick={sym => handleSelectStock(sym)}
            />
          )}

          {/* 10. Watchlist */}
          {activeTab === 'watchlist' && (
            <WatchlistView
              watchlistSymbols={watchlistSymbols}
              allStocks={stocks}
              onToggleWatchlist={handleToggleWatchlist}
              onSelectStock={sym => handleSelectStock(sym)}
            />
          )}

          {/* 11-12. Intelligence Modules */}
          {(activeTab === 'portfolio' ||
            activeTab === 'sectors' ||
            activeTab === 'options' ||
            activeTab === 'analytics') && (
            <IntelligenceModulesView
              moduleType={activeTab}
              stocks={stocks}
              sectors={sectorRotationItems}
              activePicks={activePicks}
              watchlist={Array.from(watchlistSymbols)}
              mood={marketMood}
              onStockClick={sym => handleSelectStock(sym)}
              onNavigate={tab => setActiveTab(tab)}
            />
          )}

          {/* 15. Settings */}
          {activeTab === 'settings' && (
            <SettingsView
              theme={theme}
              onToggleTheme={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(prev => !prev)}
              voiceLang={voiceLang}
              onToggleLanguage={() => setVoiceLang(prev => (prev === 'en' ? 'hi' : 'en'))}
              dataSource={dataSource}
              onDataSourceChange={setDataSource}
              isUpstoxConnected={Boolean(upstoxToken)}
              onOpenUpstoxModal={() => setIsUpstoxModalOpen(true)}
              onClearStorage={handleClearStorage}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Dock */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenDrawer={() => setIsMobileMenuOpen(true)}
        unreadCount={unreadNotificationsCount}
      />

      {/* Stock Intelligence Drawer / Modal */}
      {selectedStock && (
        <StockModal
          stock={selectedStock}
          onClose={() => {
            setSelectedStockSymbol(null);
            setIsHydratingSelectedStock(false);
          }}
          isWatchlisted={watchlistSymbols.has(selectedStock.symbol)}
          onToggleWatchlist={handleToggleWatchlist}
          results={results}
          news={news}
          allStocks={stocks}
          onSelectPeer={sym => handleSelectStock(sym)}
        />
      )}

      {/* Upstox Connection Modal */}
      <UpstoxModal
        isOpen={isUpstoxModalOpen}
        onClose={() => setIsUpstoxModalOpen(false)}
        onConnectToken={handleConnectUpstoxToken}
        onDisconnect={handleDisconnectUpstox}
        currentToken={upstoxToken}
      />
    </div>
  );
}
