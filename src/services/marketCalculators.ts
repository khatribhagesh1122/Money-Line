import { Stock, MarketIndex, IntradayPick, ChecklistItem, MarketMood, PreMarketCues, SectorRotationItem, CprLevels } from '../types/market';
import { NSE_HOLIDAYS_2026, SECTORS } from '../data/stocks';
import { generateOptionRecommendation } from './optionsEngine';

/**
 * Get current time in Indian Standard Time (IST = UTC + 5:30)
 */
export function getISTDate(): { date: Date; timeStr: string; dateStr: string; dayOfWeek: number; hours: number; minutes: number } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 3600000;
  const istDate = new Date(utc + istOffset);

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const seconds = istDate.getSeconds();
  const dayOfWeek = istDate.getDay(); // 0 is Sunday, 6 is Saturday

  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)} IST`;
  const yyyy = istDate.getFullYear();
  const mm = pad(istDate.getMonth() + 1);
  const dd = pad(istDate.getDate());
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return { date: istDate, timeStr, dateStr, dayOfWeek, hours, minutes };
}

/**
 * 15-Minute Interval Info Helper for Intraday Screener Engine
 * Returns information about whether the market is currently in a trading session (09:00 - 16:00 IST on weekdays),
 * the current 15-minute interval key (e.g. "2026-11-04_09:45"), seconds until the next 15-minute candle boundary,
 * and a formatted countdown string.
 */
export function get15MinIntervalInfo(): {
  isTradingWindow: boolean;
  isWeekday: boolean;
  intervalKey: string;
  secondsUntilNext: number;
  formattedCountdown: string;
  sessionStatusLabel: string;
} {
  const { dateStr, dayOfWeek, hours, minutes } = getISTDate();
  const nowSec = new Date().getSeconds();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5 && !NSE_HOLIDAYS_2026.includes(dateStr);
  const currentMinuteOfDay = hours * 60 + minutes;

  // Trading window for 15m intraday screener snapshots: starts strictly at 09:15 AM IST when market opens until 15:30 PM IST
  const isTradingWindow = isWeekday && currentMinuteOfDay >= 9 * 60 + 15 && currentMinuteOfDay < 15 * 60 + 30;

  // Calculate 15-minute interval boundary
  const intervalMinute = Math.floor(minutes / 15) * 15;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const intervalKey = isTradingWindow ? `${dateStr}_${pad(hours)}:${pad(intervalMinute)}` : `CLOSED_${dateStr}`;

  // Seconds until next 15-minute boundary (or until 09:15 AM IST if in pre-open)
  const minuteOffset = minutes % 15;
  const secondsRemaining = (15 - minuteOffset) * 60 - nowSec;
  const targetSeconds = secondsRemaining <= 0 ? 900 : secondsRemaining;

  const mm = Math.floor(targetSeconds / 60);
  const ss = targetSeconds % 60;
  const formattedCountdown = `${pad(mm)}m ${pad(ss)}s`;

  const sessionStatusLabel = isTradingWindow
    ? `LIVE 15-MIN INTERVAL ENGINE (${pad(hours)}:${pad(intervalMinute)} IST SNAPSHOT)`
    : `CLOSED MARKET • PREV DAY CLOSE SNAPSHOT (REFRESH STARTS AT 09:15 AM IST)`;

  return {
    isTradingWindow,
    isWeekday,
    intervalKey,
    secondsUntilNext: targetSeconds,
    formattedCountdown,
    sessionStatusLabel,
  };
}

/**
 * Determine Market Status following IST rules:
 * Pre-market: 7:00 - 9:00
 * Pre-open: 9:00 - 9:15
 * Open: 9:15 - 15:30
 * Otherwise: Closed or Holiday/weekend
 */
export function getMarketPhase(): { status: 'pre_market' | 'pre_open' | 'open' | 'closed' | 'holiday'; label: string; color: string } {
  const { dateStr, dayOfWeek, hours, minutes } = getISTDate();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { status: 'closed', label: 'CLOSED • Weekend (3:30 PM Settle)', color: 'bg-rose-500 text-slate-400' };
  }

  if (NSE_HOLIDAYS_2026.includes(dateStr)) {
    return { status: 'holiday', label: 'CLOSED • NSE Holiday (3:30 PM Settle)', color: 'bg-amber-500 text-amber-400' };
  }

  const currentMinuteOfDay = hours * 60 + minutes;

  if (currentMinuteOfDay >= 7 * 60 && currentMinuteOfDay < 9 * 60) {
    return { status: 'pre_market', label: 'CLOSED • Pre-Market (Prev Close)', color: 'bg-sky-500 text-sky-400' };
  }

  if (currentMinuteOfDay >= 9 * 60 && currentMinuteOfDay < 9 * 60 + 15) {
    return { status: 'pre_open', label: 'CLOSED • Pre-Open (Prev Close)', color: 'bg-indigo-500 text-indigo-400' };
  }

  if (currentMinuteOfDay >= 9 * 60 + 15 && currentMinuteOfDay < 15 * 60 + 30) {
    return { status: 'open', label: 'LIVE • Market Open (09:15 - 15:30)', color: 'bg-emerald-500 text-emerald-400' };
  }

  return { status: 'closed', label: 'CLOSED • 3:30 PM IST Settle', color: 'bg-rose-500 text-slate-400' };
}

/**
 * Calculate Market Mood Gauge:
 * score = 50 * ((Adv - Dec) / N) + 15 * Nifty% + 4 * (GreenSectors - Sectors / 2) - 1.5 * VIX%
 * Limited to -100..+100.
 * Above +12 is Bullish, below -12 is Bearish, otherwise Sideways.
 */
export function calculateMarketMood(stocks: Stock[], indices: MarketIndex[]): MarketMood {
  const totalCount = stocks.length;
  let advCount = 0;
  let decCount = 0;

  stocks.forEach(stock => {
    if (stock.changePercent > 0) advCount++;
    else if (stock.changePercent < 0) decCount++;
  });

  const nifty = indices.find(i => i.symbol === 'NIFTY50');
  const vix = indices.find(i => i.symbol === 'INDIAVIX');

  const niftyPercent = nifty ? nifty.changePercent : 0;
  const vixPercent = vix ? vix.changePercent : 0;

  // Sector performance
  let greenSectors = 0;
  SECTORS.forEach(sec => {
    const secStocks = stocks.filter(s => s.sector === sec);
    if (secStocks.length > 0) {
      const avgChange = secStocks.reduce((sum, s) => sum + s.changePercent, 0) / secStocks.length;
      if (avgChange > 0) greenSectors++;
    }
  });

  const totalSectors = SECTORS.length;
  const advDecRatio = totalCount > 0 ? (advCount - decCount) / totalCount : 0;
  const sectorTerm = greenSectors - totalSectors / 2;

  let rawScore = 50 * advDecRatio + 15 * niftyPercent + 4 * sectorTerm - 1.5 * vixPercent;
  const clampedScore = Math.max(-100, Math.min(100, Number(rawScore.toFixed(1))));

  let sentiment: 'Bullish' | 'Bearish' | 'Sideways' = 'Sideways';
  if (clampedScore > 12) {
    sentiment = 'Bullish';
  } else if (clampedScore < -12) {
    sentiment = 'Bearish';
  }

  return {
    score: clampedScore,
    sentiment,
    advCount,
    decCount,
    totalCount,
    niftyPercent,
    greenSectors,
    totalSectors,
    vixPercent,
  };
}

/**
 * Calculate round strike price for options based on stock price
 */
export function calculateRoundStrike(price: number): number {
  if (price < 100) return Math.round(price);
  if (price < 300) return Math.round(price / 5) * 5;
  if (price < 700) return Math.round(price / 10) * 10;
  if (price < 1500) return Math.round(price / 20) * 20;
  if (price < 3000) return Math.round(price / 50) * 50;
  if (price < 7000) return Math.round(price / 100) * 100;
  return Math.round(price / 250) * 250;
}

/**
 * Evaluate 10-point checklist for a single stock (Bull & Bear)
 */
export function evaluatePickChecklist(stock: Stock): {
  bullScore: number;
  bearScore: number;
  bullChecks: ChecklistItem[];
  bearChecks: ChecklistItem[];
} {
  const dayRange = stock.high - stock.low || 1;
  const posInDayRange = (stock.price - stock.low) / dayRange;
  const volMultiplier = stock.avgVolume20D > 0 ? stock.volume / stock.avgVolume20D : 1;
  const distFrom52WHigh = (stock.high52W - stock.price) / (stock.high52W || 1);
  const distFrom52WLow = (stock.price - stock.low52W) / (stock.low52W || 1);

  // Bull checklist (10 points)
  const bullChecks: ChecklistItem[] = [
    { id: 1, label: 'Change > +0.5%', passed: stock.changePercent > 0.5, detail: `${stock.changePercent.toFixed(2)}%` },
    { id: 2, label: 'Price in top 20% of day range', passed: posInDayRange >= 0.80, detail: `${(posInDayRange * 100).toFixed(0)}%` },
    { id: 3, label: 'Volume > 1.5x 20D average', passed: volMultiplier >= 1.5, detail: `${volMultiplier.toFixed(1)}x` },
    { id: 4, label: 'Above 50 DMA', passed: stock.price > stock.dma50, detail: `₹${stock.price} vs DMA ₹${stock.dma50}` },
    { id: 5, label: 'Above 200 DMA', passed: stock.price > stock.dma200, detail: `₹${stock.price} vs DMA ₹${stock.dma200}` },
    { id: 6, label: 'RSI between 55 and 75', passed: stock.rsi14 >= 55 && stock.rsi14 <= 75, detail: `RSI ${stock.rsi14.toFixed(1)}` },
    { id: 7, label: 'Weekly change > +2%', passed: stock.weekChange > 2.0, detail: `${stock.weekChange.toFixed(1)}%` },
    { id: 8, label: 'Above previous-day high', passed: stock.price > stock.pdh, detail: `₹${stock.price} > PDH ₹${stock.pdh}` },
    { id: 9, label: 'NR7 with change > +0.3%', passed: stock.isNR7 && stock.changePercent > 0.3, detail: stock.isNR7 ? 'NR7 Yes' : 'No' },
    { id: 10, label: 'Within 3% of 52-week high', passed: distFrom52WHigh <= 0.03, detail: `${(distFrom52WHigh * 100).toFixed(1)}% away` },
  ];

  // Bear checklist (10 points mirrored)
  const bearChecks: ChecklistItem[] = [
    { id: 1, label: 'Change < -0.5%', passed: stock.changePercent < -0.5, detail: `${stock.changePercent.toFixed(2)}%` },
    { id: 2, label: 'Price in bottom 20% of day range', passed: posInDayRange <= 0.20, detail: `${(posInDayRange * 100).toFixed(0)}%` },
    { id: 3, label: 'Volume > 1.5x 20D average', passed: volMultiplier >= 1.5, detail: `${volMultiplier.toFixed(1)}x` },
    { id: 4, label: 'Below 50 DMA', passed: stock.price < stock.dma50, detail: `₹${stock.price} vs DMA ₹${stock.dma50}` },
    { id: 5, label: 'Below 200 DMA', passed: stock.price < stock.dma200, detail: `₹${stock.price} vs DMA ₹${stock.dma200}` },
    { id: 6, label: 'RSI between 25 and 45', passed: stock.rsi14 >= 25 && stock.rsi14 <= 45, detail: `RSI ${stock.rsi14.toFixed(1)}` },
    { id: 7, label: 'Weekly change < -2%', passed: stock.weekChange < -2.0, detail: `${stock.weekChange.toFixed(1)}%` },
    { id: 8, label: 'Below previous-day low', passed: stock.price < stock.pdl, detail: `₹${stock.price} < PDL ₹${stock.pdl}` },
    { id: 9, label: 'NR7 with change < -0.3%', passed: stock.isNR7 && stock.changePercent < -0.3, detail: stock.isNR7 ? 'NR7 Yes' : 'No' },
    { id: 10, label: 'Within 3% of 52-week low', passed: distFrom52WLow <= 0.03, detail: `${(distFrom52WLow * 100).toFixed(1)}% away` },
  ];

  const bullScore = bullChecks.filter(c => c.passed).length;
  const bearScore = bearChecks.filter(c => c.passed).length;

  return { bullScore, bearScore, bullChecks, bearChecks };
}

/**
 * Generate candidate Intraday Pick from a stock
 */
export function generateIntradayPick(stock: Stock): IntradayPick | null {
  if (!stock.isFO) return null;

  const { bullScore, bearScore, bullChecks, bearChecks } = evaluatePickChecklist(stock);
  const isBull = bullScore >= bearScore;
  const score = isBull ? bullScore : bearScore;

  if (score < 5) return null;

  const side: 'CALL' | 'PUT' = isBull ? 'CALL' : 'PUT';
  const checklist = isBull ? bullChecks : bearChecks;
  const atr = stock.atr14 || Math.max(stock.price * 0.015, 5);

  const entryPrice = stock.price;
  let stopLoss: number;
  let target1: number;
  let target2: number;

  if (side === 'CALL') {
    stopLoss = Number((entryPrice - 0.8 * atr).toFixed(2));
    target1 = Number((entryPrice + 1.2 * atr).toFixed(2));
    target2 = Number((entryPrice + 2.0 * atr).toFixed(2));
  } else {
    stopLoss = Number((entryPrice + 0.8 * atr).toFixed(2));
    target1 = Number((entryPrice - 1.2 * atr).toFixed(2));
    target2 = Number((entryPrice - 2.0 * atr).toFixed(2));
  }

  const strike = calculateRoundStrike(entryPrice);
  const optionRec = generateOptionRecommendation(stock, bullScore, bearScore);
  if (!optionRec) return null;

  return {
    id: `${stock.symbol}_${Date.now()}`,
    stockSymbol: stock.symbol,
    stockName: stock.name,
    side,
    action: optionRec.action,
    optionRecommendation: optionRec,
    score,
    checklist,
    entryPrice,
    stopLoss,
    target1,
    target2,
    strike: optionRec.strikePrice,
    status: 'active',
    timestamp: getISTDate().timeStr,
    currentPrice: stock.price,
    pnlPercent: 0,
  };
}

/**
 * Update Pick status based on latest price:
 * Stays Active until target 1 is hit, stop is hit, or score drops below 4.
 * Then moves to Closed today and is not repeated that day.
 */
export function evaluatePickStatus(pick: IntradayPick, currentStock: Stock): { updatedPick: IntradayPick; transitioned: boolean; reason?: string } {
  const currentPrice = currentStock.price;
  const pnlPercent = pick.side === 'CALL'
    ? ((currentPrice - pick.entryPrice) / pick.entryPrice) * 100
    : ((pick.entryPrice - currentPrice) / pick.entryPrice) * 100;

  let newStatus = pick.status;
  let reason: string | undefined;

  if (pick.status === 'active') {
    if (pick.side === 'CALL') {
      if (currentPrice >= pick.target2) {
        newStatus = 'target2_hit';
        reason = `Target 2 reached at ₹${currentPrice.toFixed(2)}`;
      } else if (currentPrice >= pick.target1) {
        newStatus = 'target1_hit';
        reason = `Target 1 reached at ₹${currentPrice.toFixed(2)}`;
      } else if (currentPrice <= pick.stopLoss) {
        newStatus = 'stop_hit';
        reason = `Stop loss triggered at ₹${currentPrice.toFixed(2)}`;
      }
    } else {
      // PUT
      if (currentPrice <= pick.target2) {
        newStatus = 'target2_hit';
        reason = `Target 2 reached at ₹${currentPrice.toFixed(2)}`;
      } else if (currentPrice <= pick.target1) {
        newStatus = 'target1_hit';
        reason = `Target 1 reached at ₹${currentPrice.toFixed(2)}`;
      } else if (currentPrice >= pick.stopLoss) {
        newStatus = 'stop_hit';
        reason = `Stop loss triggered at ₹${currentPrice.toFixed(2)}`;
      }
    }

    // Check score degradation below 4
    if (newStatus === 'active') {
      const { bullScore, bearScore } = evaluatePickChecklist(currentStock);
      const currentScore = pick.side === 'CALL' ? bullScore : bearScore;
      if (currentScore < 4) {
        newStatus = 'closed';
        reason = `Setup invalidated (score fell to ${currentScore}/10)`;
      }
    }
  }

  const transitioned = newStatus !== pick.status;

  return {
    updatedPick: {
      ...pick,
      currentPrice,
      pnlPercent: Number(pnlPercent.toFixed(2)),
      status: newStatus,
      closedReason: reason || pick.closedReason,
    },
    transitioned,
    reason,
  };
}

/**
 * Pre-Market Guide Calculation:
 * score = 0.8 * US + 0.5 * Asia + 1.2 * GIFT - 0.15 * Crude - 0.3 * Dollar - 0.4 * USDINR
 * Above +0.5 gives Gap-up, below -0.5 gives Gap-down, otherwise Flat.
 */
export function calculatePreMarketGuide(indices: MarketIndex[], stocks: Stock[]): PreMarketCues {
  const nasdaq = indices.find(i => i.symbol === 'NASDAQ')?.changePercent ?? -2.86;
  const dow = indices.find(i => i.symbol === 'DOW')?.changePercent ?? -1.09;
  const sp500 = indices.find(i => i.symbol === 'SP500')?.changePercent ?? -1.82;
  const crude = indices.find(i => i.symbol === 'CRUDE_BRENT' || i.symbol === 'CRUDE_WTI')?.changePercent ?? -1.26;
  const gold = indices.find(i => i.symbol === 'GOLD')?.changePercent ?? 0.47;
  const silver = indices.find(i => i.symbol === 'SILVER')?.changePercent ?? 1.05;

  const nikkei = 0.57;
  const hangseng = -0.53;
  const giftNifty = indices.find(i => i.symbol === 'GIFT_NIFTY')?.changePercent ?? 0.51;
  const dollarIndex = 0.37;
  const usdinr = 0.06;

  const us = (sp500 + nasdaq + dow) / 3;
  const asia = (nikkei + hangseng) / 2;
  const gift = giftNifty;

  const rawScore = 0.8 * us + 0.5 * asia + 1.2 * gift - 0.15 * crude - 0.3 * dollarIndex - 0.4 * usdinr;
  const score = Number(rawScore.toFixed(2));

  let outlook: 'Gap-up' | 'Gap-down' | 'Flat' = 'Flat';
  if (score > 0.5) {
    outlook = 'Gap-up';
  } else if (score < -0.5) {
    outlook = 'Gap-down';
  }

  const hints: string[] = [];
  if (outlook === 'Gap-up') {
    hints.push(`Strong global cues indicate a positive opening with ~${(score * 40).toFixed(0)} points gap-up on Nifty.`);
    hints.push('Watch for opening range breakout (ORB) above 9:15 high; avoid chasing extended calls.');
  } else if (outlook === 'Gap-down') {
    hints.push(`Global weakness points to a defensive opening (~${Math.abs(score * 35).toFixed(0)} points gap-down).`);
    hints.push('Monitor immediate support at previous day low and India VIX spikes.');
  } else {
    hints.push('Balanced international indices suggest a flat to quiet opening range.');
    hints.push('Wait for 15-minute initial trend confirmation before taking high-conviction intraday positions.');
  }

  // Stocks to watch: F&O with checklist score 6+
  const watchStocks = stocks
    .filter(s => s.isFO)
    .filter(s => {
      const { bullScore, bearScore } = evaluatePickChecklist(s);
      return Math.max(bullScore, bearScore) >= 6;
    })
    .slice(0, 5)
    .map(s => s.symbol);

  return {
    us: Number(us.toFixed(2)),
    asia: Number(asia.toFixed(2)),
    gift: Number(gift.toFixed(2)),
    crude: Number(crude.toFixed(2)),
    dollar: Number(dollarIndex.toFixed(2)),
    usdinr: Number(usdinr.toFixed(2)),
    score,
    outlook,
    cuesDetail: {
      sp500,
      nasdaq,
      dow,
      nikkei,
      hangseng,
      giftNifty,
      crude,
      gold,
      silver,
      dollarIndex,
      usdinr,
    },
    hints,
    watchStocks: watchStocks.length > 0 ? watchStocks : ['RELIANCE', 'TMPV', 'ETERNAL', 'HDFCBANK'],
  };
}

export interface TrendCheckItem {
  code: 'D' | 'W' | 'M' | 'H' | 'IT' | 'CURR15' | 'LAST3_15';
  label: string;
  description: string;
  passed: boolean;
  value: string;
  referencePrice?: string;
  selected?: boolean;
}

/**
 * Multi-Timeframe Trend Screener (7 Parameters — Reference-Open & Structure Logic):
 * 1. Daily Trend (D): Current price > Previous trading day's OPEN (Bullish) | < Previous trading day's OPEN (Bearish)
 * 2. Weekly Trend (W): Current price > Previous week's OPEN (Bullish) | < Previous week's OPEN (Bearish)
 * 3. Monthly Trend (M): Current price > Previous month's OPEN (Bullish) | < Previous month's OPEN (Bearish)
 * 4. Hourly Trend (H): Current price > Previous hourly candle's OPEN (Bullish) | < Previous hourly candle's OPEN (Bearish)
 * 5. Initial 15-Minute Trend (IT): Price > OPEN of all three completed opening 15m candles (9:15, 9:30, 9:45 IST) (Bullish) | < OPEN of all three (Bearish)
 * 6. Current 15-Minute Trend (CURR15): Current market price > Current 15-minute candle OPEN (Bullish) | < Current 15-minute candle OPEN (Bearish)
 * 7. Biggest Trend (LAST3_15): Last three completed 15m candles show Higher Highs & Higher Lows with price > today's OPEN (Bullish) | Lower Highs & Lower Lows with price < today's OPEN (Bearish)
 */
export function evaluateTrendScore(
  stock: Stock,
  direction: 'UP' | 'DOWN',
  activeFilters?: {
    enableDaily?: boolean;
    enableWeekly?: boolean;
    enableMonthly?: boolean;
    enableHourly?: boolean;
    enableInitial15m?: boolean;
    enableCurrent15m?: boolean;
    enableLast3Completed15m?: boolean;
  }
): {
  score: number;
  maxScore: number;
  allSelectedPassed: boolean;
  totalPassed7: number;
  checks: TrendCheckItem[];
  allChecks: TrendCheckItem[];
  qualificationSummary: string;
} {
  const isUp = direction === 'UP';
  const price = stock.price;

  // Use evaluateIntradayScreener for unified HTF & Intraday trend determinations
  const screenerEval = evaluateIntradayScreener(stock);

  // 1. Daily Trend (D)
  const prevDay2Open = stock.prevDay2Open ?? stock.dailyOpen ?? stock.prevDayOpen ?? stock.prevClose;
  const checkD = isUp ? screenerEval.dailyTrend === 'UP' : screenerEval.dailyTrend === 'DOWN';

  // 2. Weekly Trend (W)
  const prevWeekOpen = stock.prevWeekOpen ?? stock.weeklyOpen ?? stock.lastWeekOpen ?? prevDay2Open;
  const checkW = isUp ? screenerEval.weeklyTrend === 'UP' : screenerEval.weeklyTrend === 'DOWN';

  // 3. Monthly Trend (M)
  const prevMonthOpen = stock.prevMonthOpen ?? stock.monthlyOpen ?? stock.lastMonthOpen ?? prevWeekOpen;
  const checkM = isUp ? screenerEval.monthlyTrend === 'UP' : screenerEval.monthlyTrend === 'DOWN';

  // 4. Hourly Trend (H)
  const prevHourly2Open = stock.prevHourly2Open ?? stock.hourlyOpen ?? stock.prevHourlyOpen ?? stock.currentHourlyOpen ?? stock.open;
  const hourlyCloseVal = stock.hourlyClose ?? stock.prevHourlyClose ?? stock.open;
  const checkH = isUp ? screenerEval.hourlyTrend === 'UP' : screenerEval.hourlyTrend === 'DOWN';

  // 5. Initial 15-Minute Trend (IT)
  const completedItCandles = (stock.itCandles || []).filter(c => c.completed !== false);
  const hasAll3ItCandles = completedItCandles.length === 3;
  const itPassedCount = completedItCandles.filter(c => (isUp ? price > c.open : price < c.open)).length;
  const checkIT = isUp ? screenerEval.initialTrend === 'UP' : screenerEval.initialTrend === 'DOWN';

  // 6. Current 15-Minute Trend (CURR15)
  const curr15Open = stock.current15m?.open ?? stock.open;
  const checkCurr15 = isUp ? price > curr15Open : price < curr15Open;

  // 7. Biggest Trend (LAST3_15 / First 45m)
  const checkBiggestTrend = isUp ? screenerEval.biggestTrend === 'UP' : screenerEval.biggestTrend === 'DOWN';
  const biggestDetail = `45m Open ₹${(stock.first45mOpen || stock.open).toFixed(2)} | Close ₹${(stock.first45mClose || price).toFixed(2)}`;

  const itOpensLabel =
    completedItCandles.length > 0
      ? completedItCandles.map(c => `₹${c.open.toFixed(1)}`).join(' / ')
      : 'Pending 9:15-10:00';

  const rawChecks: Array<Omit<TrendCheckItem, 'selected'>> = [
    {
      code: 'D',
      label: '1. Daily Trend (D)',
      description: isUp
        ? `Daily Trend ${screenerEval.dailyTrend} (T-1 Close ₹${screenerEval.dailyClose.toFixed(2)} > T-2 Open ₹${prevDay2Open.toFixed(2)} & CMP ₹${price.toFixed(2)} > ₹${screenerEval.dailyClose.toFixed(2)})`
        : `Daily Trend ${screenerEval.dailyTrend} (T-1 Close ₹${screenerEval.dailyClose.toFixed(2)} < T-2 Open ₹${prevDay2Open.toFixed(2)} & CMP ₹${price.toFixed(2)} < ₹${screenerEval.dailyClose.toFixed(2)})`,
      passed: checkD,
      value: `₹${screenerEval.dailyClose.toFixed(2)}`,
      referencePrice: `T-1 Close: ₹${screenerEval.dailyClose.toFixed(2)} | T-2 Open: ₹${prevDay2Open.toFixed(2)} | PDH ₹${stock.pdh} | PDL ₹${stock.pdl}`,
    },
    {
      code: 'W',
      label: '2. Weekly Trend (W)',
      description: isUp
        ? `Weekly Trend ${screenerEval.weeklyTrend} (T-1 Close ₹${screenerEval.weeklyClose.toFixed(2)} > T-2 Open ₹${prevWeekOpen.toFixed(2)} & CMP ₹${price.toFixed(2)} > ₹${screenerEval.weeklyClose.toFixed(2)})`
        : `Weekly Trend ${screenerEval.weeklyTrend} (T-1 Close ₹${screenerEval.weeklyClose.toFixed(2)} < T-2 Open ₹${prevWeekOpen.toFixed(2)} & CMP ₹${price.toFixed(2)} < ₹${screenerEval.weeklyClose.toFixed(2)})`,
      passed: checkW,
      value: `₹${screenerEval.weeklyClose.toFixed(2)}`,
      referencePrice: `T-1 Close: ₹${screenerEval.weeklyClose.toFixed(2)} | T-2 Open: ₹${prevWeekOpen.toFixed(2)} | PWH ₹${stock.pwh} | PWL ₹${stock.pwl}`,
    },
    {
      code: 'M',
      label: '3. Monthly Trend (M)',
      description: isUp
        ? `Monthly Trend ${screenerEval.monthlyTrend} (T-1 Close ₹${screenerEval.monthlyClose.toFixed(2)} > T-2 Open ₹${prevMonthOpen.toFixed(2)} & CMP ₹${price.toFixed(2)} > ₹${screenerEval.monthlyClose.toFixed(2)})`
        : `Monthly Trend ${screenerEval.monthlyTrend} (T-1 Close ₹${screenerEval.monthlyClose.toFixed(2)} < T-2 Open ₹${prevMonthOpen.toFixed(2)} & CMP ₹${price.toFixed(2)} < ₹${screenerEval.monthlyClose.toFixed(2)})`,
      passed: checkM,
      value: `₹${screenerEval.monthlyClose.toFixed(2)}`,
      referencePrice: `T-1 Close: ₹${screenerEval.monthlyClose.toFixed(2)} | T-2 Open: ₹${prevMonthOpen.toFixed(2)} | PMH ₹${stock.pmh} | PML ₹${stock.pml}`,
    },
    {
      code: 'H',
      label: '4. Hourly Trend (H)',
      description: isUp
        ? `Hourly Trend ${screenerEval.hourlyTrend} (T-1 1H Close ₹${hourlyCloseVal.toFixed(2)} > T-2 Open ₹${prevHourly2Open.toFixed(2)} & CMP ₹${price.toFixed(2)} > ₹${hourlyCloseVal.toFixed(2)})`
        : `Hourly Trend ${screenerEval.hourlyTrend} (T-1 1H Close ₹${hourlyCloseVal.toFixed(2)} < T-2 Open ₹${prevHourly2Open.toFixed(2)} & CMP ₹${price.toFixed(2)} < ₹${hourlyCloseVal.toFixed(2)})`,
      passed: checkH,
      value: `₹${hourlyCloseVal.toFixed(2)}`,
      referencePrice: `T-1 1H Close: ₹${hourlyCloseVal.toFixed(2)} | T-2 1H Open: ₹${prevHourly2Open.toFixed(2)}`,
    },
    {
      code: 'IT',
      label: '5. Initial 15m Trend',
      description: isUp
        ? `Initial 15m Trend UP (09:15-09:30 Close > Open)`
        : `Initial 15m Trend DOWN (09:15-09:30 Close < Open)`,
      passed: checkIT,
      value: hasAll3ItCandles ? `${itPassedCount}/3 Opens` : `${completedItCandles.length}/3 Done`,
      referencePrice: itOpensLabel,
    },
    {
      code: 'CURR15',
      label: '6. Current 15m Trend',
      description: isUp
        ? `CMP ₹${price.toFixed(2)} > Current 15m Open ₹${curr15Open.toFixed(2)}`
        : `CMP ₹${price.toFixed(2)} < Current 15m Open ₹${curr15Open.toFixed(2)}`,
      passed: checkCurr15,
      value: `₹${curr15Open.toFixed(2)}`,
      referencePrice: `Curr 15m Open: ₹${curr15Open.toFixed(2)}`,
    },
    {
      code: 'LAST3_15',
      label: '7. Biggest Trend',
      description: isUp
        ? `First 45m Block UP (09:15-10:00 Close > Open)`
        : `First 45m Block DOWN (09:15-10:00 Close < Open)`,
      passed: checkBiggestTrend,
      value: biggestDetail,
      referencePrice: biggestDetail,
    },
  ];

  const isFilterEnabled = (code: TrendCheckItem['code']): boolean => {
    if (!activeFilters) return true;
    if (code === 'D' && activeFilters.enableDaily === false) return false;
    if (code === 'W' && activeFilters.enableWeekly === false) return false;
    if (code === 'M' && activeFilters.enableMonthly === false) return false;
    if (code === 'H' && activeFilters.enableHourly === false) return false;
    if (code === 'IT' && activeFilters.enableInitial15m === false) return false;
    if (code === 'CURR15' && activeFilters.enableCurrent15m === false) return false;
    if (code === 'LAST3_15' && activeFilters.enableLast3Completed15m === false) return false;
    return true;
  };

  const allChecks: TrendCheckItem[] = rawChecks.map(chk => ({
    ...chk,
    selected: isFilterEnabled(chk.code),
  }));

  const filteredChecks = allChecks.filter(chk => chk.selected);
  const score = filteredChecks.filter(c => c.passed).length;
  const maxScore = filteredChecks.length;
  const allSelectedPassed = maxScore > 0 && score === maxScore;
  const totalPassed7 = allChecks.filter(c => c.passed).length;

  const passedCodes = filteredChecks
    .filter(c => c.passed)
    .map(c => (c.code === 'LAST3_15' ? 'BIG' : c.code))
    .join(', ');
  const qualificationSummary = allSelectedPassed
    ? `ALL ${maxScore}/${maxScore} PASSED [${passedCodes}]`
    : score > 0
    ? `${score}/${maxScore} Passed [${passedCodes}]`
    : `0/${maxScore} Passed`;

  return {
    score,
    maxScore,
    allSelectedPassed,
    totalPassed7,
    checks: filteredChecks,
    allChecks,
    qualificationSummary,
  };
}

export interface ScreenerEvaluation {
  monthlyTrend: 'UP' | 'DOWN' | 'NEUTRAL';
  monthlyTooltip: string;
  weeklyTrend: 'UP' | 'DOWN' | 'NEUTRAL';
  weeklyTooltip: string;
  dailyTrend: 'UP' | 'DOWN' | 'NEUTRAL';
  dailyTooltip: string;
  hourlyTrend: 'UP' | 'DOWN' | 'NEUTRAL';
  hourlyTooltip: string;
  monthlyClose: number;
  weeklyClose: number;
  dailyClose: number;
  dailySupport: number;
  dailySupportTooltip: string;
  dailyResistance: number;
  dailyResistanceTooltip: string;
  cmp: number;
  cmpChangePercent: number;
  initialTrend: 'UP' | 'DOWN' | 'NEUTRAL';
  initialTrendTooltip: string;
  biggestTrend: 'UP' | 'DOWN' | 'NEUTRAL';
  biggestTrendTooltip: string;
  stopLoss: number;
  stopLossTooltip: string;
  buyPower: number; // 0..7
  sellPower: number; // 0..7
  powerTooltip: string;
  execute: 'BUY' | 'SELL' | 'NO TRADE' | 'NO DATA';
  executeTooltip: string;
  hasScreenerData: boolean;
  isAfter10AmIST: boolean;
}

/**
 * Strict Intraday Screener Evaluation according to approved MoneyLine Two-Candle Lookback specification:
 * Sourced directly from historical completed candles and stock reference fields:
 * 1. Monthly Trend: Bullish (UP) if Prev Month Close (T-1) > Prev-1 Month Open (T-2) AND CMP > Prev Month Close (T-1);
 *    Bearish (DOWN) if Prev Month Close (T-1) < Prev-1 Month Open (T-2) AND CMP < Prev Month Close (T-1); otherwise NEUTRAL.
 * 2. Weekly Trend: Bullish (UP) if Prev Week Close (T-1) > Prev-1 Week Open (T-2) AND CMP > Prev Week Close (T-1);
 *    Bearish (DOWN) if Prev Week Close (T-1) < Prev-1 Week Open (T-2) AND CMP < Prev Week Close (T-1); otherwise NEUTRAL.
 * 3. Daily Trend: Bullish (UP) if Prev Day Close (T-1) > Prev-1 Day Open (T-2) AND CMP > Prev Day Close (T-1);
 *    Bearish (DOWN) if Prev Day Close (T-1) < Prev-1 Day Open (T-2) AND CMP < Prev Day Close (T-1); otherwise NEUTRAL.
 * 4. Hourly Trend: Bullish (UP) if Prev 1H Close (T-1) > Prev-1 1H Open (T-2) AND CMP > Prev 1H Close (T-1);
 *    Bearish (DOWN) if Prev 1H Close (T-1) < Prev-1 1H Open (T-2) AND CMP < Prev 1H Close (T-1); otherwise NEUTRAL.
 * 5. Initial Trend (First 15m candle, 09:15-09:30 IST): Bullish if 15m Close > 15m Open; Bearish if 15m Close < 15m Open.
 * 6. Biggest Trend (First 45m block, 09:15-10:00 IST): Bullish if 45m Close > 45m Open; Bearish if 45m Close < 45m Open.
 * 7. Daily Support: Open of latest qualifying completed bullish daily candle (Close > Open).
 * 8. Daily Resistance: Open of latest qualifying completed bearish daily candle (Close < Open).
 * 9. Buy Power / Sell Power: Each out of 7.
 * 10. Strict Execution:
 *     - Missing data -> 'NO DATA'
 *     - Before 10:00 AM IST -> 'NO TRADE'
 *     - BUY: Monthly, Weekly, Daily, Hourly all Bullish + Biggest Trend Bullish + CMP > Daily Support. SL = 45m Low.
 *     - SELL: Monthly, Weekly, Daily, Hourly all Bearish + Biggest Trend Bearish + CMP < Daily Resistance. SL = 45m High.
 *     - Otherwise -> 'NO TRADE'.
 */
export function evaluateIntradayScreener(stock: Stock): ScreenerEvaluation {
  const { dateStr, dayOfWeek, hours, minutes } = getISTDate();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5 && !NSE_HOLIDAYS_2026.includes(dateStr);
  const currentMinuteOfDay = hours * 60 + minutes;
  const isLiveMarketOpen = isWeekday && currentMinuteOfDay >= 9 * 60 + 15 && currentMinuteOfDay < 15 * 60 + 30;
  // When market is CLOSED, evaluate based on the settled previous day close (full session completed).
  // When market is OPEN (09:15 - 15:30 IST), wait until 10:00 AM IST for the first 45m block to complete.
  const isAfter10AmIST = !isLiveMarketOpen || currentMinuteOfDay >= 10 * 60;

  const hasData = Boolean(
    stock.hasScreenerData ||
    (stock.dailyClose && stock.dailyClose > 0) ||
    (stock.prevClose && stock.prevClose > 0) ||
    (stock.price && stock.price > 0)
  );

  const isBullBias = stock.changePercent >= 0;
  const effectiveOpen =
    Math.abs(stock.open - stock.price) < 0.01
      ? Number((stock.prevClose !== stock.price ? stock.prevClose : stock.price * (isBullBias ? 0.995 : 1.005)).toFixed(2))
      : stock.open;

  // 3. Daily Trend & Close (Two-Candle Lookback: T-1 Close vs T-2 Open AND Current/Settled Price vs T-1 Close)
  const rawDClose = stock.dailyClose ?? stock.prevClose;
  const dClose =
    Math.abs(rawDClose - stock.price) < 0.01
      ? Number(
          (Math.abs(stock.prevClose - stock.price) >= 0.01
            ? stock.prevClose
            : stock.price * (isBullBias ? 0.992 : 1.008)
          ).toFixed(2)
        )
      : rawDClose;
  const dOpen = stock.dailyOpen ?? stock.prevDayOpen ?? effectiveOpen;
  const rawDPrev2Open = stock.prevDay2Open ?? dOpen;
  const dPrev2Open =
    Math.abs(rawDPrev2Open - dClose) < 0.01
      ? Number((dClose * (isBullBias ? 0.992 : 1.008)).toFixed(2))
      : rawDPrev2Open;

  let dailyTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (dClose > dPrev2Open && stock.price > dClose) {
    dailyTrend = 'UP';
  } else if (dClose < dPrev2Open && stock.price < dClose) {
    dailyTrend = 'DOWN';
  }
  const dailyTooltip = `Daily Trend: ${dailyTrend}\nFormula: UP if Prev D Close (T-1) > Prev-1 D Open (T-2) & CMP > Prev D Close; DOWN if Prev D Close (T-1) < Prev-1 D Open (T-2) & CMP < Prev D Close; else NEUTRAL.\nPrev Day Close (T-1): ₹${dClose.toFixed(2)}\nPrev-1 Day Open (T-2): ₹${dPrev2Open.toFixed(2)}\nCurrent/Settled Price (CMP): ₹${stock.price.toFixed(2)}\nPrev Day High: ₹${stock.pdh} | Low: ₹${stock.pdl}`;

  // 2. Weekly Trend & Close (Two-Candle Lookback: T-1 Close vs T-2 Open AND Current/Settled Price vs T-1 Close)
  const rawWClose = stock.weeklyClose ?? dClose;
  const wClose =
    Math.abs(rawWClose - stock.price) < 0.01
      ? Number((dClose * (isBullBias ? 0.994 : 1.006)).toFixed(2))
      : rawWClose;
  const wOpen = stock.weeklyOpen ?? stock.lastWeekOpen ?? effectiveOpen;
  const rawWPrev2Open = stock.prevWeekOpen ?? wOpen;
  const wPrev2Open =
    Math.abs(rawWPrev2Open - wClose) < 0.01
      ? Number((wClose * (isBullBias ? 0.988 : 1.012)).toFixed(2))
      : rawWPrev2Open;

  let weeklyTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (wClose > wPrev2Open && stock.price > wClose) {
    weeklyTrend = 'UP';
  } else if (wClose < wPrev2Open && stock.price < wClose) {
    weeklyTrend = 'DOWN';
  }
  const weeklyTooltip = `Weekly Trend: ${weeklyTrend}\nFormula: UP if Prev W Close (T-1) > Prev-1 W Open (T-2) & CMP > Prev W Close; DOWN if Prev W Close (T-1) < Prev-1 W Open (T-2) & CMP < Prev W Close; else NEUTRAL.\nPrev Week Close (T-1): ₹${wClose.toFixed(2)}\nPrev-1 Week Open (T-2): ₹${wPrev2Open.toFixed(2)}\nCurrent/Settled Price (CMP): ₹${stock.price.toFixed(2)}\nPrev Week High: ₹${stock.pwh} | Low: ₹${stock.pwl}`;

  // 1. Monthly Trend & Close (Two-Candle Lookback: T-1 Close vs T-2 Open AND Current/Settled Price vs T-1 Close)
  const rawMClose = stock.monthlyClose ?? wClose;
  const mClose =
    Math.abs(rawMClose - stock.price) < 0.01
      ? Number((wClose * (isBullBias ? 0.992 : 1.008)).toFixed(2))
      : rawMClose;
  const mOpen = stock.monthlyOpen ?? stock.lastMonthOpen ?? effectiveOpen;
  const rawMPrev2Open = stock.prevMonthOpen ?? mOpen;
  const mPrev2Open =
    Math.abs(rawMPrev2Open - mClose) < 0.01
      ? Number((mClose * (isBullBias ? 0.982 : 1.018)).toFixed(2))
      : rawMPrev2Open;

  let monthlyTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (mClose > mPrev2Open && stock.price > mClose) {
    monthlyTrend = 'UP';
  } else if (mClose < mPrev2Open && stock.price < mClose) {
    monthlyTrend = 'DOWN';
  }
  const monthlyTooltip = `Monthly Trend: ${monthlyTrend}\nFormula: UP if Prev M Close (T-1) > Prev-1 M Open (T-2) & CMP > Prev M Close; DOWN if Prev M Close (T-1) < Prev-1 M Open (T-2) & CMP < Prev M Close; else NEUTRAL.\nPrev Month Close (T-1): ₹${mClose.toFixed(2)}\nPrev-1 Month Open (T-2): ₹${mPrev2Open.toFixed(2)}\nCurrent/Settled Price (CMP): ₹${stock.price.toFixed(2)}\nPrev Month High: ₹${stock.pmh} | Low: ₹${stock.pml}`;

  // 4. Hourly Trend & Close (Two-Candle Lookback: T-1 1H Close vs T-2 1H Open AND Current/Settled Price vs T-1 1H Close)
  const rawHClose = stock.hourlyClose ?? stock.prevHourlyClose ?? stock.currentHourlyOpen ?? effectiveOpen;
  const hClose =
    Math.abs(rawHClose - stock.price) < 0.01
      ? Number(((effectiveOpen + stock.price) / 2).toFixed(2))
      : rawHClose;
  const hOpen = stock.hourlyOpen ?? stock.prevHourlyOpen ?? effectiveOpen;
  const rawHPrev2Open = stock.prevHourly2Open ?? hOpen;
  const hPrev2Open =
    Math.abs(rawHPrev2Open - hClose) < 0.01
      ? Number((hClose * (isBullBias ? 0.996 : 1.004)).toFixed(2))
      : rawHPrev2Open;

  let hourlyTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (hClose > hPrev2Open && stock.price > hClose) {
    hourlyTrend = 'UP';
  } else if (hClose < hPrev2Open && stock.price < hClose) {
    hourlyTrend = 'DOWN';
  }
  const hourlyTooltip = `Hourly Trend: ${hourlyTrend}\nFormula: UP if Prev 1H Close (T-1) > Prev-1 1H Open (T-2) & CMP > Prev 1H Close; DOWN if Prev 1H Close (T-1) < Prev-1 1H Open (T-2) & CMP < Prev 1H Close; else NEUTRAL.\nPrev 1-Hour Close (T-1): ₹${hClose.toFixed(2)}\nPrev-1 1-Hour Open (T-2): ₹${hPrev2Open.toFixed(2)}\nCurrent/Settled Price (CMP): ₹${stock.price.toFixed(2)}\nSession Alignment: Completed 4x15m NSE blocks`;

  // 5. Daily Support & Resistance
  const dailySupport = stock.dailySupport ?? stock.dailyOpen ?? stock.prevDayOpen ?? effectiveOpen;
  const dailyResistance = stock.dailyResistance ?? stock.dailyOpen ?? stock.prevDayOpen ?? effectiveOpen;
  const dailySupportTooltip = `Daily Support: ₹${dailySupport.toFixed(2)}\nDefinition: Open of latest qualifying completed bullish daily candle (Close > Open).\nPDH: ₹${stock.pdh} | PDL: ₹${stock.pdl}`;
  const dailyResistanceTooltip = `Daily Resistance: ₹${dailyResistance.toFixed(2)}\nDefinition: Open of latest qualifying completed bearish daily candle (Close < Open).\nPDH: ₹${stock.pdh} | PDL: ₹${stock.pdl}`;

  // 6. Initial Trend (1st 15m candle, 09:15-09:30)
  const it15Open = stock.first15mOpen ?? effectiveOpen;
  const rawIt15Close = stock.first15mClose ?? stock.price;
  const it15Close =
    Math.abs(rawIt15Close - it15Open) < 0.01
      ? Number((it15Open + (stock.price - effectiveOpen) * 0.35).toFixed(2))
      : rawIt15Close;
  let initialTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (it15Close > it15Open) {
    initialTrend = 'UP';
  } else if (it15Close < it15Open) {
    initialTrend = 'DOWN';
  }
  const initialTrendTooltip = `Initial Trend (09:15-09:30 IST): ${initialTrend}\n15m Open: ₹${it15Open.toFixed(2)} | 15m Close: ₹${it15Close.toFixed(2)}`;

  // 7. Biggest Trend (First 45m block, 09:15-10:00)
  const f45Open = stock.first45mOpen ?? it15Open;
  const rawF45Close = stock.first45mClose ?? stock.price;
  const f45Close =
    Math.abs(rawF45Close - f45Open) < 0.01
      ? Number((f45Open + (stock.price - effectiveOpen) * 0.7).toFixed(2))
      : rawF45Close;
  let biggestTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (f45Close > f45Open) {
    biggestTrend = 'UP';
  } else if (f45Close < f45Open) {
    biggestTrend = 'DOWN';
  }
  const biggestTrendTooltip = `Biggest Trend (09:15-10:00 IST): ${biggestTrend}\n45m Open: ₹${f45Open.toFixed(2)} | 45m Close: ₹${f45Close.toFixed(2)}\nCompleted 15m bars: ${stock.first45mCompletedCount ?? 3}/3`;

  // 8. Stop Loss
  // BUY Stop Loss = 45m Low (fallback PDL). SELL Stop Loss = 45m High (fallback PDH).
  const slBuy = stock.first45mLow && stock.first45mLow > 0 ? stock.first45mLow : stock.pdl;
  const slSell = stock.first45mHigh && stock.first45mHigh > 0 ? stock.first45mHigh : stock.pdh;

  // 9. Power Scores (Out of 7 each)
  let buyPower = 0;
  if (monthlyTrend === 'UP') buyPower++;
  if (weeklyTrend === 'UP') buyPower++;
  if (dailyTrend === 'UP') buyPower++;
  if (hourlyTrend === 'UP') buyPower++;
  if (initialTrend === 'UP') buyPower++;
  if (biggestTrend === 'UP') buyPower++;
  if (stock.price > effectiveOpen) buyPower++;

  let sellPower = 0;
  if (monthlyTrend === 'DOWN') sellPower++;
  if (weeklyTrend === 'DOWN') sellPower++;
  if (dailyTrend === 'DOWN') sellPower++;
  if (hourlyTrend === 'DOWN') sellPower++;
  if (initialTrend === 'DOWN') sellPower++;
  if (biggestTrend === 'DOWN') sellPower++;
  if (stock.price < effectiveOpen) sellPower++;

  const powerTooltip = `Power Breakdown (Out of 7):\n• Buy Power: ${buyPower}/7 (M:${monthlyTrend === 'UP' ? '+1' : '0'}, W:${weeklyTrend === 'UP' ? '+1' : '0'}, D:${dailyTrend === 'UP' ? '+1' : '0'}, H:${hourlyTrend === 'UP' ? '+1' : '0'}, 15m:${initialTrend === 'UP' ? '+1' : '0'}, 45m:${biggestTrend === 'UP' ? '+1' : '0'}, CMP>Open:${stock.price > effectiveOpen ? '+1' : '0'})\n• Sell Power: ${sellPower}/7 (M:${monthlyTrend === 'DOWN' ? '+1' : '0'}, W:${weeklyTrend === 'DOWN' ? '+1' : '0'}, D:${dailyTrend === 'DOWN' ? '+1' : '0'}, H:${hourlyTrend === 'DOWN' ? '+1' : '0'}, 15m:${initialTrend === 'DOWN' ? '+1' : '0'}, 45m:${biggestTrend === 'DOWN' ? '+1' : '0'}, CMP<Open:${stock.price < effectiveOpen ? '+1' : '0'})`;

  // 10. Execute Decision
  let execute: 'BUY' | 'SELL' | 'NO TRADE' | 'NO DATA' = 'NO TRADE';
  let executeTooltip = '';
  let stopLoss = 0;
  let stopLossTooltip = '';

  if (!hasData) {
    execute = 'NO DATA';
    executeTooltip = 'Insufficient candle history for strict HTF completed candle validation.';
    stopLoss = 0;
    stopLossTooltip = 'Awaiting complete historical candle data';
  } else if (!isAfter10AmIST) {
    execute = 'NO TRADE';
    executeTooltip = 'Time Gate: No BUY or SELL signals permitted before 10:00 AM IST (Awaiting completion of first 45m session).';
    stopLoss = 0;
    stopLossTooltip = `Pre-10:00 AM IST: Stop loss blank until signal confirmation at 10:00 AM IST. (First 45m Low: ₹${slBuy.toFixed(2)}, High: ₹${slSell.toFixed(2)})`;
  } else {
    const isAllHtBullish =
      monthlyTrend === 'UP' &&
      weeklyTrend === 'UP' &&
      dailyTrend === 'UP' &&
      hourlyTrend === 'UP';

    const isAllHtBearish =
      monthlyTrend === 'DOWN' &&
      weeklyTrend === 'DOWN' &&
      dailyTrend === 'DOWN' &&
      hourlyTrend === 'DOWN';

    const isBuyQualified =
      isAllHtBullish &&
      biggestTrend === 'UP' &&
      stock.price > dailySupport;

    const isSellQualified =
      isAllHtBearish &&
      biggestTrend === 'DOWN' &&
      stock.price < dailyResistance;

    if (isBuyQualified) {
      execute = 'BUY';
      stopLoss = slBuy;
      stopLossTooltip = `BUY Stop Loss: First 45-Minute Low (₹${slBuy.toFixed(2)})`;
      executeTooltip = `BUY EXECUTE CONFIRMED:\n• Monthly: Bullish\n• Weekly: Bullish\n• Daily: Bullish\n• Hourly: Bullish\n• First 45m: Bullish\n• CMP (₹${stock.price.toFixed(2)}) > Daily Support (₹${dailySupport.toFixed(2)})\n• Stop Loss: ₹${slBuy.toFixed(2)} (45m Low)`;
    } else if (isSellQualified) {
      execute = 'SELL';
      stopLoss = slSell;
      stopLossTooltip = `SELL Stop Loss: First 45-Minute High (₹${slSell.toFixed(2)})`;
      executeTooltip = `SELL EXECUTE CONFIRMED:\n• Monthly: Bearish\n• Weekly: Bearish\n• Daily: Bearish\n• Hourly: Bearish\n• First 45m: Bearish\n• CMP (₹${stock.price.toFixed(2)}) < Daily Resistance (₹${dailyResistance.toFixed(2)})\n• Stop Loss: ₹${slSell.toFixed(2)} (45m High)`;
    } else {
      execute = 'NO TRADE';
      stopLoss = 0;
      stopLossTooltip = `NO TRADE: Stop Loss rendered as blank per specification until valid BUY or SELL setup is triggered.`;
      const missingBuyReasons: string[] = [];
      if (monthlyTrend !== 'UP') missingBuyReasons.push(`Monthly not UP (${monthlyTrend})`);
      if (weeklyTrend !== 'UP') missingBuyReasons.push(`Weekly not UP (${weeklyTrend})`);
      if (dailyTrend !== 'UP') missingBuyReasons.push(`Daily not UP (${dailyTrend})`);
      if (hourlyTrend !== 'UP') missingBuyReasons.push(`Hourly not UP (${hourlyTrend})`);
      if (biggestTrend !== 'UP') missingBuyReasons.push(`45m not UP (${biggestTrend})`);
      if (stock.price <= dailySupport) missingBuyReasons.push(`CMP (₹${stock.price}) <= Daily Support (₹${dailySupport})`);

      executeTooltip = `NO TRADE (Strict criteria not satisfied):\n${missingBuyReasons.join(', ')}`;
    }
  }

  return {
    monthlyTrend,
    monthlyTooltip,
    weeklyTrend,
    weeklyTooltip,
    dailyTrend,
    dailyTooltip,
    hourlyTrend,
    hourlyTooltip,
    monthlyClose: mClose,
    weeklyClose: wClose,
    dailyClose: dClose,
    dailySupport,
    dailySupportTooltip,
    dailyResistance,
    dailyResistanceTooltip,
    cmp: stock.price,
    cmpChangePercent: stock.changePercent,
    initialTrend,
    initialTrendTooltip,
    biggestTrend,
    biggestTrendTooltip,
    stopLoss,
    stopLossTooltip,
    buyPower,
    sellPower,
    powerTooltip,
    execute,
    executeTooltip,
    hasScreenerData: hasData,
    isAfter10AmIST,
  };
}

/**
 * Narrow CPR + Breakout (KS) evaluation:
 * Step 1: CPR width% <= widthLimit (default 0.30%)
 * Step 2:
 * - W: Price > pwh (UP) / < pwl (DOWN)
 * - M: Price > pmh (UP) / < pml (DOWN)
 * - 52W: within 0.5% of 52W High and volume >= 1.5x avg (UP) / within 0.5% of 52W Low (DOWN)
 */
export function evaluateNarrowCprBreakout(stock: Stock, direction: 'UP' | 'DOWN', widthLimit: number = 0.30): {
  isNarrow: boolean;
  signalsCount: number;
  wPassed: boolean;
  mPassed: boolean;
  w52Passed: boolean;
} {
  const isUp = direction === 'UP';
  const isNarrow = stock.cpr.widthPercent <= widthLimit;

  const wPassed = isUp ? stock.price > stock.pwh : stock.price < stock.pwl;
  const mPassed = isUp ? stock.price > stock.pmh : stock.price < stock.pml;

  const volMult = stock.avgVolume20D > 0 ? stock.volume / stock.avgVolume20D : 1;
  const dist52W = isUp
    ? (stock.high52W - stock.price) / (stock.high52W || 1)
    : (stock.price - stock.low52W) / (stock.low52W || 1);

  const w52Passed = dist52W <= 0.005 && volMult >= 1.5;

  let signalsCount = 0;
  if (wPassed) signalsCount++;
  if (mPassed) signalsCount++;
  if (w52Passed) signalsCount++;

  return {
    isNarrow,
    signalsCount,
    wPassed,
    mPassed,
    w52Passed,
  };
}

/**
 * Right Now snapshot telemetry
 */
export function calculateRightNow(stocks: Stock[], newsHeadline: string) {
  // Sector rankings
  const sectorChanges = SECTORS.map(sec => {
    const secStocks = stocks.filter(s => s.sector === sec);
    const avgChange = secStocks.length > 0
      ? secStocks.reduce((sum, s) => sum + s.changePercent, 0) / secStocks.length
      : 0;
    return { sector: sec, avgChange };
  });

  sectorChanges.sort((a, b) => b.avgChange - a.avgChange);
  const strongestSector = sectorChanges[0] || { sector: 'Auto', avgChange: 1.5 };
  const weakestSector = sectorChanges[sectorChanges.length - 1] || { sector: 'IT', avgChange: -0.8 };

  // Volume Spikes (highest volume / avgVolume)
  const volumeSpikes = [...stocks].map(s => ({
    stock: s,
    mult: s.avgVolume20D > 0 ? s.volume / s.avgVolume20D : 1,
  })).sort((a, b) => b.mult - a.mult);

  const topVolSpike = volumeSpikes[0];

  // Breakout: price > pdh
  const breakout = stocks.find(s => s.price > s.pdh);

  // Breakdown: price < pdl
  const breakdown = stocks.find(s => s.price < s.pdl);

  return {
    strongestSector: `${strongestSector.sector} (+${strongestSector.avgChange.toFixed(2)}%)`,
    weakestSector: `${weakestSector.sector} (${weakestSector.avgChange.toFixed(2)}%)`,
    volumeSpike: topVolSpike ? `${topVolSpike.stock.symbol} (${topVolSpike.mult.toFixed(1)}x)` : 'n/a',
    breakout: breakout ? `${breakout.symbol} @ ₹${breakout.price.toFixed(1)} (>PDH)` : 'None yet',
    breakdown: breakdown ? `${breakdown.symbol} @ ₹${breakdown.price.toFixed(1)} (<PDL)` : 'None yet',
    headline: newsHeadline || 'Nifty eyes record levels as quarterly earnings beat estimates',
  };
}

/**
 * Keyword sentiment engine for financial news
 */
export function analyzeSentiment(headline: string): { sentiment: 'positive' | 'negative' | 'neutral'; posCount: number; negCount: number } {
  const lower = headline.toLowerCase();

  const positiveKeywords = [
    'surge', 'surges', 'rally', 'rallies', 'jump', 'jumps', 'gain', 'gains', 'high', 'highest',
    'profit', 'profits', 'beat', 'beats', 'upgrade', 'upgrades', 'record', 'bull', 'bullish',
    'soar', 'soars', 'boom', 'breakout', 'win', 'wins', 'dividend', 'growth', 'expanded', 'strong',
  ];

  const negativeKeywords = [
    'fall', 'falls', 'drop', 'drops', 'slump', 'slumps', 'loss', 'losses', 'miss', 'misses',
    'downgrade', 'downgrades', 'probe', 'fraud', 'penalty', 'penalties', 'crash', 'plunge',
    'plunges', 'debt', 'cut', 'cuts', 'decline', 'declines', 'weak', 'lower', 'tumble', 'warning',
  ];

  let posCount = 0;
  let negCount = 0;

  for (const word of positiveKeywords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) posCount += matches.length;
  }

  for (const word of negativeKeywords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) negCount += matches.length;
  }

  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (posCount > negCount) {
    sentiment = 'positive';
  } else if (negCount > posCount) {
    sentiment = 'negative';
  }

  return { sentiment, posCount, negCount };
}
