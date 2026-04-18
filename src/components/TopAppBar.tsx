import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { MaterialIcon } from "@/components/MaterialIcon";

interface NavItem {
  to: string;
  label: string;
  count?: number;
  end?: boolean;
}

interface TopAppBarProps {
  onMenuToggle?: () => void;
  menuOpen?: boolean;
  conflictCount?: number;
  actionCount?: number;
}

export const TopAppBar = ({
  onMenuToggle,
  menuOpen,
  conflictCount,
  actionCount,
}: TopAppBarProps) => {
  const navItems: NavItem[] = [
    { to: "/", label: "Overview", end: true },
    { to: "/conflicts", label: "Conflicts", count: conflictCount },
    { to: "/scenarios", label: "Scenarios" },
    { to: "/plan", label: "Action Plan", count: actionCount },
    { to: "/memo", label: "Memo" },
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

        <Link
          to="/"
          className="font-headline font-bold text-xl tracking-tighter text-primary hover:opacity-80 transition-opacity"
        >
          JurisdictIQ
        </Link>

        <div className="hidden md:flex items-center space-x-6 ml-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `font-headline text-base tracking-tight transition-colors duration-150 px-1 pb-1 flex items-center gap-2 ${
                  isActive
                    ? "text-primary border-b-2 border-primary font-bold"
                    : "text-outline hover:text-primary border-b-2 border-transparent"
                }`
              }
            >
              {({ isActive }) => (
                <>
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
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-1">
        <NavLink
          to="/help"
          className={({ isActive }) =>
            `flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors px-3 py-2 ${
              isActive ? "text-primary" : "text-outline hover:text-primary"
            }`
          }
          aria-label="Help and documentation"
        >
          <MaterialIcon name="help_outline" className="text-[18px]" />
          <span className="hidden sm:inline">Help</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors px-3 py-2 ${
              isActive ? "text-primary" : "text-outline hover:text-primary"
            }`
          }
          aria-label="Settings"
        >
          <MaterialIcon name="settings" className="text-[18px]" />
          <span className="hidden sm:inline">Settings</span>
        </NavLink>
      </div>

      <div className="absolute bottom-0 left-0 bg-surface-container h-px w-full" />
    </nav>
  );
};
