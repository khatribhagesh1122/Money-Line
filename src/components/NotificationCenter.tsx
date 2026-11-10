import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Newspaper,
  Zap,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { NotificationItem, NotificationCategory, NavigationTab } from '../types/market';

interface NotificationCenterProps {
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectStock: (symbol: string) => void;
  onNavigateTab: (tab: NavigationTab) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSelectStock,
  onNavigateTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown on click outside or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredNotifications = notifications.filter(item => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const getCategoryIcon = (category: NotificationCategory, severity?: string) => {
    switch (category) {
      case 'breaking_news':
        return <Newspaper className="w-4 h-4 text-cyan-400" />;
      case 'results':
        return <CalendarDays className="w-4 h-4 text-amber-400" />;
      case 'picks':
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case 'market_alerts':
      default:
        return severity === 'danger' ? (
          <ShieldAlert className="w-4 h-4 text-rose-400" />
        ) : (
          <TrendingUp className="w-4 h-4 text-indigo-400" />
        );
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    onMarkAsRead(item.id);
    if (item.symbol) {
      onSelectStock(item.symbol);
      setIsOpen(false);
    } else if (item.linkTab) {
      onNavigateTab(item.linkTab);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1424] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 shadow-xs"
        title="Notifications & Market Alerts"
        aria-label="Open notifications"
      >
        <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Flyout Dropdown */}
      {isOpen && (
        <div className="fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[420px] bg-white dark:bg-[#0E1424] border border-slate-200 dark:border-slate-800/90 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[75vh] sm:max-h-[520px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-[#0B0F17]/80">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs tracking-wider uppercase text-slate-900 dark:text-slate-100 font-mono">
                Terminal Alerts
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-bold border border-rose-500/30">
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="px-2 py-1 rounded-lg text-[11px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark all</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Clear all alerts"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#0E1424] flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px] shrink-0">
            {(
              [
                { id: 'all', label: 'All Alerts' },
                { id: 'picks', label: 'Setups & F&O' },
                { id: 'results', label: 'Results' },
                { id: 'breaking_news', label: 'News' },
                { id: 'market_alerts', label: 'Breakouts' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === tab.id
                    ? 'bg-slate-900 text-white dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-500/30 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Alert List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 overscroll-contain">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-25 text-amber-500" />
                <p className="font-medium text-slate-700 dark:text-slate-300">No alerts in this category</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Live breakout triggers and corporate result flashes will show here.
                </p>
              </div>
            ) : (
              filteredNotifications.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3 text-left transition-colors cursor-pointer flex items-start gap-2.5 ${
                    item.read
                      ? 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400'
                      : 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 text-slate-900 dark:text-slate-100 font-medium'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 shrink-0 mt-0.5">
                    {getCategoryIcon(item.category, item.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        {item.symbol && (
                          <span className="font-bold text-xs font-mono text-indigo-600 dark:text-indigo-400">
                            {item.symbol}
                          </span>
                        )}
                        <span className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {item.timestamp}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    {(item.publicationTime || item.exchangeFilingTime || item.detectedByServerTime || item.notificationDeliveredTime) && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/70 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] font-mono text-slate-400">
                        {item.publicationTime && (
                          <span className="truncate" title={`Published: ${item.publicationTime}`}>
                            Pub: <strong className="text-slate-600 dark:text-slate-300">{item.publicationTime}</strong>
                          </span>
                        )}
                        {item.exchangeFilingTime && (
                          <span className="truncate" title={`Exchange Filing: ${item.exchangeFilingTime}`}>
                            Exch: <strong className="text-amber-500">{item.exchangeFilingTime}</strong>
                          </span>
                        )}
                        {item.detectedByServerTime && (
                          <span className="truncate" title={`Server Detected: ${item.detectedByServerTime}`}>
                            Srv: <strong className="text-cyan-500">{item.detectedByServerTime}</strong>
                          </span>
                        )}
                        {item.notificationDeliveredTime && (
                          <span className="truncate" title={`Delivered: ${item.notificationDeliveredTime}`}>
                            Dlv: <strong className="text-emerald-500">{item.notificationDeliveredTime}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-1.5 text-[10px]">
                      <span className="text-indigo-500 dark:text-indigo-400 flex items-center gap-0.5 hover:underline font-mono">
                        View details <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                      {!item.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer status note */}
          <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0B0F17]/90 text-[10px] text-slate-400 flex items-center justify-between shrink-0 font-mono">
            <span className="text-slate-500">Backend-Synced • Silent Initial Load Active</span>
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Deduplicated
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
