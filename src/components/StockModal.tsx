import React, { useState, useEffect, useMemo } from 'react';
import { Stock, ResultItem, NewsArticle } from '../types/market';
import {
  evaluateTrendScore,
  evaluateNarrowCprBreakout,
  evaluateIntradayScreener,
} from '../services/marketCalculators';
import {
  generateOptionRecommendation,
  getCachedLiveOptionStrike,
  LiveOptionChainStrikeData,
} from '../services/optionsEngine';
import {
  X,
  Star,
  Target,
  BarChart2,
  Zap,
  Layers,
  CheckCircle2,
  XCircle,
  Calendar,
  Newspaper,
  Users,
  ExternalLink,
} from 'lucide-react';

interface StockModalProps {
  stock: Stock | null;
  onClose: () => void;
  isWatchlisted: boolean;
  onToggleWatchlist: (symbol: string) => void;
  results?: ResultItem[];
  news?: NewsArticle[];
  allStocks?: Stock[];
  onSelectPeer?: (symbol: string) => void;
}

type ModalTab = 'chart' | 'technicals' | 'trading_plan' | 'options' | 'fundamentals';
type ChartTimeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '1D' | '1W' | '1M';

export const StockModal: React.FC<StockModalProps> = ({
  stock,
  onClose,
  isWatchlisted,
  onToggleWatchlist,
  results = [],
  news = [],
  allStocks = [],
  onSelectPeer,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('chart');
  const [chartTf, setChartTf] = useState<ChartTimeframe>('15m');
  const [chartType, setChartType] = useState<'candle' | 'area'>('candle');
  const [overlays, setOverlays] = useState({
    dma20: true,
    dma50: true,
    vwap: true,
    srLines: true,
  });

  const [liveOptionData, setLiveOptionData] = useState<LiveOptionChainStrikeData | null>(null);

  const screenerEval = useMemo(
    () => (stock ? evaluateIntradayScreener(stock) : null),
    [stock]
  );

  const isBullishBias = screenerEval
    ? screenerEval.buyPower >= screenerEval.sellPower
    : true;
  const dominantScore = screenerEval
    ? Math.max(screenerEval.buyPower, screenerEval.sellPower)
    : 5;

  const trendEval = useMemo(
    () =>
      stock
        ? evaluateTrendScore(stock, isBullishBias ? 'UP' : 'DOWN')
        : null,
    [stock, isBullishBias]
  );

  const cprEval = useMemo(
    () =>
      stock
        ? evaluateNarrowCprBreakout(stock, isBullishBias ? 'UP' : 'DOWN')
        : null,
    [stock, isBullishBias]
  );

  const baseOptRec = useMemo(() => {
    if (!stock || !screenerEval) return null;
    return generateOptionRecommendation(
      stock,
      screenerEval.buyPower,
      screenerEval.sellPower
    );
  }, [stock, screenerEval]);

  useEffect(() => {
    if (!stock || !stock.isFO || !baseOptRec) {
      setLiveOptionData(null);
      return;
    }
    const cached = getCachedLiveOptionStrike(
      stock.symbol,
      baseOptRec.strikePrice,
      baseOptRec.optionType
    );
    setLiveOptionData(cached);
  }, [stock?.symbol, baseOptRec?.strikePrice, baseOptRec?.optionType]);

  // Synthesize realistic multi-candle series anchored to real stock OHLC & sparks
  const chartCandles = useMemo(() => {
    if (!stock) return [];
    const points =
      stock.sparks && stock.sparks.length >= 6
        ? stock.sparks
        : [
            stock.prevClose,
            stock.open,
            (stock.open + stock.low) / 2,
            (stock.open + stock.high) / 2,
            stock.price * 0.998,
            stock.price,
          ];

    const count = 24;
    const candles: Array<{
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      label: string;
    }> = [];

    for (let i = 0; i < count; i++) {
      const idxFloat = (i / (count - 1)) * (points.length - 1);
      const idxLow = Math.floor(idxFloat);
      const idxHigh = Math.min(points.length - 1, Math.ceil(idxFloat));
      const frac = idxFloat - idxLow;
      const baseClose =
        points[idxLow] * (1 - frac) + points[idxHigh] * frac;
      const prevCloseVal =
        i === 0 ? stock.open || stock.prevClose : candles[i - 1].close;
      const spread = Math.max(stock.price * 0.0028, (stock.high - stock.low) / 14);
      const open = prevCloseVal;
      const close = i === count - 1 ? stock.price : baseClose;
      const high = Math.max(open, close) + spread * ((i % 3) * 0.35 + 0.25);
      const low = Math.min(open, close) - spread * (((i + 1) % 3) * 0.35 + 0.25);
      const vol = Math.round(
        (stock.volume / count) * (0.65 + ((i * 7) % 11) * 0.08)
      );
      candles.push({
        open,
        high,
        low,
        close,
        volume: vol,
        label: `${9 + Math.floor((15 + i * 15) / 60)}:${String(
          (15 + i * 15) % 60
        ).padStart(2, '0')}`,
      });
    }
    return candles;
  }, [stock, chartTf]);

  if (!stock || !trendEval || !screenerEval || !cprEval) return null;

  const optRec = baseOptRec
    ? liveOptionData
      ? {
          ...baseOptRec,
          strikePrice: liveOptionData.strikePrice || baseOptRec.strikePrice,
          expiryDate: liveOptionData.expiryDate || baseOptRec.expiryDate,
          optionLtp:
            liveOptionData.ltp > 0 ? liveOptionData.ltp : baseOptRec.optionLtp,
          openInterest: liveOptionData.oi,
          openInterestChangePercent: liveOptionData.oiChangePercent,
          impliedVolatility: liveOptionData.iv,
          delta: liveOptionData.delta,
          contractSymbol: `${stock.symbol} ${
            liveOptionData.expiryDate || baseOptRec.expiryDate
          } ${liveOptionData.strikePrice || baseOptRec.strikePrice} ${
            baseOptRec.optionType
          }`,
        }
      : baseOptRec
    : null;

  const isUp = stock.change >= 0;
  const volRatio =
    stock.avgVolume20D > 0 ? stock.volume / stock.avgVolume20D : 1;

  // Trading Plan Levels
  const slLevel =
    screenerEval.stopLoss > 0
      ? screenerEval.stopLoss
      : isBullishBias
      ? screenerEval.dailySupport || stock.pdl
      : screenerEval.dailyResistance || stock.pdh;
  const riskPts = Math.max(stock.price * 0.005, Math.abs(stock.price - slLevel));
  const target1Level = isBullishBias
    ? stock.price + riskPts * 1.5
    : stock.price - riskPts * 1.5;
  const target2Level = isBullishBias
    ? stock.price + riskPts * 2.5
    : stock.price - riskPts * 2.5;

  // Related results, news, and sector peers
  const stockResults = results.filter(
    r => r.symbol.toUpperCase() === stock.symbol.toUpperCase()
  );
  const stockNews = news.filter(
    n =>
      n.symbol?.toUpperCase() === stock.symbol.toUpperCase() ||
      n.title.toLowerCase().includes(stock.symbol.toLowerCase())
  );
  const sectorPeers = allStocks
    .filter(
      s =>
        s.sector.toLowerCase() === stock.sector.toLowerCase() &&
        s.symbol !== stock.symbol
    )
    .slice(0, 6);

  // Synthesize ATM Option Strike Chain rows for Options Tab
  const strikeStep =
    stock.price > 2500 ? 50 : stock.price > 1000 ? 20 : stock.price > 400 ? 10 : 5;
  const atmStrike = Math.round(stock.price / strikeStep) * strikeStep;
  const strikeChain = [-3, -2, -1, 0, 1, 2, 3].map(offset => {
    const strike = atmStrike + offset * strikeStep;
    const dist = (stock.price - strike) / strikeStep;
    const ceLtp = Math.max(2.5, stock.price * 0.018 + dist * strikeStep * 0.55);
    const peLtp = Math.max(2.5, stock.price * 0.018 - dist * strikeStep * 0.55);
    const ceOi = Math.round(180000 + Math.abs(offset - 1) * 65000);
    const peOi = Math.round(195000 + Math.abs(offset + 1) * 70000);
    return {
      strike,
      isAtm: offset === 0,
      ceLtp,
      peLtp,
      ceOi,
      peOi,
      ceIv: Number((18.5 + Math.abs(offset) * 1.1).toFixed(1)),
      peIv: Number((19.2 + Math.abs(offset) * 1.2).toFixed(1)),
    };
  });

  // Chart SVG dimensions
  const svgW = 760;
  const svgH = 260;
  const allPrices = chartCandles.flatMap(c => [c.high, c.low]);
  if (overlays.srLines) {
    allPrices.push(screenerEval.dailySupport, screenerEval.dailyResistance);
  }
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const priceSpan = Math.max(0.01, maxP - minP);
  const maxVol = Math.max(1, ...chartCandles.map(c => c.volume));

  const yForPrice = (p: number) =>
    20 + ((maxP - p) / priceSpan) * (svgH - 70);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0D1422] border border-white/10 rounded-2xl max-w-6xl w-full max-h-[92dvh] overflow-hidden shadow-[0_28px_80px_rgba(0,0,0,0.85)] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="p-3.5 sm:p-5 border-b border-white/[0.07] bg-[#080D16] flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 shrink-0">
          <div className="flex items-start gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
                  {stock.symbol}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#121C2D] text-[#21C8E8] border border-white/10 font-bold">
                  {stock.exchange || 'NSE'}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                    stock.isFO
                      ? 'bg-[#477DFF]/15 text-[#477DFF] border-[#477DFF]/30'
                      : 'bg-white/5 text-[#8B9BB4] border-white/10'
                  }`}
                >
                  {stock.isFO ? `F&O (LOT ${optRec?.lotSize || stock.lotSize || 250})` : 'CASH EQUITY'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#121C2D] text-[#8B9BB4] border border-white/10">
                  {stock.sector}
                </span>
                {screenerEval.execute === 'BUY' && (
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-[#00C995] text-[#080D16] font-black">
                    QUALIFIED BUY
                  </span>
                )}
                {screenerEval.execute === 'SELL' && (
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-[#FF526B] text-white font-black">
                    QUALIFIED SELL
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8B9BB4] mt-1">
                {stock.name} • Power Alignment:{' '}
                <span
                  className={`font-mono font-bold ${
                    isBullishBias ? 'text-[#00C995]' : 'text-[#FF526B]'
                  }`}
                >
                  {dominantScore}/7 {isBullishBias ? 'BULLISH' : 'BEARISH'}
                </span>
              </p>
            </div>
          </div>

          {/* Right: Prominent Price + Watchlist + Close */}
          <div className="flex items-center justify-between lg:justify-end gap-4">
            <div className="text-left lg:text-right font-mono tabular-nums">
              <div className="text-2xl sm:text-3xl font-extrabold text-white leading-none">
                ₹
                {stock.price.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div
                className={`text-xs font-bold mt-1 ${
                  isUp ? 'text-[#00C995]' : 'text-[#FF526B]'
                }`}
              >
                {isUp ? '+' : ''}
                {stock.change.toFixed(2)} ({isUp ? '+' : ''}
                {stock.changePercent.toFixed(2)}%)
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleWatchlist(stock.symbol)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isWatchlisted
                    ? 'bg-[#E9B949]/15 border-[#E9B949]/40 text-[#E9B949]'
                    : 'bg-[#121C2D] border-white/10 text-[#8B9BB4] hover:text-white'
                }`}
              >
                <Star
                  className={`w-4 h-4 ${isWatchlisted ? 'fill-[#E9B949]' : ''}`}
                />
                <span className="hidden sm:inline">
                  {isWatchlisted ? 'Watchlisted' : 'Watchlist'}
                </span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-[#121C2D] hover:bg-[#1A2639] text-[#8B9BB4] hover:text-white border border-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-3.5 sm:px-5 py-2.5 bg-[#080D16]/60 border-b border-white/[0.07] flex items-center gap-1.5 overflow-x-auto shrink-0">
          {[
            { id: 'chart', label: '1. Overview & Chart', icon: BarChart2 },
            {
              id: 'technicals',
              label: '2. 7-Param Alignment & Reference H/L',
              icon: Layers,
            },
            {
              id: 'trading_plan',
              label: '3. Trading Plan & Levels',
              icon: Target,
            },
            {
              id: 'options',
              label: '4. Options Intelligence & Chain',
              icon: Zap,
            },
            {
              id: 'fundamentals',
              label: '5. Earnings, News & Peers',
              icon: Calendar,
            },
          ].map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as ModalTab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#477DFF] text-white shadow-[0_4px_14px_rgba(71,125,255,0.35)]'
                    : 'text-[#8B9BB4] hover:bg-[#121C2D] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* SCROLLABLE BODY */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-5 flex-1 min-h-0">
          {/* TAB 1: OVERVIEW & INTERACTIVE MULTI-TIMEFRAME CHART */}
          {activeTab === 'chart' && (
            <div className="space-y-5">
              {/* Key Price Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 font-mono tabular-nums">
                {[
                  { label: 'OPEN', val: `₹${stock.open.toFixed(2)}`, color: 'text-white' },
                  { label: 'DAY HIGH', val: `₹${stock.high.toFixed(2)}`, color: 'text-[#00C995]' },
                  { label: 'DAY LOW', val: `₹${stock.low.toFixed(2)}`, color: 'text-[#FF526B]' },
                  { label: 'PREV CLOSE', val: `₹${stock.prevClose.toFixed(2)}`, color: 'text-slate-300' },
                  {
                    label: 'VOLUME',
                    val: `${(stock.volume / 100000).toFixed(2)}L`,
                    color: 'text-white',
                  },
                  {
                    label: 'REL VOLUME',
                    val: `${volRatio.toFixed(2)}x`,
                    color: volRatio >= 1.5 ? 'text-[#E9B949]' : 'text-[#21C8E8]',
                  },
                  {
                    label: '52W HIGH',
                    val: `₹${stock.high52W.toFixed(1)}`,
                    color: 'text-[#00C995]',
                  },
                  {
                    label: '52W LOW',
                    val: `₹${stock.low52W.toFixed(1)}`,
                    color: 'text-[#FF526B]',
                  },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl bg-[#121C2D] border border-white/[0.06]"
                  >
                    <span className="text-[9px] text-[#8B9BB4] block">{stat.label}</span>
                    <span className={`text-xs font-extrabold mt-0.5 block ${stat.color}`}>
                      {stat.val}
                    </span>
                  </div>
                ))}
              </div>

              {/* Interactive Multi-Timeframe Chart Box */}
              <div className="bg-[#080D16] border border-white/[0.08] rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
                  {/* Timeframe Selector */}
                  <div className="flex items-center gap-1 bg-[#121C2D] p-1 rounded-xl border border-white/[0.06]">
                    {(['1m', '5m', '15m', '30m', '1H', '1D', '1W', '1M'] as ChartTimeframe[]).map(
                      tf => (
                        <button
                          key={tf}
                          onClick={() => setChartTf(tf)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                            chartTf === tf
                              ? 'bg-[#477DFF] text-white'
                              : 'text-[#8B9BB4] hover:text-white'
                          }`}
                        >
                          {tf}
                        </button>
                      )
                    )}
                  </div>

                  {/* Chart Type & Indicator Overlays */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#121C2D] p-1 rounded-xl border border-white/[0.06] text-[10px] font-mono">
                      <button
                        onClick={() => setChartType('candle')}
                        className={`px-2 py-1 rounded-lg font-bold cursor-pointer ${
                          chartType === 'candle'
                            ? 'bg-[#1A2639] text-white'
                            : 'text-[#8B9BB4]'
                        }`}
                      >
                        Candles
                      </button>
                      <button
                        onClick={() => setChartType('area')}
                        className={`px-2 py-1 rounded-lg font-bold cursor-pointer ${
                          chartType === 'area'
                            ? 'bg-[#1A2639] text-white'
                            : 'text-[#8B9BB4]'
                        }`}
                      >
                        Area
                      </button>
                    </div>

                    {[
                      { key: 'dma20', label: '20 DMA', color: 'text-[#21C8E8]' },
                      { key: 'dma50', label: '50 DMA', color: 'text-[#9875FF]' },
                      { key: 'srLines', label: 'Daily S&R', color: 'text-[#E9B949]' },
                    ].map(ind => (
                      <button
                        key={ind.key}
                        onClick={() =>
                          setOverlays(prev => ({
                            ...prev,
                            [ind.key]: !prev[ind.key as keyof typeof prev],
                          }))
                        }
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                          overlays[ind.key as keyof typeof overlays]
                            ? `bg-[#121C2D] border-white/20 ${ind.color}`
                            : 'bg-transparent border-white/5 text-[#8B9BB4]/50'
                        }`}
                      >
                        {ind.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SVG Candlestick / Area + Volume Canvas */}
                <div className="relative w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="w-full h-64 overflow-visible"
                  >
                    {/* Horizontal Grid Lines */}
                    {[0.15, 0.35, 0.55, 0.75].map((ratio, i) => {
                      const y = ratio * (svgH - 50);
                      const priceLabel = maxP - ratio * priceSpan;
                      return (
                        <g key={i}>
                          <line
                            x1={0}
                            y1={y}
                            x2={svgW - 60}
                            y2={y}
                            stroke="rgba(255,255,255,0.05)"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={svgW - 54}
                            y={y + 4}
                            fill="#8B9BB4"
                            fontSize="10"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            ₹{priceLabel.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Daily Support & Resistance Lines */}
                    {overlays.srLines && (
                      <>
                        <line
                          x1={0}
                          y1={yForPrice(screenerEval.dailySupport)}
                          x2={svgW - 60}
                          y2={yForPrice(screenerEval.dailySupport)}
                          stroke="#00C995"
                          strokeWidth="1.2"
                          strokeDasharray="4 4"
                        />
                        <line
                          x1={0}
                          y1={yForPrice(screenerEval.dailyResistance)}
                          x2={svgW - 60}
                          y2={yForPrice(screenerEval.dailyResistance)}
                          stroke="#FF526B"
                          strokeWidth="1.2"
                          strokeDasharray="4 4"
                        />
                      </>
                    )}

                    {/* Candles or Area */}
                    {chartType === 'candle' ? (
                      chartCandles.map((c, idx) => {
                        const stepX = (svgW - 80) / chartCandles.length;
                        const cx = 16 + idx * stepX;
                        const isGreen = c.close >= c.open;
                        const color = isGreen ? '#00C995' : '#FF526B';
                        const yHigh = yForPrice(c.high);
                        const yLow = yForPrice(c.low);
                        const yOpen = yForPrice(c.open);
                        const yClose = yForPrice(c.close);
                        const bodyTop = Math.min(yOpen, yClose);
                        const bodyHeight = Math.max(3, Math.abs(yClose - yOpen));
                        const volH = (c.volume / maxVol) * 36;

                        return (
                          <g key={idx}>
                            {/* Wick */}
                            <line
                              x1={cx}
                              y1={yHigh}
                              x2={cx}
                              y2={yLow}
                              stroke={color}
                              strokeWidth="1.4"
                            />
                            {/* Body */}
                            <rect
                              x={cx - 6}
                              y={bodyTop}
                              width={12}
                              height={bodyHeight}
                              rx={1.5}
                              fill={color}
                            />
                            {/* Volume Bar */}
                            <rect
                              x={cx - 5}
                              y={svgH - volH}
                              width={10}
                              height={volH}
                              fill={color}
                              opacity={0.28}
                            />
                          </g>
                        );
                      })
                    ) : (
                      <polyline
                        fill="none"
                        stroke={isUp ? '#00C995' : '#FF526B'}
                        strokeWidth="2.5"
                        points={chartCandles
                          .map((c, idx) => {
                            const stepX = (svgW - 80) / chartCandles.length;
                            const cx = 16 + idx * stepX;
                            return `${cx},${yForPrice(c.close)}`;
                          })
                          .join(' ')}
                      />
                    )}
                  </svg>
                </div>

                {/* Bottom Sub-Indicator Strip (RSI, MACD, ATR, CPR) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/[0.06] font-mono text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121C2D]">
                    <span className="text-[#8B9BB4]">RSI (14)</span>
                    <span
                      className={`font-extrabold ${
                        stock.rsi14 >= 60
                          ? 'text-[#00C995]'
                          : stock.rsi14 <= 40
                          ? 'text-[#FF526B]'
                          : 'text-white'
                      }`}
                    >
                      {stock.rsi14.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121C2D]">
                    <span className="text-[#8B9BB4]">MACD Hist</span>
                    <span
                      className={`font-extrabold ${
                        stock.macdHist >= 0 ? 'text-[#00C995]' : 'text-[#FF526B]'
                      }`}
                    >
                      {stock.macdHist >= 0 ? '+' : ''}
                      {stock.macdHist.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121C2D]">
                    <span className="text-[#8B9BB4]">ATR (14)</span>
                    <span className="font-extrabold text-white">
                      ₹{stock.atr14.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121C2D]">
                    <span className="text-[#8B9BB4]">CPR Width</span>
                    <span className="font-extrabold text-[#21C8E8]">
                      {stock.cpr.widthPercent.toFixed(3)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICALS, 7-PARAM ALIGNMENT & HISTORICAL REFERENCE HIGHS & LOWS */}
          {activeTab === 'technicals' && (
            <div className="space-y-5">
              {/* 7-Parameter Multi-Timeframe Trend Alignment */}
              <div className="bg-[#121C2D] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#477DFF]" />
                    <span>7-Parameter Multi-Timeframe Trend Alignment</span>
                  </h3>
                  <span className="text-xs font-mono font-bold text-[#00C995]">
                    Bull {screenerEval.buyPower}/7 • Bear {screenerEval.sellPower}/7
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                  {trendEval.allChecks.map(item => (
                    <div
                      key={item.code}
                      className={`p-3 rounded-xl border ${
                        item.passed
                          ? isBullishBias
                            ? 'bg-[#00C995]/10 border-[#00C995]/30'
                            : 'bg-[#FF526B]/10 border-[#FF526B]/30'
                          : 'bg-[#080D16] border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">{item.label}</span>
                        {item.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00C995]" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-[#FF526B]" />
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-[#8B9BB4] leading-snug">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historical Reference Highs & Lows + Moving Averages */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#121C2D] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Historical Reference Highs, Lows &amp; Completed Closes
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-xs tabular-nums">
                    <div className="p-2.5 rounded-xl bg-[#080D16] flex justify-between">
                      <span className="text-[#8B9BB4]">Prev Day High/Low</span>
                      <span className="text-white font-bold">
                        ₹{stock.pdh.toFixed(1)} / ₹{stock.pdl.toFixed(1)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#080D16] flex justify-between">
                      <span className="text-[#8B9BB4]">Prev Week High/Low</span>
                      <span className="text-white font-bold">
                        ₹{stock.pwh.toFixed(1)} / ₹{stock.pwl.toFixed(1)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#080D16] flex justify-between">
                      <span className="text-[#8B9BB4]">Prev Month High/Low</span>
                      <span className="text-white font-bold">
                        ₹{stock.pmh.toFixed(1)} / ₹{stock.pml.toFixed(1)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#080D16] flex justify-between">
                      <span className="text-[#8B9BB4]">52-Week High/Low</span>
                      <span className="text-white font-bold">
                        ₹{stock.high52W.toFixed(1)} / ₹{stock.low52W.toFixed(1)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#080D16] flex justify-between">
                      <span className="text-[#8B9BB4]">Monthly / Weekly Close</span>
                      <span className="text-[#21C8E8] font-bold">
                        ₹{screenerEval.monthlyClose.toFixed(1)} / ₹{screenerEval.weeklyClose.toFixed(1)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#080D16] flex justify-between">
                      <span className="text-[#8B9BB4]">Daily Close</span>
                      <span className="text-[#21C8E8] font-bold">
                        ₹{screenerEval.dailyClose.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#121C2D] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Key Moving Averages &amp; Central Pivot Range (CPR)
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-xs tabular-nums">
                    {[
                      { label: '20 DMA', val: stock.dma20 },
                      { label: '50 DMA', val: stock.dma50 },
                      { label: '100 DMA', val: stock.dma100 },
                      { label: '200 DMA', val: stock.dma200 },
                    ].map(dma => {
                      const above = stock.price >= dma.val;
                      return (
                        <div
                          key={dma.label}
                          className="p-2.5 rounded-xl bg-[#080D16] flex justify-between"
                        >
                          <span className="text-[#8B9BB4]">{dma.label}</span>
                          <span
                            className={`font-bold ${
                              above ? 'text-[#00C995]' : 'text-[#FF526B]'
                            }`}
                          >
                            ₹{dma.val.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="p-2.5 rounded-xl bg-[#080D16] flex justify-between">
                      <span className="text-[#8B9BB4]">CPR (TC / P / BC)</span>
                      <span className="text-white font-bold">
                        {stock.cpr.tc.toFixed(0)} / {stock.cpr.p.toFixed(0)} / {stock.cpr.bc.toFixed(0)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#080D16] flex justify-between">
                      <span className="text-[#8B9BB4]">R1 / S1 Pivots</span>
                      <span className="text-white font-bold">
                        ₹{stock.cpr.r1.toFixed(1)} / ₹{stock.cpr.s1.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRADING PLAN & RISK/REWARD LEVELS */}
          {activeTab === 'trading_plan' && (
            <div className="space-y-4">
              <div className="bg-[#121C2D] border border-white/[0.07] rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                      Intraday Execution Plan
                    </h3>
                    <p className="text-xs text-[#8B9BB4] mt-0.5">
                      {screenerEval.executeTooltip}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl font-mono text-xs font-black ${
                      screenerEval.execute === 'BUY'
                        ? 'bg-[#00C995] text-[#080D16]'
                        : screenerEval.execute === 'SELL'
                        ? 'bg-[#FF526B] text-white'
                        : 'bg-[#080D16] text-[#8B9BB4] border border-white/10'
                    }`}
                  >
                    STATUS: {screenerEval.execute}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono tabular-nums">
                  <div className="p-3.5 rounded-xl bg-[#080D16] border border-white/[0.06]">
                    <span className="text-[10px] text-[#8B9BB4] block">SPOT ENTRY ZONE</span>
                    <span className="text-sm font-extrabold text-white mt-1 block">
                      ₹{stock.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#080D16] border border-[#FF526B]/30">
                    <span className="text-[10px] text-[#FF526B] block">45M STOP LOSS</span>
                    <span className="text-sm font-extrabold text-[#FF526B] mt-1 block">
                      ₹{slLevel.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#080D16] border border-[#00C995]/30">
                    <span className="text-[10px] text-[#00C995] block">TARGET 1 (1.5R)</span>
                    <span className="text-sm font-extrabold text-[#00C995] mt-1 block">
                      ₹{target1Level.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#080D16] border border-[#21C8E8]/30">
                    <span className="text-[10px] text-[#21C8E8] block">TARGET 2 (2.5R)</span>
                    <span className="text-sm font-extrabold text-[#21C8E8] mt-1 block">
                      ₹{target2Level.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#080D16] border border-white/[0.06]">
                    <span className="text-[10px] text-[#00C995] block">DAILY SUPPORT</span>
                    <span className="text-sm font-extrabold text-[#00C995] mt-1 block">
                      ₹{screenerEval.dailySupport.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#080D16] border border-white/[0.06]">
                    <span className="text-[10px] text-[#FF526B] block">DAILY RESISTANCE</span>
                    <span className="text-sm font-extrabold text-[#FF526B] mt-1 block">
                      ₹{screenerEval.dailyResistance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPTIONS INTELLIGENCE & STRIKE CHAIN */}
          {activeTab === 'options' && (
            <div className="space-y-4">
              {stock.isFO && optRec ? (
                <>
                  <div className="bg-[#121C2D] border border-white/[0.07] rounded-2xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-[#21C8E8] uppercase">
                          ALGORITHMIC F&amp;O STRATEGY ENGINE
                        </span>
                        <h3 className="text-base font-extrabold text-white font-mono mt-0.5">
                          {optRec.action} • {optRec.contractSymbol}
                        </h3>
                      </div>
                      <span className="px-3 py-1 rounded-xl bg-[#080D16] text-[#E9B949] font-mono text-xs font-bold border border-[#E9B949]/30">
                        Lot Size: {optRec.lotSize} • R:R {optRec.riskRewardRatio}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 font-mono text-xs tabular-nums">
                      <div className="p-3 rounded-xl bg-[#080D16]">
                        <span className="text-[9px] text-[#8B9BB4] block">OPTION LTP</span>
                        <span className="font-extrabold text-white mt-0.5 block">
                          ₹{optRec.optionLtp.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#080D16]">
                        <span className="text-[9px] text-[#8B9BB4] block">ENTRY ZONE</span>
                        <span className="font-extrabold text-[#21C8E8] mt-0.5 block">
                          {optRec.entryRange}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#080D16]">
                        <span className="text-[9px] text-[#FF526B] block">OPTION SL</span>
                        <span className="font-extrabold text-[#FF526B] mt-0.5 block">
                          ₹{optRec.stopLoss.toFixed(1)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#080D16]">
                        <span className="text-[9px] text-[#00C995] block">TARGET 1 / 2</span>
                        <span className="font-extrabold text-[#00C995] mt-0.5 block">
                          ₹{optRec.target1.toFixed(0)} / ₹{optRec.target2.toFixed(0)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#080D16]">
                        <span className="text-[9px] text-[#8B9BB4] block">DELTA / IV</span>
                        <span className="font-extrabold text-white mt-0.5 block">
                          {optRec.delta?.toFixed(2) || '0.52'} / {optRec.impliedVolatility?.toFixed(1) || '18.4'}%
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#080D16]">
                        <span className="text-[9px] text-[#8B9BB4] block">OPEN INTEREST</span>
                        <span className="font-extrabold text-white mt-0.5 block">
                          {optRec.openInterest ? (optRec.openInterest / 1000).toFixed(0) + 'K' : '240K'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#080D16]">
                        <span className="text-[9px] text-[#8B9BB4] block">PCR / MAX PAIN</span>
                        <span className="font-extrabold text-[#E9B949] mt-0.5 block">
                          {(stock.pcr || 1.08).toFixed(2)} / ₹{atmStrike}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#080D16]">
                        <span className="text-[9px] text-[#8B9BB4] block">OI BUILDUP</span>
                        <span className="font-extrabold text-[#00C995] mt-0.5 block truncate">
                          {stock.oiBuildup || 'Long Buildup'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive ATM Option Chain Table */}
                  <div className="bg-[#121C2D] border border-white/[0.07] rounded-2xl overflow-hidden">
                    <div className="p-3.5 bg-[#080D16] border-b border-white/[0.06] flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                        ATM Option Strike Chain ({optRec.expiryDate})
                      </span>
                      <span className="text-[10px] font-mono text-[#8B9BB4]">
                        CALLS (CE) vs PUTS (PE)
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-center font-mono text-xs tabular-nums">
                        <thead className="bg-[#080D16]/60 text-[#8B9BB4] text-[10px] uppercase border-b border-white/[0.06]">
                          <tr>
                            <th className="py-2.5 px-3 text-[#00C995]">CE OI</th>
                            <th className="py-2.5 px-3 text-[#00C995]">CE IV%</th>
                            <th className="py-2.5 px-3 text-[#00C995]">CE LTP (₹)</th>
                            <th className="py-2.5 px-4 bg-[#1A2639] text-white">STRIKE</th>
                            <th className="py-2.5 px-3 text-[#FF526B]">PE LTP (₹)</th>
                            <th className="py-2.5 px-3 text-[#FF526B]">PE IV%</th>
                            <th className="py-2.5 px-3 text-[#FF526B]">PE OI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {strikeChain.map(row => (
                            <tr
                              key={row.strike}
                              className={
                                row.isAtm ? 'bg-[#477DFF]/15 font-bold' : 'hover:bg-[#1A2639]'
                              }
                            >
                              <td className="py-2 px-3 text-slate-300">
                                {(row.ceOi / 1000).toFixed(0)}K
                              </td>
                              <td className="py-2 px-3 text-[#8B9BB4]">{row.ceIv}%</td>
                              <td className="py-2 px-3 text-[#00C995] font-bold">
                                ₹{row.ceLtp.toFixed(2)}
                              </td>
                              <td className="py-2 px-4 bg-[#080D16] text-white font-extrabold">
                                ₹{row.strike} {row.isAtm ? '(ATM)' : ''}
                              </td>
                              <td className="py-2 px-3 text-[#FF526B] font-bold">
                                ₹{row.peLtp.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-[#8B9BB4]">{row.peIv}%</td>
                              <td className="py-2 px-3 text-slate-300">
                                {(row.peOi / 1000).toFixed(0)}K
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center bg-[#121C2D] rounded-2xl border border-white/[0.07]">
                  <p className="text-sm font-bold text-white">
                    Cash Segment Equity (Non-F&amp;O)
                  </p>
                  <p className="text-xs text-[#8B9BB4] mt-1">
                    {stock.symbol} trades in the NSE/BSE Cash segment. Use the Trading Plan &amp; Levels tab for Equity Spot position sizing.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: FUNDAMENTALS, QUARTERLY RESULTS, NEWS & PEERS */}
          {activeTab === 'fundamentals' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Earnings & News (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-[#121C2D] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#E9B949]" />
                    <span>Quarterly Earnings &amp; Filings</span>
                  </h4>
                  {stockResults.length === 0 ? (
                    <p className="text-xs text-[#8B9BB4]">
                      No recent quarterly earnings filings flagged for {stock.symbol} in the current window.
                    </p>
                  ) : (
                    stockResults.map((res, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-[#080D16] border border-white/[0.06] flex items-center justify-between"
                      >
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {res.quarter || 'Quarterly Filing'} • {res.resultDate}
                          </span>
                          <span className="text-[11px] text-[#8B9BB4]">
                            Status: {res.reaction}
                          </span>
                        </div>
                        {res.actualRevenue && (
                          <div className="text-right font-mono text-xs">
                            <span className="text-white font-bold block">
                              Rev: ₹{res.actualRevenue.toLocaleString('en-IN')} Cr
                            </span>
                            <span className="text-[#00C995] block">
                              PAT: ₹{(res.actualNetProfit || 0).toLocaleString('en-IN')} Cr
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-[#121C2D] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-[#477DFF]" />
                    <span>Recent Stock &amp; Sector Headlines</span>
                  </h4>
                  {stockNews.length === 0 ? (
                    <p className="text-xs text-[#8B9BB4]">
                      No breaking stock-specific wire items in the current session.
                    </p>
                  ) : (
                    stockNews.slice(0, 4).map(item => (
                      <a
                        key={item.id}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-xl bg-[#080D16] hover:bg-[#1A2639] border border-white/[0.06] transition-colors"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#8B9BB4] mb-1">
                          <span>{item.source}</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                        <p className="text-xs font-semibold text-white">{item.title}</p>
                      </a>
                    ))
                  )}
                </div>
              </div>

              {/* Sector Peers Comparison (5 cols) */}
              <div className="lg:col-span-5 bg-[#121C2D] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#21C8E8]" />
                  <span>{stock.sector} Sector Peers</span>
                </h4>
                <div className="space-y-2">
                  {sectorPeers.map(peer => {
                    const isPos = peer.changePercent >= 0;
                    return (
                      <button
                        key={peer.symbol}
                        onClick={() => onSelectPeer?.(peer.symbol)}
                        className="w-full p-2.5 rounded-xl bg-[#080D16] hover:bg-[#1A2639] border border-white/[0.06] flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-mono font-bold text-xs text-white block">
                            {peer.symbol}
                          </span>
                          <span className="text-[10px] text-[#8B9BB4] truncate block max-w-[160px]">
                            {peer.name}
                          </span>
                        </div>
                        <div className="text-right font-mono text-xs tabular-nums">
                          <div className="text-white font-bold">₹{peer.price.toFixed(2)}</div>
                          <div
                            className={`text-[10px] font-bold ${
                              isPos ? 'text-[#00C995]' : 'text-[#FF526B]'
                            }`}
                          >
                            {isPos ? '+' : ''}
                            {peer.changePercent.toFixed(2)}%
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
