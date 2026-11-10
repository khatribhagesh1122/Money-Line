import React from 'react';

interface MoneyLineLogoProps {
  size?: 'sm' | 'md' | 'lg';
  collapsed?: boolean;
  showTagline?: boolean;
  className?: string;
}

export const MoneyLineLogo: React.FC<MoneyLineLogoProps> = ({
  size = 'md',
  collapsed = false,
  showTagline = true,
  className = '',
}) => {
  const logoSrc = '/assets/aistudio/4D1FF220-5973-4316-A795-355E50E9CB89_Original_c88ea4e0.png';

  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  }[size];

  if (collapsed) {
    return (
      <div
        className={`relative rounded-lg bg-black border border-slate-800 p-0.5 flex items-center justify-center shrink-0 shadow-md ${iconDimensions} ${className}`}
        title="MONEY LINE - Trading Terminal"
      >
        <img
          src={logoSrc}
          alt="Money Line Mark"
          className="w-full h-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className={`relative rounded-lg bg-black border border-slate-800/80 p-0.5 flex items-center justify-center shrink-0 shadow-sm ${iconDimensions}`}>
        <img
          src={logoSrc}
          alt="Money Line"
          className="w-full h-full object-contain"
          loading="eager"
        />
      </div>

      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold tracking-tight text-base sm:text-lg font-serif">
            <span className="text-slate-900 dark:text-white">MONEY </span>
            <span className="text-rose-500">LINE</span>
          </span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            PRO
          </span>
        </div>
        {showTagline && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans tracking-wide">
            Trading Terminal
          </span>
        )}
      </div>
    </div>
  );
};
