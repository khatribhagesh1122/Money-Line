import React from 'react';
import { Stock, FlashAlert } from '../types/market';
import { Radio, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface DashboardTickerProps {
  stocks: Stock[];
  alerts: FlashAlert[];
  onStockClick: (symbol: string) => void;
}

export const DashboardTicker: React.FC<DashboardTickerProps> = ({
  stocks,
  alerts,
  onStockClick,
}) => {
  const topActive = stocks.slice(0, 14);
  const latestAlert = alerts[0];

  return (
    <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-2.5 px-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-xs">
      {/* Left: Live Flash Alert Pill */}
      {latestAlert ? (
        <div className="flex items-center gap-2 shrink-0 max-w-full md:max-w-md">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#477DFF]/15 text-[#21C8E8] border border-[#477DFF]/30 text-[10px] font-mono font-extrabold uppercase shrink-0">
            <Zap className="w-3 h-3 text-[#E9B949]" />
            <span>LIVE WIRE</span>
          </span>
          <span className="text-xs text-slate-200 font-medium truncate">
            {latestAlert.message}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <Radio className="w-3.5 h-3.5 text-[#00C995] animate-pulse" />
          <span className="text-[11px] font-mono font-bold text-[#8B9BB4]">
            LIVE TAPE ACTIVE
          </span>
        </div>
      )}

      {/* Right: Horizontal Ticker Strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {topActive.map(stock => {
          const isUp = stock.changePercent >= 0;
          return (
            <button
              key={stock.symbol}
              onClick={() => onStockClick(stock.symbol)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121C2D] hover:bg-[#1A2639] border border-white/[0.05] text-[11px] font-mono tabular-nums shrink-0 transition-colors cursor-pointer"
            >
              <span className="font-bold text-white">{stock.symbol}</span>
              <span className="text-slate-300">₹{stock.price.toFixed(1)}</span>
              <span
                className={`font-bold flex items-center ${
                  isUp ? 'text-[#00C995]' : 'text-[#FF526B]'
                }`}
              >
                {isUp ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {isUp ? '+' : ''}
                {stock.changePercent.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
