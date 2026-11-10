import React, { useState } from 'react';
import {
  MarketIndex,
  GlobalMarketItem,
  Stock,
  MarketMood,
  PreMarketCues,
  MarketStatus,
  SectorRotationItem,
  IntradayPick,
  ResultItem,
  NewsArticle,
  FlashAlert,
  GlobalInstrumentFilter,
  NavigationTab,
  MarketHealthTelemetry,
} from '../types/market';
import { IndexBoxes } from './IndexBoxes';
import { MoodGauge } from './MoodGauge';
import { RightNowRadar } from './RightNowRadar';
import { Heatmap } from './Heatmap';
import { DashboardResultsNews } from './DashboardResultsNews';
import { X } from 'lucide-react';

interface DashboardViewProps {
  indices: MarketIndex[];
  globalOverviewItems?: GlobalMarketItem[];
  stocks: Stock[];
  mood: MarketMood;
  cues: PreMarketCues;
  status: MarketStatus;
  sectors: SectorRotationItem[];
  activePicks: IntradayPick[];
  pastPicks: IntradayPick[];
  results: ResultItem[];
  news: NewsArticle[];
  alerts: FlashAlert[];
  instrumentFilter: GlobalInstrumentFilter;
  onInstrumentFilterChange: (filter: GlobalInstrumentFilter) => void;
  onStockClick: (symbol: string) => void;
  onNavigate: (tab: NavigationTab) => void;
  marketHealth?: MarketHealthTelemetry | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  indices,
  globalOverviewItems = [],
  stocks,
  mood,
  cues,
  status,
  activePicks,
  pastPicks,
  results,
  news,
  instrumentFilter,
  onInstrumentFilterChange,
  onStockClick,
  onNavigate,
  marketHealth,
}) => {
  const [selectedIndexModal, setSelectedIndexModal] = useState<MarketIndex | null>(null);

  return (
    <div className="space-y-3">
      {/* 1. Section A & B: Indian Benchmark Indices + Global Markets & Commodities */}
      <IndexBoxes
        indices={indices}
        globalOverviewItems={globalOverviewItems}
        onIndexClick={idx => setSelectedIndexModal(idx)}
        onGlobalItemClick={item => {
          const matchingIdx = indices.find(i => i.symbol === item.symbol);
          if (matchingIdx) setSelectedIndexModal(matchingIdx);
        }}
      />

      {/* 2. Section C: Market Breadth (Advances & Declines) */}
      <MoodGauge
        mood={mood}
        cues={cues}
        status={status}
        marketHealth={marketHealth}
        stocks={stocks}
      />

      {/* 3. Right-Now Intraday Momentum & 7-Parameter Radar */}
      <RightNowRadar
        stocks={stocks}
        instrumentFilter={instrumentFilter}
        onInstrumentFilterChange={onInstrumentFilterChange}
        onStockClick={onStockClick}
        onNavigate={onNavigate}
      />

      {/* 4. Market Heatmap */}
      <Heatmap stocks={stocks} onStockClick={onStockClick} />

      {/* 5. Corporate Earnings Flash & Live News Wire */}
      <DashboardResultsNews
        results={results}
        news={news}
        onStockClick={onStockClick}
        onNavigate={onNavigate}
      />

      {/* Detailed Index Intelligence Modal when user clicks any Index Card */}
      {selectedIndexModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedIndexModal(null)}
        >
          <div
            className="bg-[#0D1422] border border-white/10 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold text-white">
                    {selectedIndexModal.symbol}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#477DFF]/15 text-[#477DFF] font-bold">
                    {selectedIndexModal.exchange || 'NSE INDEX'}
                  </span>
                </div>
                <p className="text-xs text-[#8B9BB4] mt-0.5">
                  {selectedIndexModal.name} • Real-time Index Constituents &amp; Technical Structure
                </p>
              </div>

              <button
                onClick={() => setSelectedIndexModal(null)}
                className="p-2 rounded-xl bg-[#121C2D] text-[#8B9BB4] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
              <div className="p-3.5 rounded-xl bg-[#121C2D] border border-white/[0.06]">
                <span className="text-[10px] text-[#8B9BB4] block">INDEX LEVEL</span>
                <span className="text-lg font-extrabold text-white mt-0.5 block">
                  {selectedIndexModal.level.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#121C2D] border border-white/[0.06]">
                <span className="text-[10px] text-[#8B9BB4] block">NET CHANGE</span>
                <span
                  className={`text-lg font-extrabold mt-0.5 block ${
                    selectedIndexModal.change >= 0 ? 'text-[#00C995]' : 'text-[#FF526B]'
                  }`}
                >
                  {selectedIndexModal.change >= 0 ? '+' : ''}
                  {selectedIndexModal.change.toFixed(2)} ({selectedIndexModal.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#121C2D] border border-white/[0.06]">
                <span className="text-[10px] text-[#8B9BB4] block">PREV CLOSE</span>
                <span className="text-lg font-extrabold text-white mt-0.5 block">
                  {(
                    selectedIndexModal.prevClose ||
                    selectedIndexModal.level - selectedIndexModal.change
                  ).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#121C2D] border border-white/[0.06]">
                <span className="text-[10px] text-[#8B9BB4] block">SESSION STATUS</span>
                <span className="text-sm font-extrabold text-[#00C995] mt-1 block">
                  {selectedIndexModal.status || 'LIVE'}
                </span>
              </div>
            </div>

            {/* Top Index Constituents */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#8B9BB4] mb-2.5">
                Key Heavyweight Constituents &amp; Movers
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
                {stocks.slice(0, 9).map(st => {
                  const isPos = st.changePercent >= 0;
                  return (
                    <button
                      key={st.symbol}
                      onClick={() => {
                        setSelectedIndexModal(null);
                        onStockClick(st.symbol);
                      }}
                      className="p-2.5 rounded-xl bg-[#121C2D] hover:bg-[#1A2639] border border-white/[0.06] flex items-center justify-between text-left cursor-pointer"
                    >
                      <div>
                        <span className="font-mono font-bold text-xs text-white block">
                          {st.symbol}
                        </span>
                        <span className="text-[10px] text-[#8B9BB4] font-mono">
                          ₹{st.price.toFixed(1)}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold ${
                          isPos ? 'text-[#00C995]' : 'text-[#FF526B]'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {st.changePercent.toFixed(2)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
