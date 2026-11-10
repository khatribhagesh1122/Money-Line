import React from 'react';
import { IntradayPick, MarketStatus } from '../types/market';

interface TopPicksProps {
  activePicks: IntradayPick[];
  pastPicks: IntradayPick[];
  status: MarketStatus;
  onStockClick: (symbol: string) => void;
}

export const TopPicks: React.FC<TopPicksProps> = () => {
  return null;
};
