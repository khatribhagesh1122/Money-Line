import { Stock, OptionRecommendation, OptionAction } from '../types/market';
import { calculateRoundStrike } from './marketCalculators';

// Standard NSE F&O Lot Sizes (Verified against Upstox NSE_FO Master)
export const NSE_FO_LOT_SIZES: Record<string, number> = {
  NIFTY: 25,
  BANKNIFTY: 15,
  FINNIFTY: 25,
  MIDCPNIFTY: 50,
  RELIANCE: 500,
  TCS: 225,
  HDFCBANK: 750,
  ICICIBANK: 700,
  INFY: 400,
  SBIN: 750,
  BHARTIARTL: 475,
  ITC: 1725,
  LT: 175,
  TMPV: 1600,
  TATAMOTORS: 1600,
  ETERNAL: 2425,
  ZOMATO: 2425,
  TATASTEEL: 2750,
  MARUTI: 50,
  AXISBANK: 625,
  KOTAKBANK: 2000,
  BAJFINANCE: 750,
  'M&M': 200,
  TITAN: 175,
  SUNPHARMA: 350,
  ASIANPAINT: 250,
  HINDUNILVR: 300,
  DLF: 950,
  TRENT: 225,
  BEL: 1425,
  HAL: 150,
  JIOFIN: 2350,
  POLICYBZR: 350,
  PAYTM: 725,
  NYKAA: 3125,
  ADANIENT: 300,
  ADANIPORTS: 400,
  NTPC: 1500,
  POWERGRID: 1800,
  COALINDIA: 2100,
  ONGC: 3850,
  HCLTECH: 350,
  WIPRO: 1500,
  TECHM: 600,
  VEDL: 1150,
  JSWSTEEL: 675,
  HINDALCO: 1400,
  ULTRACEMCO: 100,
  GRASIM: 275,
  BAJAJFINSV: 500,
  HEROMOTOCO: 150,
  EICHERMOT: 175,
  DIVISLAB: 100,
  CIPLA: 650,
  DRREDDY: 125,
  APOLLOHOSP: 125,
  CHOLAFIN: 625,
  BHEL: 2625,
  GODREJCP: 500,
  PIDILITIND: 250,
};

export interface LiveOptionChainStrikeData {
  symbol: string;
  strikePrice: number;
  optionType: 'CE' | 'PE';
  expiryDate: string;
  ltp: number;
  iv: number | null;
  oi: number | null;
  oiChangePercent: number | null;
  volume: number | null;
  delta: number | null;
  dataSource: string;
  providerTimestamp: string;
}

const liveOptionChainStrikeCache = new Map<string, LiveOptionChainStrikeData>();

export function registerLiveOptionStrikeData(data: LiveOptionChainStrikeData): void {
  const key = `${data.symbol.toUpperCase()}_${data.strikePrice}_${data.optionType}`;
  liveOptionChainStrikeCache.set(key, data);
  const symKey = `${data.symbol.toUpperCase()}_${data.optionType}`;
  liveOptionChainStrikeCache.set(symKey, data);
}

export function getCachedLiveOptionStrike(
  symbol: string,
  strikePrice: number,
  optionType: 'CE' | 'PE'
): LiveOptionChainStrikeData | null {
  const sym = symbol.toUpperCase();
  return (
    liveOptionChainStrikeCache.get(`${sym}_${strikePrice}_${optionType}`) ||
    liveOptionChainStrikeCache.get(`${sym}_${optionType}`) ||
    null
  );
}

/**
 * Get accurate lot size for any NSE F&O stock
 */
export function getLotSize(symbol: string, price: number, dynamicLotSize?: number): number {
  if (dynamicLotSize && dynamicLotSize > 0) {
    return dynamicLotSize;
  }
  const sym = symbol.toUpperCase().replace('.NS', '').trim();
  if (NSE_FO_LOT_SIZES[sym]) {
    return NSE_FO_LOT_SIZES[sym];
  }
  if (price <= 0) return 100;
  const approxLots = Math.round(700000 / price / 25) * 25;
  return Math.max(25, approxLots);
}

/**
 * Calculate the nearest NSE monthly expiry date (Last Thursday of the current month).
 */
export function getNseMonthlyExpiry(currentDate: Date = new Date()): { dateStr: string; label: string } {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  function getLastThursday(y: number, m: number): Date {
    const d = new Date(y, m + 1, 0);
    const day = d.getDay();
    const diff = day >= 4 ? day - 4 : day + 3;
    d.setDate(d.getDate() - diff);
    return d;
  }

  let expiry = getLastThursday(year, month);
  if (currentDate.getTime() > expiry.getTime() + 15.5 * 3600000) {
    expiry = getLastThursday(year, month + 1);
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayStr = expiry.getDate().toString().padStart(2, '0');
  const monthStr = months[expiry.getMonth()];
  const yearStr = expiry.getFullYear();

  return {
    dateStr: `${dayStr}-${monthStr}-${yearStr}`,
    label: `${dayStr} ${monthStr} ${yearStr}`,
  };
}

/**
 * Institutional options recommendation generator.
 * Uses genuine live option-chain data when available in cache; otherwise
 * explicitly marks spot-derived reference premiums as THEORETICAL_ESTIMATE
 * and returns null (N/A) for unavailable IV/OI/Delta instead of fabricating numbers.
 */
export function generateOptionRecommendation(
  stock: Stock,
  bullScore: number,
  bearScore: number
): OptionRecommendation | null {
  if (!stock.isFO) return null;

  const spot = stock.price;
  const expiry = getNseMonthlyExpiry();
  const lotSize = getLotSize(stock.symbol, spot, stock.lotSize);

  // Determine strike intervals based on price bracket
  let strikeStep = 50;
  if (spot < 150) strikeStep = 2.5;
  else if (spot < 300) strikeStep = 5;
  else if (spot < 700) strikeStep = 10;
  else if (spot < 1500) strikeStep = 20;
  else if (spot < 3000) strikeStep = 50;
  else if (spot < 7000) strikeStep = 100;
  else strikeStep = 250;

  const atmStrike = calculateRoundStrike(spot);
  const otmStrikeUp = Math.round((spot + strikeStep) / strikeStep) * strikeStep;
  const otmStrikeDown = Math.round((spot - strikeStep) / strikeStep) * strikeStep;

  let action: OptionAction;
  let optionType: 'CE' | 'PE';
  let direction: 'BULLISH' | 'BEARISH';
  let strikePrice: number;
  let style: 'MOMENTUM_DEBIT' | 'THETA_CREDIT' | 'BREAKDOWN_DEBIT' | 'REVERSAL_CREDIT';
  let rationale: string;
  let theoreticalRefLtp: number;
  let riskRewardRatio: string;

  const isStrongBull = bullScore >= 6 && stock.changePercent > 0.4 && stock.rsi14 >= 55;
  const isStrongBear = bearScore >= 6 && stock.changePercent < -0.4 && stock.rsi14 <= 45;

  if (isStrongBull || (bullScore >= bearScore && bullScore >= 5)) {
    action = 'BUY CALL';
    optionType = 'CE';
    direction = 'BULLISH';
    strikePrice = spot >= atmStrike ? otmStrikeUp : atmStrike;
    style = 'MOMENTUM_DEBIT';
    const basePercent = 0.025;
    theoreticalRefLtp = Math.max(0.5, Number((spot * basePercent).toFixed(2)));
    riskRewardRatio = '1:2.0';
    rationale = `Bullish breakout above 50 DMA with RSI ${stock.rsi14.toFixed(1)}. Call setup aligned with spot momentum.`;
  } else if (isStrongBear || (bearScore > bullScore && bearScore >= 5)) {
    action = 'BUY PUT';
    optionType = 'PE';
    direction = 'BEARISH';
    strikePrice = spot <= atmStrike ? otmStrikeDown : atmStrike;
    style = 'BREAKDOWN_DEBIT';
    const basePercent = 0.025;
    theoreticalRefLtp = Math.max(0.5, Number((spot * basePercent).toFixed(2)));
    riskRewardRatio = '1:2.0';
    rationale = `Bearish breakdown below support with volume expansion. Put setup aligned with downside momentum.`;
  } else if (stock.price > stock.cpr.p) {
    action = 'SELL PUT';
    optionType = 'PE';
    direction = 'BULLISH';
    strikePrice = Math.min(otmStrikeDown, calculateRoundStrike(stock.cpr.s1));
    style = 'REVERSAL_CREDIT';
    theoreticalRefLtp = Math.max(0.5, Number((spot * 0.014).toFixed(2)));
    riskRewardRatio = '1:1.8';
    rationale = `Support test at CPR BC (₹${stock.cpr.bc.toFixed(2)}). Put credit setup below support cushion.`;
  } else {
    action = 'SELL CALL';
    optionType = 'CE';
    direction = 'BEARISH';
    strikePrice = Math.max(otmStrikeUp, calculateRoundStrike(stock.cpr.r1));
    style = 'THETA_CREDIT';
    theoreticalRefLtp = Math.max(0.5, Number((spot * 0.013).toFixed(2)));
    riskRewardRatio = '1:1.8';
    rationale = `Resistance ceiling near CPR TC (₹${stock.cpr.tc.toFixed(2)}). Call credit setup above resistance.`;
  }

  // Check if live option-chain strike data is available from NSE/Upstox option chain feed
  const liveChain = getCachedLiveOptionStrike(stock.symbol, strikePrice, optionType);
  const hasLiveChain = Boolean(liveChain && liveChain.ltp > 0);
  if (liveChain && liveChain.strikePrice > 0) {
    strikePrice = liveChain.strikePrice;
  }

  const optionLtp = hasLiveChain ? liveChain!.ltp : theoreticalRefLtp;
  const isBuyer = action.startsWith('BUY');
  const entryLow = Number((optionLtp * (isBuyer ? 0.98 : 0.97)).toFixed(2));
  const entryHigh = Number((optionLtp * (isBuyer ? 1.02 : 1.03)).toFixed(2));
  const stopLoss = Number((optionLtp * (isBuyer ? 0.70 : 1.60)).toFixed(2));
  const target1 = Number((optionLtp * (isBuyer ? 1.50 : 0.50)).toFixed(2));
  const target2 = Number((optionLtp * (isBuyer ? 2.00 : 0.20)).toFixed(2));

  const expiryLabel = liveChain?.expiryDate || expiry.label;
  const contractSymbol = `${stock.symbol} ${expiryLabel.slice(0, 6).toUpperCase()} ${strikePrice} ${optionType}`;

  return {
    action,
    actionType: isBuyer ? 'BUY' : 'SELL',
    optionType,
    direction,
    strikePrice,
    expiryDate: expiryLabel,
    lotSize,
    spotPrice: spot,
    optionLtp,
    entryRange: `₹${entryLow.toFixed(2)} – ₹${entryHigh.toFixed(2)}`,
    entryLow,
    entryHigh,
    stopLoss,
    target1,
    target2,
    riskRewardRatio,
    liquidityRating: hasLiveChain
      ? (liveChain!.oi || 0) > 500000
        ? 'HIGH'
        : 'MEDIUM'
      : 'UNVERIFIED',
    openInterest: hasLiveChain ? liveChain!.oi : null,
    openInterestChangePercent: hasLiveChain ? liveChain!.oiChangePercent : null,
    impliedVolatility: hasLiveChain ? liveChain!.iv : null,
    delta: hasLiveChain ? liveChain!.delta : null,
    volume: hasLiveChain ? liveChain!.volume : null,
    rationale,
    strategyStyle: style,
    contractSymbol,
    optionDataSource: hasLiveChain
      ? liveChain!.dataSource
      : 'THEORETICAL ESTIMATE (Spot-Derived Reference)',
    freshnessStatus: hasLiveChain ? 'LIVE_POLL' : 'THEORETICAL_ESTIMATE',
    isTheoreticalEstimate: !hasLiveChain,
    providerTimestamp: hasLiveChain ? liveChain!.providerTimestamp : stock.providerTimestamp || null,
  };
}
