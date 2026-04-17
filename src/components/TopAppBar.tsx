type View = "map" | "conflicts" | "scenarios" | "plan" | "memo";

interface NavItem {
  key: View;
  label: string;
  count?: number;
}

interface TopAppBarProps {
  onMenuToggle?: () => void;
  menuOpen?: boolean;
  view?: View;
  onViewChange?: (v: View) => void;
  conflictCount?: number;
  actionCount?: number;
}

export const TopAppBar = ({
  onMenuToggle,
  menuOpen,
  view = "map",
  onViewChange,
  conflictCount,
  actionCount,
}: TopAppBarProps) => {
  const navItems: NavItem[] = [
    { key: "map", label: "Overview" },
    { key: "conflicts", label: "Conflicts", count: conflictCount },
    { key: "scenarios", label: "Scenarios" },
    { key: "plan", label: "Action Plan", count: actionCount },
    { key: "memo", label: "Memo" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface flex justify-between items-center px-6 py-6 w-full">
      <div className="flex items-center space-x-6">
        {/* Hamburger */}
        <button
          onClick={onMenuToggle}
          aria-label={menuOpen ? "Close parameters" : "Open parameters"}
          className="flex flex-col justify-center items-center w-9 h-9 gap-[5px] shrink-0"
        >
          <span
            className={`block h-[2px] bg-primary transition-all duration-300 origin-center ${
              menuOpen ? "w-5 rotate-45 translate-y-[7px]" : "w-5"
            }`}
          />
          <span
            className={`block h-[2px] bg-primary transition-all duration-300 ${
              menuOpen ? "w-0 opacity-0" : "w-5 opacity-100"
            }`}
          />
          <span
            className={`block h-[2px] bg-primary transition-all duration-300 origin-center ${
              menuOpen ? "w-5 -rotate-45 -translate-y-[7px]" : "w-5"
            }`}
          />
        </button>

        <span className="font-headline font-bold text-xl tracking-tighter text-primary">
          JurisdictIQ
        </span>

        <div className="hidden md:flex items-center space-x-6 ml-4">
          {navItems.map((item) => {
            const isActive = item.key === view;
            return (
              <button
                key={item.key}
                onClick={() => onViewChange?.(item.key)}
                className={`font-headline text-base tracking-tight transition-colors duration-150 px-1 pb-1 flex items-center gap-2 ${
                  isActive
                    ? "text-primary border-b-2 border-primary font-bold"
                    : "text-outline hover:text-primary border-b-2 border-transparent"
                }`}
              >
                {item.label}
                {item.count !== undefined && (
                  <span
                    className={`font-mono text-[9px] px-1.5 py-0.5 ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-highest text-on-surface"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <span className="hidden sm:inline font-mono text-xs tracking-widest text-primary uppercase">
          MATTER-2024-08
        </span>
        <span className="font-mono text-[10px] tracking-widest text-primary-foreground bg-primary px-3 py-1 uppercase">
          PLATINUM_CLIENT
        </span>
      </div>

      <div className="absolute bottom-0 left-0 bg-surface-container h-px w-full" />
    </nav>
  );
};
