import React, { useState, useMemo } from 'react';
import { Stock } from '../types/market';
import { Grid, Layers, Maximize2 } from 'lucide-react';

interface HeatmapProps {
  stocks: Stock[];
  onStockClick: (symbol: string) => void;
}

type HeatmapUniverse = 'FO' | 'NIFTY50' | 'NIFTY100' | 'BANKNIFTY' | 'SECTOR';

export const Heatmap: React.FC<HeatmapProps> = ({ stocks, onStockClick }) => {
  const [universe, setUniverse] = useState<HeatmapUniverse>('FO');

  const filteredStocks = useMemo(() => {
    let list = [...stocks];
    if (universe === 'FO') {
      list = list.filter(s => s.isFO).slice(0, 48);
    } else if (universe === 'NIFTY50') {
      list = list.filter(s => s.isFO).slice(0, 30);
    } else if (universe === 'NIFTY100') {
      list = list.slice(0, 60);
    } else if (universe === 'BANKNIFTY') {
      const fin = list.filter(
        s =>
          s.sector.toLowerCase().includes('bank') ||
          s.sector.toLowerCase().includes('fin')
      );
      list = fin.length > 0 ? fin : list.slice(0, 20);
    } else {
      list = list.slice(0, 48);
    }
    return list.sort((a, b) => b.changePercent - a.changePercent);
  }, [stocks, universe]);

  const getTileStyle = (pct: number) => {
    if (pct >= 3)
      return 'bg-[#00C995]/30 border-[#00C995]/60 text-white shadow-[inset_0_0_20px_rgba(0,201,149,0.2)]';
    if (pct >= 1.2)
      return 'bg-[#00C995]/20 border-[#00C995]/40 text-white';
    if (pct > 0)
      return 'bg-[#00C995]/10 border-[#00C995]/25 text-slate-100';
    if (pct === 0)
      return 'bg-[#121C2D] border-white/10 text-[#8B9BB4]';
    if (pct > -1.2)
      return 'bg-[#FF526B]/10 border-[#FF526B]/25 text-slate-100';
    if (pct > -3)
      return 'bg-[#FF526B]/20 border-[#FF526B]/40 text-white';
    return 'bg-[#FF526B]/30 border-[#FF526B]/60 text-white shadow-[inset_0_0_20px_rgba(255,82,107,0.2)]';
  };

  return (
    <div className="bg-[#0D1422] border border-white/[0.07] rounded-2xl p-5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#21C8E8]/15 border border-[#21C8E8]/30 flex items-center justify-center">
            <Grid className="w-4 h-4 text-[#21C8E8]" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
              Market Heatmap
            </h2>
            <p className="text-[11px] text-[#8B9BB4]">
              Color-coded intraday momentum matrix • Click any tile for full technical &amp; options intelligence
            </p>
          </div>
        </div>

        {/* Universe Switcher */}
        <div className="flex items-center gap-1 bg-[#121C2D] p-1 rounded-xl border border-white/[0.06] overflow-x-auto">
          {[
            { id: 'FO', label: 'F&O Universe' },
            { id: 'NIFTY50', label: 'Nifty 50' },
            { id: 'NIFTY100', label: 'Nifty 100' },
            { id: 'BANKNIFTY', label: 'Bank & Fin' },
          ].map(u => (
            <button
              key={u.id}
              onClick={() => setUniverse(u.id as HeatmapUniverse)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                universe === u.id
                  ? 'bg-[#477DFF] text-white shadow-xs'
                  : 'text-[#8B9BB4] hover:text-white'
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-4 max-h-[430px] overflow-y-auto pr-1">
        {filteredStocks.map(stock => {
          const isPos = stock.changePercent >= 0;
          const volRatio =
            stock.avgVolume20D > 0 ? stock.volume / stock.avgVolume20D : 1;

          return (
            <button
              key={stock.symbol}
              onClick={() => onStockClick(stock.symbol)}
              title={`${stock.name} (${stock.symbol})\nLTP: ₹${stock.price.toFixed(2)} (${
                isPos ? '+' : ''
              }${stock.changePercent.toFixed(2)}%)\nSector: ${stock.sector}\nRVOL: ${volRatio.toFixed(1)}x`}
              className={`p-2.5 rounded-xl border text-left transition-all hover:scale-[1.03] cursor-pointer flex flex-col justify-between min-h-[68px] ${getTileStyle(
                stock.changePercent
              )}`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className="font-mono font-extrabold text-[11px] truncate">
                  {stock.symbol}
                </span>
                {volRatio >= 1.5 && (
                  <span className="text-[8px] font-mono px-1 rounded bg-white/15 text-white font-bold">
                    {volRatio.toFixed(1)}x
                  </span>
                )}
              </div>

              <div className="mt-1.5 font-mono tabular-nums">
                <div className="text-[11px] font-bold opacity-90">
                  ₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                </div>
                <div
                  className={`text-xs font-extrabold ${
                    isPos ? 'text-[#00C995]' : 'text-[#FF526B]'
                  }`}
                >
                  {isPos ? '+' : ''}
                  {stock.changePercent.toFixed(2)}%
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Color Scale Legend */}
      <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-white/[0.06] text-[10px] font-mono text-[#8B9BB4]">
        <span>INTENSITY SCALE</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded bg-[#FF526B]/30 text-[#FF526B]">&le; -3%</span>
          <span className="px-1.5 py-0.5 rounded bg-[#FF526B]/15 text-[#FF526B]">-1%</span>
          <span className="px-1.5 py-0.5 rounded bg-[#121C2D] text-[#8B9BB4]">0%</span>
          <span className="px-1.5 py-0.5 rounded bg-[#00C995]/15 text-[#00C995]">+1%</span>
          <span className="px-1.5 py-0.5 rounded bg-[#00C995]/30 text-[#00C995]">&ge; +3%</span>
        </div>
      </div>
    </div>
  );
};
