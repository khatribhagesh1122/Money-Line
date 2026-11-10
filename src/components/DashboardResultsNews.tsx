import React from 'react';
import { ResultItem, NewsArticle, NavigationTab } from '../types/market';
import {
  Calendar,
  Newspaper,
  Zap,
  ExternalLink,
  ArrowUpRight,
  Building2,
} from 'lucide-react';

interface DashboardResultsNewsProps {
  results: ResultItem[];
  news: NewsArticle[];
  onStockClick: (symbol: string) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const DashboardResultsNews: React.FC<DashboardResultsNewsProps> = ({
  results,
  news,
  onStockClick,
  onNavigate,
}) => {
  const [activeSubTab, setActiveSubTab] = React.useState<'today' | 'declared' | 'upcoming'>('today');

  const todayAll = React.useMemo(
    () =>
      results
        .filter(r => r.period === 'today')
        .sort((a, b) => {
          const aFo = a.isFO ? 1 : 0;
          const bFo = b.isFO ? 1 : 0;
          if (aFo !== bFo) return bFo - aFo;
          const aDecl = a.status === 'Declared' ? 1 : 0;
          const bDecl = b.status === 'Declared' ? 1 : 0;
          if (aDecl !== bDecl) return bDecl - aDecl;
          return a.symbol.localeCompare(b.symbol);
        }),
    [results]
  );

  const declaredResults = React.useMemo(
    () =>
      results
        .filter(r => r.status === 'Declared' || r.actualRevenue !== undefined)
        .sort((a, b) => {
          if (a.resultDate !== b.resultDate) return b.resultDate.localeCompare(a.resultDate);
          const aFo = a.isFO ? 1 : 0;
          const bFo = b.isFO ? 1 : 0;
          if (aFo !== bFo) return bFo - aFo;
          return a.symbol.localeCompare(b.symbol);
        }),
    [results]
  );

  const upcomingResults = React.useMemo(
    () =>
      results
        .filter(
          r =>
            r.status === 'Scheduled' &&
            (r.period === 'today' ||
              r.period === 'tomorrow' ||
              r.period === 'next2days' ||
              r.period === 'upcoming' ||
              r.period === 'calendar')
        )
        .sort((a, b) => {
          if (a.resultDate !== b.resultDate) return a.resultDate.localeCompare(b.resultDate);
          const aFo = a.isFO ? 1 : 0;
          const bFo = b.isFO ? 1 : 0;
          if (aFo !== bFo) return bFo - aFo;
          return a.symbol.localeCompare(b.symbol);
        }),
    [results]
  );

  const displayResults = React.useMemo(() => {
    if (activeSubTab === 'today') {
      return (todayAll.length > 0 ? todayAll : declaredResults).slice(0, 12);
    }
    if (activeSubTab === 'declared') {
      return declaredResults.slice(0, 12);
    }
    return upcomingResults.slice(0, 12);
  }, [activeSubTab, todayAll, declaredResults, upcomingResults]);

  const topNews = news.slice(0, 6);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Results Flash & Earnings Calendar Summary (6 cols) */}
      <div className="lg:col-span-6 bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#E9B949]/15 border border-[#E9B949]/30 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-[#E9B949]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                  Corporate Earnings &amp; Results Flash
                </h3>
                <p className="text-[11px] text-[#8B9BB4]">
                  {todayAll.length} Today • {declaredResults.length} Declared • {upcomingResults.length} Scheduled
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onNavigate('results_flash')}
                className="px-2.5 py-1 rounded-lg bg-[#E9B949]/15 text-[#E9B949] border border-[#E9B949]/30 text-[10px] font-mono font-bold hover:bg-[#E9B949]/25 cursor-pointer"
              >
                Flash Wire ({declaredResults.length})
              </button>
              <button
                onClick={() => onNavigate('results')}
                className="px-2.5 py-1 rounded-lg bg-[#121C2D] text-[#21C8E8] border border-white/[0.07] text-[10px] font-mono font-bold hover:bg-[#1A2639] cursor-pointer"
              >
                Full Calendar ({results.length}) →
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-2.5 pb-1">
            {[
              { id: 'today', label: `Today (${todayAll.length})` },
              { id: 'declared', label: `Declared (${declaredResults.length})` },
              { id: 'upcoming', label: `Upcoming (${upcomingResults.length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                  activeSubTab === tab.id
                    ? 'bg-[#477DFF] text-white'
                    : 'bg-[#121C2D] text-[#8B9BB4] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="divide-y divide-white/[0.05] mt-1 max-h-80 overflow-y-auto pr-1">
            {displayResults.map((item, idx) => {
              const isBeat = item.reaction === 'Beat';
              const isMiss = item.reaction === 'Miss';
              const badgeLabel =
                item.reaction === 'Pending'
                  ? item.status === 'Declared'
                    ? 'Declared'
                    : 'Scheduled'
                  : item.reaction;
              return (
                <div
                  key={`${item.symbol}-${idx}`}
                  onClick={() => onStockClick(item.symbol)}
                  className="py-2.5 hover:bg-[#121C2D]/60 px-2 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-extrabold text-xs text-white">
                        {item.symbol}
                      </span>
                      {item.isFO && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#477DFF]/15 text-[#477DFF] font-bold">
                          F&amp;O
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          isBeat || item.status === 'Declared'
                            ? 'bg-[#00C995]/15 text-[#00C995]'
                            : isMiss
                            ? 'bg-[#FF526B]/15 text-[#FF526B]'
                            : 'bg-white/5 text-[#8B9BB4]'
                        }`}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8B9BB4] truncate mt-0.5">
                      {item.company} • {item.resultDate}
                    </p>
                  </div>

                  <div className="text-right font-mono text-[11px] tabular-nums shrink-0">
                    {item.actualRevenue ? (
                      <>
                        <div className="font-bold text-white">
                          Rev: ₹{item.actualRevenue.toLocaleString('en-IN')} Cr
                        </div>
                        <div className="text-[10px] text-[#00C995]">
                          PAT: ₹{(item.actualNetProfit || 0).toLocaleString('en-IN')} Cr
                        </div>
                      </>
                    ) : (
                      <span
                        className={`text-[10px] font-semibold ${
                          item.status === 'Declared' ? 'text-[#00C995]' : 'text-[#E9B949]'
                        }`}
                      >
                        {item.status === 'Declared' ? 'Filed • Reg. 33' : item.expectedTime || 'Scheduled'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {upcomingResults.length > 0 && (
          <div className="pt-3 mt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-[#8B9BB4]">
            <span className="flex items-center gap-1.5 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-[#477DFF]" />
              <span>Board Meetings:</span>
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {upcomingResults.slice(0, 8).map(r => (
                <button
                  key={r.symbol}
                  onClick={() => onStockClick(r.symbol)}
                  className="px-2 py-0.5 rounded bg-[#121C2D] text-white font-mono text-[10px] hover:bg-[#1A2639] cursor-pointer shrink-0"
                >
                  {r.symbol}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Live Flash News Wire (6 cols) */}
      <div className="lg:col-span-6 bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#477DFF]/15 border border-[#477DFF]/30 flex items-center justify-center">
                <Newspaper className="w-4 h-4 text-[#477DFF]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                  Flash News Wire
                </h3>
                <p className="text-[11px] text-[#8B9BB4]">
                  Real-time market-moving headlines, RBI/SEBI updates &amp; block deals
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('news')}
              className="px-2.5 py-1 rounded-lg bg-[#121C2D] text-[#21C8E8] border border-white/[0.07] text-[10px] font-mono font-bold hover:bg-[#1A2639] cursor-pointer"
            >
              Open News Terminal →
            </button>
          </div>

          <div className="divide-y divide-white/[0.05] mt-2">
            {topNews.map(article => {
              const isPos = article.sentiment === 'positive';
              const isNeg = article.sentiment === 'negative';
              return (
                <div
                  key={article.id}
                  onClick={() => {
                    if (article.symbol) onStockClick(article.symbol);
                    else onNavigate('news');
                  }}
                  className="py-2.5 px-2 hover:bg-[#121C2D]/60 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {article.symbol && (
                        <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-[#477DFF]/15 text-[#477DFF]">
                          {article.symbol}
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                          isPos
                            ? 'bg-[#00C995]/15 text-[#00C995]'
                            : isNeg
                            ? 'bg-[#FF526B]/15 text-[#FF526B]'
                            : 'bg-white/5 text-[#8B9BB4]'
                        }`}
                      >
                        {article.sentiment}
                      </span>
                      {article.marketImpact === 'HIGH' && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#E9B949]/15 text-[#E9B949]">
                          HIGH IMPACT
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[#8B9BB4] shrink-0">
                      {article.source}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-100 line-clamp-1">
                    {article.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
