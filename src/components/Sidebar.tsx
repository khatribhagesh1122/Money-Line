import React from 'react';
import { NavigationTab } from '../types/market';
import {
  LayoutDashboard,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Flame,
  BarChart3,
  Calendar,
  Newspaper,
  Star,
  Settings,
  Zap,
  Layers,
  Target,
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  watchlistCount: number;
  bullishCount: number;
  bearishCount: number;
  resultsTodayCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  mobileOpen,
  onCloseMobile,
  watchlistCount,
  bullishCount,
  bearishCount,
  resultsTodayCount = 0,
}) => {
  const navGroups: Array<{
    groupLabel: string;
    items: Array<{
      id: NavigationTab;
      label: string;
      icon: React.FC<{ className?: string }>;
      badge?: number | string;
      badgeColor?: string;
    }>;
  }> = [
    {
      groupLabel: 'MAIN TERMINAL',
      items: [
        { id: 'dashboard', label: '1. Dashboard', icon: LayoutDashboard },
        { id: 'screener', label: '2. Intraday Screener', icon: SlidersHorizontal },
        {
          id: 'bullish',
          label: '3. Bullish Setups',
          icon: TrendingUp,
          badge: bullishCount > 0 ? bullishCount : undefined,
          badgeColor: 'bg-[#00C995]/15 text-[#00C995] border border-[#00C995]/30',
        },
        {
          id: 'bearish',
          label: '4. Bearish Setups',
          icon: TrendingDown,
          badge: bearishCount > 0 ? bearishCount : undefined,
          badgeColor: 'bg-[#FF526B]/15 text-[#FF526B] border border-[#FF526B]/30',
        },
      ],
    },
    {
      groupLabel: 'MARKET MOVERS',
      items: [
        { id: 'fo_movers', label: '5. F&O Movers', icon: Flame },
        { id: 'non_fo_movers', label: '6. Non-F&O Movers', icon: BarChart3 },
      ],
    },
    {
      groupLabel: 'EARNINGS & NEWS WIRE',
      items: [
        { id: 'results', label: '7. Results Calendar', icon: Calendar },
        {
          id: 'results_flash',
          label: '8. Results Flash',
          icon: Zap,
          badge: resultsTodayCount > 0 ? `${resultsTodayCount} LIVE` : 'LIVE',
          badgeColor: 'bg-[#E9B949]/15 text-[#E9B949] border border-[#E9B949]/30',
        },
        { id: 'news', label: '9. Flash News', icon: Newspaper },
      ],
    },
    {
      groupLabel: 'INTELLIGENCE & ANALYTICS',
      items: [
        {
          id: 'watchlist',
          label: '10. Watchlists',
          icon: Star,
          badge: watchlistCount > 0 ? watchlistCount : undefined,
          badgeColor: 'bg-[#477DFF]/15 text-[#477DFF] border border-[#477DFF]/30',
        },
        {
          id: 'sectors',
          label: '11. Sector Analysis',
          icon: Layers,
        },
        {
          id: 'options',
          label: '12. Options Intelligence',
          icon: Target,
        },
        {
          id: 'settings',
          label: '13. Settings',
          icon: Settings,
        },
      ],
    },
  ];

  const handleNavClick = (id: NavigationTab) => {
    onSelectTab(id);
    if (mobileOpen) {
      onCloseMobile();
    }
  };

  const renderContent = () => (
    <div className="flex flex-col h-full py-2.5 px-2.5 select-none">
      <div className="space-y-3.5 overflow-y-auto pr-0.5">
        {navGroups.map(group => (
          <div key={group.groupLabel} className="space-y-1">
            {!collapsed && (
              <div className="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[#8B9BB4]/70">
                {group.groupLabel}
              </div>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-gradient-to-r from-[#477DFF] to-[#3B66E0] text-white shadow-[0_4px_16px_rgba(71,125,255,0.35)]'
                      : 'text-[#8B9BB4] hover:bg-[#121C2D] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'text-white' : 'text-[#8B9BB4] group-hover:text-[#21C8E8]'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!collapsed && item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-white/[0.07] bg-[#0D1422] transition-all duration-200 sticky top-14 h-[calc(100vh-3.5rem)] z-30 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {renderContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative w-68 max-w-[82vw] bg-[#0D1422] h-full shadow-2xl border-r border-white/10 z-10 flex flex-col">
            <div className="p-4 border-b border-white/[0.07] flex items-center justify-between">
              <span className="font-extrabold text-sm tracking-tight text-white">
                MONEYLINE <span className="text-[#21C8E8]">PRO</span>
              </span>
              <button
                onClick={onCloseMobile}
                className="text-xs font-mono text-[#8B9BB4] hover:text-white px-2 py-1 rounded bg-[#121C2D] cursor-pointer"
              >
                ESC
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderContent()}</div>
          </aside>
        </div>
      )}
    </>
  );
};
