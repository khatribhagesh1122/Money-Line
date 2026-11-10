import React from 'react';
import {
  LayoutDashboard,
  SlidersHorizontal,
  Target,
  Flame,
  CalendarDays,
  Menu,
} from 'lucide-react';
import { NavigationTab } from '../types/market';

interface MobileBottomNavProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenDrawer: () => void;
  unreadCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenDrawer,
  unreadCount = 0,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Terminal',
      icon: LayoutDashboard,
    },
    {
      id: 'screener' as NavigationTab,
      label: 'Screener',
      icon: SlidersHorizontal,
    },
    {
      id: 'options' as NavigationTab,
      label: 'Options',
      icon: Target,
    },
    {
      id: 'fo_movers' as NavigationTab,
      label: 'Heatmap',
      icon: Flame,
    },
    {
      id: 'results' as NavigationTab,
      label: 'Earnings',
      icon: CalendarDays,
    },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F17]/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-800/90 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] px-1 py-1">
      <div className="grid grid-cols-6 items-center w-full max-w-lg mx-auto">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center min-h-[46px] py-1 rounded-xl transition-all cursor-pointer select-none ${
                isActive
                  ? 'text-indigo-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
              aria-label={item.label}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]" />
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium tracking-tight truncate max-w-full px-0.5">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 6th Button: More Menu Drawer Trigger */}
        <button
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center min-h-[46px] py-1 rounded-xl text-slate-400 hover:text-slate-200 active:scale-95 transition-all cursor-pointer relative select-none"
          aria-label="Open Navigation Drawer"
        >
          <div className="relative">
            <Menu className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="text-[10px] mt-1 font-medium tracking-tight">
            More
          </span>
        </button>
      </div>
    </div>
  );
};
