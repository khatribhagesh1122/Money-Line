import React, { useState, useMemo } from 'react';
import { NewsArticle, Stock } from '../types/market';
import {
  Newspaper,
  Search,
  ExternalLink,
  RefreshCw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';

interface FlashNewsViewProps {
  news: NewsArticle[];
  onRefresh: () => void;
  onStockClick: (symbol: string) => void;
  stocks?: Stock[];
}

export const FlashNewsView: React.FC<FlashNewsViewProps> = ({
  news,
  onRefresh,
  onStockClick,
  stocks = [],
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sentimentFilter, setSentimentFilter] = useState<
    'ALL' | 'positive' | 'negative' | 'neutral'
  >('ALL');
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = () => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const stockMap = useMemo(() => {
    const map = new Map<string, Stock>();
    stocks.forEach(s => map.set(s.symbol.toUpperCase(), s));
    return map;
  }, [stocks]);

  const filteredNews = useMemo(() => {
    return news.filter(item => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (sentimentFilter !== 'ALL' && item.sentiment !== sentimentFilter) return false;
      if (impactFilter !== 'ALL' && item.marketImpact !== impactFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchSymbol = item.symbol?.toLowerCase().includes(q);
        const matchSource = item.source.toLowerCase().includes(q);
        return matchTitle || matchSymbol || matchSource;
      }
      return true;
    });
  }, [news, categoryFilter, sentimentFilter, impactFilter, searchQuery]);

  const posCount = news.filter(n => n.sentiment === 'positive').length;
  const negCount = news.filter(n => n.sentiment === 'negative').length;
  const highImpactCount = news.filter(n => n.marketImpact === 'HIGH').length;
  const breakingHeadline = useMemo(
    () => news.find(n => n.marketImpact === 'HIGH') || news[0],
    [news]
  );

  return (
    <div className="space-y-2.5">
      {/* Breaking News Top Banner */}
      {breakingHeadline && (
        <div className="bg-gradient-to-r from-[#477DFF]/20 via-[#121C2D] to-[#0D1422] border border-[#477DFF]/35 rounded-xl p-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FF526B] text-white text-[10px] font-mono font-black uppercase tracking-wider shrink-0">
              <Zap className="w-3 h-3" />
              <span>BREAKING</span>
            </span>
            {breakingHeadline.symbol && (
              <button
                onClick={() => onStockClick(breakingHeadline.symbol!)}
                className="px-1.5 py-0.5 rounded bg-[#477DFF]/20 text-[#21C8E8] font-mono text-[11px] font-extrabold shrink-0 cursor-pointer"
              >
                {breakingHeadline.symbol}
              </button>
            )}
            <a
              href={breakingHeadline.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-white hover:text-[#21C8E8] truncate transition-colors"
            >
              {breakingHeadline.title}
            </a>
          </div>
          <span className="text-[10px] font-mono text-[#8B9BB4] shrink-0 hidden sm:inline">
            {breakingHeadline.source}
          </span>
        </div>
      )}

      {/* Main Controls Header */}
      <div className="bg-[#0D1422] border border-white/[0.07] rounded-xl p-3 sm:p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#477DFF]/15 border border-[#477DFF]/30 flex items-center justify-center text-[#477DFF] shrink-0">
              <Newspaper className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Flash News Wire
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00C995]/15 text-[#00C995] border border-[#00C995]/30 font-bold">
                LIVE STREAM
              </span>
            </div>
          </div>

          {/* Sentiment & Impact Counters + Refresh */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-0.5 bg-[#080D16] p-0.5 rounded-lg border border-white/[0.06] text-[11px] font-mono">
              <button
                onClick={() => setSentimentFilter('ALL')}
                className={`px-2 py-1 rounded-md font-bold cursor-pointer ${
                  sentimentFilter === 'ALL'
                    ? 'bg-[#1A2639] text-white'
                    : 'text-[#8B9BB4] hover:text-white'
                }`}
              >
                All ({news.length})
              </button>
              <button
                onClick={() => setSentimentFilter('positive')}
                className={`px-2 py-1 rounded-md font-bold cursor-pointer ${
                  sentimentFilter === 'positive'
                    ? 'bg-[#00C995] text-[#080D16]'
                    : 'text-[#00C995] hover:bg-[#00C995]/10'
                }`}
              >
                Bull ({posCount})
              </button>
              <button
                onClick={() => setSentimentFilter('negative')}
                className={`px-2 py-1 rounded-md font-bold cursor-pointer ${
                  sentimentFilter === 'negative'
                    ? 'bg-[#FF526B] text-white'
                    : 'text-[#FF526B] hover:bg-[#FF526B]/10'
                }`}
              >
                Bear ({negCount})
              </button>
            </div>

            <button
              onClick={() =>
                setImpactFilter(prev => (prev === 'HIGH' ? 'ALL' : 'HIGH'))
              }
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                impactFilter === 'HIGH'
                  ? 'bg-[#E9B949] text-[#080D16] border-[#E9B949]'
                  : 'bg-[#121C2D] text-[#E9B949] border-[#E9B949]/30 hover:bg-[#1A2639]'
              }`}
            >
              High Impact ({highImpactCount})
            </button>

            <button
              onClick={handleManualRefresh}
              className="px-2.5 py-1 rounded-lg bg-[#477DFF] hover:bg-[#3B66E0] text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
            >
              <RefreshCw
                className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
              />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Category Filter Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-0.5 bg-[#080D16] p-0.5 rounded-lg border border-white/[0.06] overflow-x-auto">
            {[
              { id: 'ALL', label: 'All Wire' },
              { id: 'breaking', label: 'Breaking' },
              { id: 'stock', label: 'Stocks' },
              { id: 'corporate', label: 'Earnings & Corp' },
              { id: 'fo', label: 'F&O' },
              { id: 'economic', label: 'Macro' },
              { id: 'rbi', label: 'RBI / Policy' },
              { id: 'global', label: 'Global' },
              { id: 'deals', label: 'Block Deals' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-[#477DFF] text-white shadow-xs'
                    : 'text-[#8B9BB4] hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-56 shrink-0">
            <Search className="w-3.5 h-3.5 text-[#8B9BB4] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search symbol or headline..."
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-white/[0.08] bg-[#080D16] text-white placeholder-[#8B9BB4] focus:outline-none focus:border-[#477DFF]"
            />
          </div>
        </div>
      </div>

      {/* News Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredNews.length === 0 ? (
          <div className="col-span-2 bg-[#0D1422] border border-white/[0.07] rounded-2xl p-12 text-center text-[#8B9BB4]">
            No news articles match the current filter criteria.
          </div>
        ) : (
          filteredNews.map(item => {
            const isPos = item.sentiment === 'positive';
            const isNeg = item.sentiment === 'negative';
            const linkedStock = item.symbol
              ? stockMap.get(item.symbol.toUpperCase())
              : undefined;

            return (
              <div
                key={item.id}
                className={`bg-[#0D1422] hover:bg-[#121C2D] border rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 ${
                  item.marketImpact === 'HIGH'
                    ? 'border-[#477DFF]/35 shadow-[0_8px_24px_rgba(0,0,0,0.4)]'
                    : 'border-white/[0.07]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Sentiment Pill */}
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          isPos
                            ? 'bg-[#00C995]/15 text-[#00C995] border border-[#00C995]/30'
                            : isNeg
                            ? 'bg-[#FF526B]/15 text-[#FF526B] border border-[#FF526B]/30'
                            : 'bg-white/5 text-[#8B9BB4]'
                        }`}
                      >
                        {isPos ? 'BULLISH' : isNeg ? 'BEARISH' : 'NEUTRAL'}
                      </span>

                      {/* Market Impact */}
                      {item.marketImpact === 'HIGH' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-[#E9B949]/15 text-[#E9B949] border border-[#E9B949]/30">
                          HIGH IMPACT
                        </span>
                      )}

                      {/* Linked Stock Badge + Live Price Movement */}
                      {item.symbol && (
                        <button
                          onClick={() => onStockClick(item.symbol!)}
                          className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-[#477DFF]/15 text-[#21C8E8] border border-[#477DFF]/30 font-extrabold hover:bg-[#477DFF]/25 cursor-pointer"
                        >
                          <span>{item.symbol}</span>
                          {linkedStock && (
                            <span
                              className={
                                linkedStock.changePercent >= 0
                                  ? 'text-[#00C995]'
                                  : 'text-[#FF526B]'
                              }
                            >
                              ₹{linkedStock.price.toFixed(1)} (
                              {linkedStock.changePercent >= 0 ? '+' : ''}
                              {linkedStock.changePercent.toFixed(2)}%)
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-[#8B9BB4]">
                      {item.source} •{' '}
                      {new Date(item.pubDate).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-white hover:text-[#21C8E8] transition-colors leading-snug block"
                  >
                    {item.title}
                  </a>

                  {item.impactNote && (
                    <p className="text-xs text-[#8B9BB4] mt-1.5 leading-relaxed">
                      {item.impactNote}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.06] text-[11px]">
                  <span className="text-[#8B9BB4] font-mono uppercase text-[10px]">
                    CAT: {item.category}
                  </span>
                  <div className="flex items-center gap-3">
                    {item.symbol && (
                      <button
                        onClick={() => onStockClick(item.symbol!)}
                        className="text-xs font-semibold text-[#477DFF] hover:text-[#21C8E8] cursor-pointer"
                      >
                        Stock Intelligence →
                      </button>
                    )}
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B9BB4] hover:text-white"
                    >
                      <span>Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
