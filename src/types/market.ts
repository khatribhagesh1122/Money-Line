export type DataSourceMode = 'upstox';

export type TickSpeed = '1s' | '3s' | '5s' | '10s';

export type MarketStatus = 'pre_market' | 'pre_open' | 'open' | 'closed' | 'holiday';

export type GlobalInstrumentFilter = 'ALL' | 'FO' | 'NON_FO';

export type NavigationTab =
  | 'dashboard'
  | 'screener'
  | 'bullish'
  | 'bearish'
  | 'fo_movers'
  | 'non_fo_movers'
  | 'results'
  | 'results_flash'
  | 'news'
  | 'watchlist'
  | 'portfolio'
  | 'sectors'
  | 'options'
  | 'analytics'
  | 'upstox'
  | 'settings';

export type DataFreshnessStatus =
  | 'LIVE'
  | 'LIVE_STREAM'
  | 'LIVE_POLL'
  | 'DELAYED'
  | 'INDICATIVE_PARITY'
  | 'THEORETICAL_ESTIMATE'
  | 'SETTLED'
  | 'EOD_SETTLED'
  | 'UNAVAILABLE';

export type ExchangeMarketState =
  | 'PRE-OPEN'
  | 'OPEN'
  | 'LIVE'
  | 'CLOSING AUCTION'
  | 'POST-MARKET'
  | 'CLOSED'
  | 'SETTLED'
  | 'HOLIDAY'
  | 'HALTED'
  | 'DELAYED'
  | 'DISCONNECTED';

export interface ExchangeClockInfo {
  exchange: 'NSE' | 'BSE' | 'MCX' | 'NSE IX' | 'CDS / Forex' | 'Spot Forex' | 'US Markets' | 'COMEX' | 'ICE Futures';
  name?: string;
  segment?: string;
  state: ExchangeMarketState;
  isOpen: boolean;
  sessionLabel?: string;
  tradingHours?: string;
  sessionHours?: string;
  localTime?: string;
  timezone?: string;
  lastUpdated?: string;
  nextTransition?: string;
  nextEvent?: string;
  lastTradeTime?: string;
  lastTickTime?: string;
  note?: string;
}

export interface MarketBreadthUniverse {
  id?: string;
  name?: string;
  universe?: string;
  sector?: string;
  exchange?: string;
  advances: number;
  declines: number;
  unchanged: number;
  unavailable?: number;
  totalValid?: number;
  totalEligible?: number;
  coveragePercent: number;
  adRatio: number;
  changePercent?: number;
  lastUpdated?: string;
}

export interface MarketHealthTelemetry {
  timestamp: string;
  istTime?: string;
  exchanges?: ExchangeClockInfo[];
  clocks?: ExchangeClockInfo[];
  providers: Array<{
    name?: string;
    provider?: string;
    segment?: string;
    feedType?: 'REAL-TIME STREAM' | 'LIVE POLLING (1s-5s)' | 'DELAYED' | 'OFFLINE';
    entitlement?: string;
    status: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED' | 'STANDBY';
    latencyMs?: number;
    lastSync: string;
    errorCount?: number;
    coverage?: string;
  }>;
  instruments: {
    nseTotal?: number;
    nseEquities?: number;
    nseEquityTotal?: number;
    nseEquitiesActive?: number;
    nseFoUnderlyings?: number;
    nseFoTotal?: number;
    bseTotal?: number;
    bseEquities?: number;
    bseEquityTotal?: number;
    mcxTotal?: number;
    mcxCommodities?: number;
    mcxActiveTotal?: number;
    forexTotal?: number;
    forexPairs?: number;
    forexActiveTotal?: number;
    indices?: number;
    indicesTotal?: number;
    totalMasterCount?: number;
    activeDashboardUniverse?: number;
    subscribedCount?: number;
    subscribedSymbols?: number;
    subscribedStreamingCount?: number;
    streamingCount?: number;
    streamingActive?: number;
    delayedCount?: number;
    staleCount?: number;
    staleInstrumentsCount?: number;
    missingCount?: number;
  };
  breadth: {
    nseOverall: MarketBreadthUniverse;
    nifty50: MarketBreadthUniverse;
    nifty100: MarketBreadthUniverse;
    nifty200: MarketBreadthUniverse;
    nifty500: MarketBreadthUniverse;
    foStocks: MarketBreadthUniverse;
    bseOverall: MarketBreadthUniverse;
    sectors: MarketBreadthUniverse[];
  };
  diagnostics?: {
    wsConnected?: boolean;
    wsClientsConnected?: number;
    lastTickReceivedAt: string;
    lastFullRefreshAt?: string;
    duplicateTicksDropped?: number;
    reconnectionCount?: number;
    apiErrorsCount?: number;
    wsErrorsCount?: number;
    lastErrorMsg?: string | null;
    uptimeSeconds?: number;
  };
}

export interface CprLevels {
  p: number;
  tc: number;
  bc: number;
  widthPercent: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
}

export interface IntradayCandle15m {
  open: number;
  high: number;
  low: number;
  close: number;
  timeLabel?: string;
  completed?: boolean;
}

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  exchange?: 'NSE' | 'BSE' | 'BOTH';
  isin?: string;
  bseCode?: string;
  bseSecurityCode?: string;
  marketCapCr?: number;
  isFO: boolean;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  tradedValueCr?: number;
  avgVolume20D: number;
  dma20: number;
  dma50: number;
  dma100: number;
  dma200: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  atr14: number;
  weekChange: number;
  monthChange: number;
  high52W: number;
  low52W: number;
  pdh: number; // Previous Day High
  pdl: number; // Previous Day Low
  pwh: number; // Previous Week High
  pwl: number; // Previous Week Low
  pmh: number; // Previous Month High
  pml: number; // Previous Month Low
  prevDayOpen: number;
  lastWeekOpen: number;
  lastMonthOpen: number;
  prevHourlyOpen?: number;
  currentHourlyOpen: number;
  itCandles: IntradayCandle15m[]; // First 3 completed 15m candles (9:15, 9:30, 9:45 IST)
  current15m: IntradayCandle15m; // Current active 15m candle
  last3Completed15m: IntradayCandle15m[]; // Last 3 completed 15m candles with High/Low structure

  // Completed Candles & Multi-Timeframe Screener Metrics
  monthlyOpen?: number;
  monthlyClose?: number;
  prevMonthOpen?: number; // T-2 Month Open (e.g. Sep Open when in Nov)
  prevMonthClose?: number;
  monthlyTrend?: 'UP' | 'DOWN' | 'NEUTRAL';

  weeklyOpen?: number;
  weeklyClose?: number;
  prevWeekOpen?: number; // T-2 Week Open
  prevWeekClose?: number;
  weeklyTrend?: 'UP' | 'DOWN' | 'NEUTRAL';

  dailyOpen?: number;
  dailyClose?: number;
  prevDay2Open?: number; // T-2 Day Open
  prevDayCloseVal?: number;
  dailyTrend?: 'UP' | 'DOWN' | 'NEUTRAL';
  dailySupport?: number; // Open of latest completed bullish daily candle
  dailyResistance?: number; // Open of latest completed bearish daily candle

  hourlyOpen?: number;
  hourlyClose?: number;
  prevHourly2Open?: number; // T-2 1H Open
  prevHourlyClose?: number;
  hourlyTrend?: 'UP' | 'DOWN' | 'NEUTRAL';

  first15mOpen?: number;
  first15mClose?: number;
  initialTrend?: 'UP' | 'DOWN' | 'NEUTRAL';

  first45mOpen?: number;
  first45mClose?: number;
  first45mHigh?: number;
  first45mLow?: number;
  first45mCompletedCount?: number;
  biggestTrend?: 'UP' | 'DOWN' | 'NEUTRAL';
  hasScreenerData?: boolean;

  isNR7: boolean;
  cpr: CprLevels;
  sparks: number[];
  oiBuildup?: 'Long Buildup' | 'Short Buildup' | 'Short Covering' | 'Long Unwinding';
  pcr?: number;
  instrumentKey?: string;
  instrumentId?: string;
  segment?: string;
  lotSize?: number;
  lastUpdated?: string;
  exchangeTimestamp?: string | null;
  providerTimestamp?: string | null;
  serverReceivedTimestamp?: string | null;
  frontendUpdatedTimestamp?: string | null;
  dataSource?: string;
  freshnessStatus?: DataFreshnessStatus;
  marketStatus?: ExchangeMarketState;
  isAvailableInMaster?: boolean;
  tradingEligibility?: 'ELIGIBLE' | 'SUSPENDED' | 'RESTRICTED' | 'INDEX_NON_TRADABLE';
  quoteAvailability?: 'LIVE_QUOTE' | 'ON_DEMAND_QUOTE' | 'DELAYED_QUOTE' | 'EOD_ONLY' | 'UNAVAILABLE';
  contractStatus?: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'SPOT_PERPETUAL';
}

export interface MarketIndex {
  symbol: string;
  name: string;
  level: number;
  change: number;
  changePercent: number;
  prevClose?: number;
  sparks: number[];
  category: 'Indian' | 'Global' | 'Commodity';
  currency?: string;
  exchange?: string;
  segment?: string;
  status?: ExchangeMarketState;
  lastUpdated?: string;
  exchangeTimestamp?: string | null;
  providerTimestamp?: string | null;
  serverReceivedTimestamp?: string | null;
  frontendUpdatedTimestamp?: string | null;
  dataSource?: string;
  freshnessStatus?: DataFreshnessStatus;
  advances?: number;
  declines?: number;
  unchanged?: number;
}

export interface GlobalMarketItem {
  id: string;
  instrumentId?: string;
  symbol: string;
  name: string;
  category: 'Commodity' | 'MCX' | 'Forex' | 'US' | 'Europe' | 'Asia' | 'Indian';
  currency: string;
  exchange: string;
  segment?: string;
  price?: number | null;
  level?: number | null;
  change: number | null;
  changePercent: number | null;
  prevClose: number | null;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  volume?: number | null;
  status: ExchangeMarketState;
  exchangeState?: ExchangeMarketState;
  sessionTimeLabel?: string;
  lastUpdated: string | null;
  exchangeTimestamp?: string | null;
  providerTimestamp?: string | null;
  serverReceivedTimestamp?: string | null;
  frontendUpdatedTimestamp?: string | null;
  freshnessStatus?: DataFreshnessStatus;
  sparks: number[];
  unit?: string;
  contractExpiry?: string;
  lotSize?: number;
  instrumentKey?: string;
  instrumentType?: 'SPOT' | 'FUTURES' | 'INDEX' | 'COMMODITY';
  dataSource?: string;
  isDashboardOverview?: boolean;
  impactNote?: string;
  source?: string;
  isIndicativeParity?: boolean;
  quoteUnavailableReason?: string;
}

export interface ChecklistItem {
  id: number;
  label: string;
  passed: boolean;
  detail: string;
}

export type OptionAction = 'BUY CALL' | 'SELL CALL' | 'BUY PUT' | 'SELL PUT';

export interface OptionRecommendation {
  action: OptionAction;
  actionType: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE';
  direction: 'BULLISH' | 'BEARISH';
  strikePrice: number;
  expiryDate: string;
  lotSize: number;
  spotPrice: number;
  optionLtp: number;
  entryRange: string;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskRewardRatio: string;
  liquidityRating: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
  openInterest: number | null;
  openInterestChangePercent: number | null;
  impliedVolatility: number | null;
  delta: number | null;
  volume?: number | null;
  rationale: string;
  strategyStyle: 'MOMENTUM_DEBIT' | 'THETA_CREDIT' | 'BREAKDOWN_DEBIT' | 'REVERSAL_CREDIT';
  contractSymbol: string;
  optionDataSource?: string;
  freshnessStatus?: DataFreshnessStatus;
  isTheoreticalEstimate?: boolean;
  providerTimestamp?: string | null;
}

export interface IntradayPick {
  id: string;
  stockSymbol: string;
  stockName: string;
  side: 'CALL' | 'PUT';
  action: OptionAction;
  optionRecommendation: OptionRecommendation;
  score: number;
  checklist: ChecklistItem[];
  entryPrice: number; // Spot price
  stopLoss: number;
  target1: number;
  target2: number;
  strike: number;
  status: 'active' | 'target1_hit' | 'target2_hit' | 'stop_hit' | 'closed';
  closedReason?: string;
  timestamp: string;
  currentPrice: number;
  pnlPercent: number;
}

export type NotificationCategory = 'all' | 'breaking_news' | 'results' | 'market_alerts' | 'picks';

export interface NotificationItem {
  id: string;
  eventKey?: string;
  timestamp: string;
  publicationTime?: string;
  exchangeFilingTime?: string;
  detectedByServerTime?: string;
  notificationDeliveredTime?: string;
  title: string;
  message: string;
  category: NotificationCategory;
  read: boolean;
  symbol?: string;
  exchange?: string;
  source?: string;
  filingUrl?: string;
  severity?: 'info' | 'success' | 'warning' | 'danger';
  linkTab?: NavigationTab;
}

export interface MarketMood {
  score: number;
  sentiment: 'Bullish' | 'Bearish' | 'Sideways';
  advCount: number;
  decCount: number;
  totalCount: number;
  niftyPercent: number;
  greenSectors: number;
  totalSectors: number;
  vixPercent: number;
}

export interface PreMarketCues {
  us: number;
  asia: number;
  gift: number;
  crude: number;
  dollar: number;
  usdinr: number;
  score: number;
  outlook: 'Gap-up' | 'Gap-down' | 'Flat';
  cuesDetail: {
    sp500: number;
    nasdaq: number;
    dow: number;
    nikkei: number;
    hangseng: number;
    giftNifty: number | null;
    crude: number;
    gold: number;
    silver: number;
    dollarIndex: number;
    usdinr: number;
  };
  hints: string[];
  watchStocks: string[];
}

export interface FlashAlert {
  id: string;
  timestamp: string;
  type: 'breakout' | 'breakdown' | 'target' | 'stop' | 'pick' | 'news' | 'result';
  symbol?: string;
  message: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  spoken?: boolean;
}

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  positiveCount: number;
  negativeCount: number;
  category: 'breaking' | 'stock' | 'corporate' | 'fo' | 'global' | 'economic' | 'rbi' | 'deals';
  symbol?: string;
  companyName?: string;
  marketImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  impactNote?: string;
}

export interface SearchInstrumentItem {
  symbol: string;
  name: string;
  instrumentKey: string;
  segment: string;
  exchange?: string;
  isin?: string;
  bseCode?: string | null;
  bseSecurityCode?: string | null;
  expiryDate?: string;
  isFO: boolean;
  lotSize?: number;
  legacyAlias?: string;
  sector?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  prevClose?: number;
  dataSource?: string;
  freshnessStatus?: DataFreshnessStatus;
  providerTimestamp?: string | null;
  isAvailableInMaster?: boolean;
  tradingEligibility?: 'ELIGIBLE' | 'SUSPENDED' | 'RESTRICTED' | 'INDEX_NON_TRADABLE';
  quoteAvailability?: 'LIVE_QUOTE' | 'ON_DEMAND_QUOTE' | 'DELAYED_QUOTE' | 'EOD_ONLY' | 'UNAVAILABLE';
  contractStatus?: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'SPOT_PERPETUAL';
}

export interface QuarterlyFinancialRow {
  quarter: string; // e.g. 'Q2 FY27', 'Q1 FY27', 'Q4 FY26', 'Q3 FY26', 'Q2 FY26'
  quarterLabel?: string;
  periodEnded: string;
  reportType?: 'Consolidated' | 'Standalone';
  reportingType?: 'CONSOLIDATED' | 'STANDALONE';
  revenue: number;
  expenses: number;
  operatingProfit: number;
  opmPercent: number;
  otherIncome: number;
  interest: number;
  depreciation: number;
  ebitda: number;
  profitBeforeTax: number;
  taxPercent: number;
  netProfit: number;
  eps: number;
  yoyRevenueGrowth?: number;
  yoyPatGrowth?: number;
  qoqRevenueGrowth?: number;
  qoqPatGrowth?: number;
  filingLink?: string;
  bseFilingLink?: string;
  xbrlLink?: string;
  source?: string;
}

export interface CompanyFinancialHistory {
  symbol: string;
  companyName: string;
  isin?: string;
  bseCode?: string;
  exchange: string;
  sector?: string;
  marketCapCr?: number | null;
  currentPrice?: number | null;
  peRatio?: number | null;
  bookValue?: number | null;
  rocePercent?: number | null;
  roePercent?: number | null;
  consolidated: QuarterlyFinancialRow[];
  standalone: QuarterlyFinancialRow[];
  announcements: Array<{
    id: string;
    title: string;
    category: string;
    exchange: string;
    filingTime: string;
    pdfUrl?: string;
    xbrlUrl?: string;
  }>;
  lastUpdated: string;
  dataSource: string;
}

export interface ResultItem {
  id?: string;
  symbol: string;
  company: string;
  isin?: string;
  bseCode?: string;
  exchange?: 'NSE' | 'BSE' | 'BOTH' | 'MCX';
  sector?: string;
  isFO: boolean;
  quarter?: string;
  reportType?: 'Consolidated' | 'Standalone';
  reportingType?: 'CONSOLIDATED' | 'STANDALONE';
  announcementCategory?: 'FINANCIAL_RESULT' | 'BOARD_MEETING' | 'DIVIDEND' | 'PRESS_RELEASE' | 'CONCALL' | 'CORPORATE_ACTION';
  status?: 'Declared' | 'Scheduled';
  period: 'yesterday' | 'today' | 'tomorrow' | 'next2days' | 'upcoming' | 'declared' | 'calendar';
  resultDate: string;
  expectedTime?: string;
  filingTimestamp?: string;
  exchangeTimestamp?: string;
  serverReceivedTimestamp?: string;
  dateStatus?: 'Confirmed' | 'Estimated';
  filingReference?: string;
  isRevised?: boolean;
  previousDate?: string;
  revisionNote?: string;
  prevQtrRevenue?: number; // in ₹ Cr
  prevQtrNetProfit?: number; // in ₹ Cr
  yoyBaseRevenue?: number; // in ₹ Cr
  yoyBaseNetProfit?: number; // in ₹ Cr
  expectedRevenue?: number; // in ₹ Cr (only if genuinely available)
  expectedNetProfit?: number; // in ₹ Cr
  actualRevenue?: number; // in ₹ Cr
  actualExpenses?: number; // in ₹ Cr
  actualNetProfit?: number; // in ₹ Cr
  otherIncome?: number; // in ₹ Cr
  interest?: number; // in ₹ Cr
  depreciation?: number; // in ₹ Cr
  pbt?: number; // in ₹ Cr
  profitBeforeTax?: number; // in ₹ Cr
  taxPercent?: number; // in %
  opmPercent?: number; // in %
  yoyRevenueGrowth?: number; // in %
  yoyProfitGrowth?: number; // in %
  qoqRevenueGrowth?: number; // in %
  qoqProfitGrowth?: number; // in %
  expectedEps: number;
  actualEps?: number;
  operatingProfit?: number; // in ₹ Cr (strictly from filing, never 0.22x)
  ebitda?: number; // in ₹ Cr (strictly from filing, never 0.26x)
  surprisePercent?: number;
  reaction: 'Beat' | 'Miss' | 'In line' | 'Pending' | 'Reported';
  isConfirmed: boolean;
  filingLink?: string; // Direct URL to exchange PDF document
  bseFilingLink?: string;
  xbrlFilingLink?: string;
  filingUrl?: string;
  xbrlLink?: string;
  source?: string;
  notes?: string;
  consolidatedHistory?: QuarterlyFinancialRow[];
  standaloneHistory?: QuarterlyFinancialRow[];
  quarterlyHistory?: {
    consolidated: QuarterlyFinancialRow[];
    standalone: QuarterlyFinancialRow[];
  };
}

export interface SectorRotationItem {
  name: string;
  changePercent: number;
  advanceCount: number;
  declineCount: number;
  topStock: string;
  topStockChange: number;
}

export interface ScreenerFilterSettings {
  direction: 'BULLISH' | 'BEARISH';
  instrument: GlobalInstrumentFilter;
  enableMonthly: boolean;
  enableWeekly: boolean;
  enableDaily: boolean;
  enableHourly: boolean;
  enableInitial15m: boolean;
  enableCurrent15m: boolean;
  enableLast3Completed15m: boolean;
  minScore: number;
}

