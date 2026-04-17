import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

const items = [
  { icon: "public", label: "Region Select" },
  { icon: "gavel", label: "Regulatory Scope" },
  { icon: "payments", label: "Tax Exposure" },
  { icon: "account_tree", label: "Entity Structure" },
];

export const SideNav = () => {
  const [active, setActive] = useState("Regulatory Scope");

  return (
    <aside className="fixed left-0 top-[89px] bottom-8 w-80 bg-surface-container flex flex-col py-12 px-6 z-40">
      <div className="mb-12 px-2">
        <h2 className="font-headline text-2xl text-primary mb-2">JurisdictIQ Analysis</h2>
        <p className="mono-label">Expansion Parameters</p>
      </div>
      <nav className="flex flex-col space-y-2 flex-1">
        {items.map((item) => {
          const isActive = item.label === active;
          return (
            <button
              key={item.label}
              onClick={() => setActive(item.label)}
              className={`flex items-center space-x-4 px-4 py-3 transition-all duration-200 text-left ${
                isActive
                  ? "bg-surface-lowest text-primary font-bold border-l-4 border-primary"
                  : "text-outline hover:bg-surface-high hover:text-primary border-l-4 border-transparent"
              }`}
            >
              <MaterialIcon name={item.icon} className="text-[20px]" />
              <span className="font-mono uppercase tracking-widest text-xs">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto">
        <button className="w-full bg-primary text-primary-foreground font-mono text-xs tracking-widest uppercase py-4 hover:bg-primary-container transition-colors">
          Generate Brief
        </button>
      </div>
    </aside>
  );
};
