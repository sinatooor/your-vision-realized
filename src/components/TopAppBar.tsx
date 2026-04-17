import { useState } from "react";

const navItems = ["Overview", "Conflicts", "Scenarios", "Action Plan", "Memo"];

export const TopAppBar = () => {
  const [active, setActive] = useState("Conflicts");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface flex justify-between items-center px-12 py-6 w-full">
      <div className="flex items-center space-x-12">
        <span className="font-headline font-bold text-xl tracking-tighter text-primary">
          JurisdictIQ
        </span>
        <div className="hidden md:flex space-x-8">
          {navItems.map((item) => {
            const isActive = item === active;
            return (
              <button
                key={item}
                onClick={() => setActive(item)}
                className={`font-headline text-lg tracking-tight transition-colors duration-150 px-1 pb-1 ${
                  isActive
                    ? "text-primary border-b-2 border-primary font-bold"
                    : "text-outline hover:text-primary"
                }`}
              >
                {item}
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
